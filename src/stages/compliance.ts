import sharp from "sharp";
import { access } from "node:fs/promises";
import { resolve } from "node:path";
import type { BrandGuidelines } from "../schemas/brief.js";
import type { GeneratedAsset, ComplianceResult } from "../types.js";
import { getAllBrandColors } from "../utils/brand-helpers.js";
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
  const productIds = [...new Set(assets.map((a) => a.productId))];

  for (const productId of productIds) {
    const issues: string[] = [];
    const warnings: string[] = [];

    // --- Prohibited words check (word-boundary split) ---
    const messageWords = resolvedMessage.toLowerCase().split(/\W+/);
    const messageLC = resolvedMessage.toLowerCase();
    const flaggedWords: string[] = [];
    for (const phrase of brandGuidelines.prohibitedWords) {
      const phraseLC = phrase.toLowerCase();
      // Support multi-word prohibited phrases
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
    const asset = assets.find((a) => a.productId === productId);
    if (asset) {
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
    }

    // --- Logo presence check ---
    let logoPresent = { passed: false };
    try {
      await access(resolve(projectRoot, brandGuidelines.logoPath));
      logoPresent = { passed: true };
    } catch {
      logoPresent = { passed: false };
      issues.push(`Logo file not found: ${brandGuidelines.logoPath}`);
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
    logger.info(
      "compliance",
      `${productId}: ${passed ? "PASSED" : `${issues.length} issue(s)`}` +
        (warnings.length > 0 ? ` (${warnings.length} warning(s))` : ""),
    );

    results.push({
      productId,
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
