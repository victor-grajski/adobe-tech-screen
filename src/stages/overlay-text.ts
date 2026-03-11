import sharp from "sharp";
import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { GeneratedAsset } from "../types.js";
import { DIMENSION_MAP } from "../utils/image-helpers.js";
import { logger } from "../utils/logger.js";

export async function overlayText(
  assets: GeneratedAsset[],
  campaignMessage: string,
  outputDir: string,
): Promise<GeneratedAsset[]> {
  const result: GeneratedAsset[] = [];

  for (const asset of assets) {
    const dims = DIMENSION_MAP[asset.aspectRatio];
    const ratioDir = asset.aspectRatio.replace(":", "x");
    const destPath = resolve(outputDir, asset.productId, ratioDir, "creative.png");
    await mkdir(dirname(destPath), { recursive: true });

    const bannerHeight = Math.round(dims.height * 0.15);
    const fontSize = Math.round(dims.width * 0.04);
    const bannerY = dims.height - bannerHeight;

    // Create semi-transparent dark banner
    const banner = Buffer.from(
      `<svg width="${dims.width}" height="${dims.height}">
        <rect x="0" y="${bannerY}" width="${dims.width}" height="${bannerHeight}"
              fill="black" opacity="0.6"/>
      </svg>`,
    );

    // Create text overlay
    const textY = bannerY + Math.round(bannerHeight / 2);
    const text = Buffer.from(
      `<svg width="${dims.width}" height="${dims.height}">
        <text x="${Math.round(dims.width / 2)}" y="${textY}"
              font-family="sans-serif" font-size="${fontSize}" font-weight="bold"
              fill="white" text-anchor="middle" dominant-baseline="middle">
          ${escapeXml(campaignMessage)}
        </text>
      </svg>`,
    );

    logger.info("overlay-text", `Compositing text on ${asset.productId} (${asset.aspectRatio})`);

    // Load source image, resize if needed (for reused assets), then composite
    await sharp(asset.localPath)
      .resize(dims.width, dims.height, { fit: "cover" })
      .composite([
        { input: banner, top: 0, left: 0 },
        { input: text, top: 0, left: 0 },
      ])
      .png()
      .toFile(destPath);

    result.push({
      ...asset,
      localPath: destPath,
    });
  }

  logger.info("overlay-text", `Composited text on ${result.length} asset(s)`);
  return result;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}
