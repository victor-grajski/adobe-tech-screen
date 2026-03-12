import sharp from "sharp";
import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import type { BrandGuidelines } from "../schemas/brief.js";
import type { GeneratedAsset, ComplianceResult } from "../types.js";
import { getAllBrandColors, computeLogoPlacement } from "../utils/brand-helpers.js";
import { logger } from "../utils/logger.js";

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const n = parseInt(hex.slice(1), 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}

function colorDistance(
  a: { r: number; g: number; b: number },
  b: { r: number; g: number; b: number },
): number {
  return Math.sqrt((a.r - b.r) ** 2 + (a.g - b.g) ** 2 + (a.b - b.b) ** 2);
}

export async function runComplianceChecks(
  assets: GeneratedAsset[],
  resolvedMessage: string,
  brandGuidelines: BrandGuidelines,
  projectRoot: string,
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = [];
  const messageLC = resolvedMessage.toLowerCase();

  // Load logo buffer + metadata once for pixel-level verification
  let logoBuffer: Buffer | null = null;
  let logoMeta: { width: number; height: number } | null = null;
  try {
    const logoPath = resolve(projectRoot, brandGuidelines.logoPath);
    logoBuffer = await readFile(logoPath);
    const meta = await sharp(logoBuffer).metadata();
    logoMeta = { width: meta.width!, height: meta.height! };
  } catch {
    // Logo file missing — will be caught per-asset below
  }

  for (const asset of assets) {
    const issues: string[] = [];
    const warnings: string[] = [];

    // --- Prohibited words check (word-boundary split) ---
    const flaggedWords: string[] = [];
    for (const phrase of brandGuidelines.prohibitedWords) {
      const phraseLC = phrase.toLowerCase();
      if (messageLC.includes(phraseLC)) {
        flaggedWords.push(phrase);
        issues.push(`Campaign message contains prohibited phrase: "${phrase}"`);
      }
    }
    const prohibitedWordsCheck = {
      passed: flaggedWords.length === 0,
      flagged: flaggedWords,
    };

    // --- Brand color presence check ---
    let brandColorCheck = { passed: true, closestColor: "", distance: 0 };
    try {
      const stats = await sharp(asset.localPath).stats();
      const dominantColor = {
        r: Math.round(stats.dominant.r),
        g: Math.round(stats.dominant.g),
        b: Math.round(stats.dominant.b),
      };

      const allColors = getAllBrandColors(brandGuidelines.colors);
      let minDist = Infinity;
      let closestHex = "";
      for (const { hex } of allColors) {
        const rgb = hexToRgb(hex);
        const dist = colorDistance(dominantColor, rgb);
        if (dist < minDist) {
          minDist = dist;
          closestHex = hex;
        }
      }

      brandColorCheck = {
        passed: minDist <= 150,
        closestColor: closestHex,
        distance: Math.round(minDist),
      };

      if (!brandColorCheck.passed) {
        warnings.push(
          `Dominant color rgb(${dominantColor.r},${dominantColor.g},${dominantColor.b}) ` +
            `is distant from brand colors (closest: ${closestHex}, distance: ${Math.round(minDist)})`,
        );
      }
    } catch (err) {
      warnings.push(`Could not analyze colors: ${err}`);
      brandColorCheck = { passed: false, closestColor: "", distance: -1 };
    }

    // --- Logo presence check (pixel-level verification) ---
    let logoPresent = { passed: false };
    if (!logoBuffer || !logoMeta) {
      issues.push(`Logo file not found: ${brandGuidelines.logoPath}`);
    } else {
      try {
        const placement = computeLogoPlacement(asset.aspectRatio, logoMeta);

        // Resize original logo to placement dimensions (ensureAlpha before resize for correct padding)
        const resizedLogo = await sharp(logoBuffer)
          .ensureAlpha()
          .resize(placement.width, placement.height, {
            fit: "contain",
            background: { r: 0, g: 0, b: 0, alpha: 0 },
          })
          .raw()
          .toBuffer();

        // Extract the same region from the composited image
        const compositedRegion = await sharp(asset.localPath)
          .extract({ left: placement.x, top: placement.y, width: placement.width, height: placement.height })
          .ensureAlpha()
          .raw()
          .toBuffer();

        // Compare opaque logo pixels (alpha > 128)
        const pixelCount = placement.width * placement.height;
        let totalDiff = 0;
        let opaquePixels = 0;

        for (let i = 0; i < pixelCount; i++) {
          const offset = i * 4;
          const logoAlpha = resizedLogo[offset + 3];
          if (logoAlpha > 128) {
            opaquePixels++;
            const dr = Math.abs(resizedLogo[offset] - compositedRegion[offset]);
            const dg = Math.abs(resizedLogo[offset + 1] - compositedRegion[offset + 1]);
            const db = Math.abs(resizedLogo[offset + 2] - compositedRegion[offset + 2]);
            totalDiff += (dr + dg + db) / 3;
          }
        }

        const meanDiff = opaquePixels > 0 ? totalDiff / opaquePixels : 255;

        if (meanDiff < 50) {
          logoPresent = { passed: true };
        } else {
          logoPresent = { passed: false };
          issues.push(
            `Logo not detected in composited image (mean pixel diff: ${Math.round(meanDiff)}, ` +
            `opaque pixels compared: ${opaquePixels})`,
          );
        }
      } catch (err) {
        logoPresent = { passed: false };
        issues.push(`Logo pixel verification failed: ${err}`);
      }
    }

    // --- Positive keywords check ---
    const positiveKeywords = brandGuidelines.positiveKeywords;
    const foundKeywords: string[] = [];
    for (const keyword of positiveKeywords) {
      if (messageLC.includes(keyword.toLowerCase())) {
        foundKeywords.push(keyword);
      }
    }
    const suggestedKeywords = positiveKeywords.filter(
      (k) => !foundKeywords.includes(k),
    );
    const positiveKeywordsCheck = {
      passed: foundKeywords.length > 0,
      found: foundKeywords,
      suggested: suggestedKeywords,
    };
    if (!positiveKeywordsCheck.passed && positiveKeywords.length > 0) {
      warnings.push(
        `Campaign message contains no positive keywords. Consider using: ${suggestedKeywords.join(", ")}`,
      );
    }

    const passed = issues.length === 0;
    const label = `${asset.productId} (${asset.aspectRatio})`;
    logger.info(
      "compliance",
      `${label}: ${passed ? "PASSED" : `${issues.length} issue(s)`}` +
        (warnings.length > 0 ? ` (${warnings.length} warning(s))` : ""),
    );

    results.push({
      productId: asset.productId,
      aspectRatio: asset.aspectRatio,
      passed,
      issues,
      warnings,
      checks: {
        prohibitedWords: prohibitedWordsCheck,
        brandColor: brandColorCheck,
        logoPresent,
        positiveKeywords: positiveKeywordsCheck,
      },
    });
  }

  return results;
}
