import sharp from "sharp";
import type { CampaignBrief } from "../schemas/brief.js";
import type { GeneratedAsset, ComplianceResult } from "../types.js";
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
  brief: CampaignBrief,
): Promise<ComplianceResult[]> {
  const results: ComplianceResult[] = [];
  const productIds = [...new Set(assets.map((a) => a.productId))];

  for (const productId of productIds) {
    const issues: string[] = [];

    // Prohibited words check
    const message = brief.campaign.message.toLowerCase();
    for (const word of brief.brandGuidelines.prohibitedWords) {
      if (message.includes(word.toLowerCase())) {
        issues.push(`Campaign message contains prohibited word: "${word}"`);
      }
    }

    // Brand color presence check on one asset for this product
    const asset = assets.find((a) => a.productId === productId);
    if (asset) {
      try {
        const stats = await sharp(asset.localPath).stats();
        const dominantColor = {
          r: Math.round(stats.dominant.r),
          g: Math.round(stats.dominant.g),
          b: Math.round(stats.dominant.b),
        };

        const primaryRgb = hexToRgb(brief.brandGuidelines.primaryColor);
        const secondaryRgb = hexToRgb(brief.brandGuidelines.secondaryColor);
        const primaryDist = colorDistance(dominantColor, primaryRgb);
        const secondaryDist = colorDistance(dominantColor, secondaryRgb);

        // Threshold of 150 is fairly lenient — GenAI images may not match exactly
        if (primaryDist > 150 && secondaryDist > 150) {
          issues.push(
            `Dominant color rgb(${dominantColor.r},${dominantColor.g},${dominantColor.b}) ` +
              `is distant from brand colors (primary: ${brief.brandGuidelines.primaryColor}, ` +
              `secondary: ${brief.brandGuidelines.secondaryColor})`,
          );
        }
      } catch (err) {
        issues.push(`Could not analyze colors: ${err}`);
      }
    }

    const passed = issues.length === 0;
    logger.info(
      "compliance",
      `${productId}: ${passed ? "PASSED" : `${issues.length} issue(s) found`}`,
    );
    results.push({ productId, passed, issues });
  }

  return results;
}
