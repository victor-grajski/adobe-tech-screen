import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { GeneratedAsset, OverlayOptions } from "../types.js";
import { DIMENSION_MAP } from "../utils/image-helpers.js";
import { parseFontSize } from "../utils/brand-helpers.js";
import { logger } from "../utils/logger.js";

export async function overlayText(
  assets: GeneratedAsset[],
  campaignMessage: string,
  outputDir: string,
  options: OverlayOptions,
): Promise<GeneratedAsset[]> {
  const result: GeneratedAsset[] = [];

  // Load and prepare logo
  const logoPath = resolve(options.projectRoot, options.logoPath);
  let logoBuffer: Buffer | null = null;
  try {
    logoBuffer = await readFile(logoPath);
  } catch {
    logger.warn("overlay-text", `Logo not found at ${logoPath}, skipping logo composite`);
  }

  for (const asset of assets) {
    const dims = DIMENSION_MAP[asset.aspectRatio];
    const ratioDir = asset.aspectRatio.replace(":", "x");
    const destPath = resolve(outputDir, asset.productId, ratioDir, "creative.png");
    await mkdir(dirname(destPath), { recursive: true });

    const bannerHeight = Math.round(dims.height * 0.15);
    const bannerY = dims.height - bannerHeight;

    // Use brand typography for heading
    const heading = options.typography.heading;
    const fontSize = parseFontSize(heading.fontSize, dims.width);
    const fontFamily = heading.fontFamily;
    const fontWeight = heading.fontWeight;

    // Create semi-transparent banner with brand background color
    const banner = Buffer.from(
      `<svg width="${dims.width}" height="${dims.height}">
        <rect x="0" y="${bannerY}" width="${dims.width}" height="${bannerHeight}"
              fill="${options.bannerBackground}" opacity="0.6"/>
      </svg>`,
    );

    // Create text overlay with brand typography and text color
    const textY = bannerY + Math.round(bannerHeight / 2);
    const text = Buffer.from(
      `<svg width="${dims.width}" height="${dims.height}">
        <text x="${Math.round(dims.width / 2)}" y="${textY}"
              font-family="${escapeXml(fontFamily)}" font-size="${fontSize}" font-weight="${fontWeight}"
              fill="${options.textColor}" text-anchor="middle" dominant-baseline="middle">
          ${escapeXml(campaignMessage)}
        </text>
      </svg>`,
    );

    logger.info("overlay-text", `Compositing text on ${asset.productId} (${asset.aspectRatio})`);

    const inputBuffer = await readFile(asset.localPath);

    const composites: sharp.OverlayOptions[] = [
      { input: banner, top: 0, left: 0 },
      { input: text, top: 0, left: 0 },
    ];

    // Composite logo at top-left with 3% margin
    if (logoBuffer) {
      const logoWidth = Math.round(dims.width * 0.1);
      const margin = Math.round(dims.width * 0.03);
      const resizedLogo = await sharp(logoBuffer)
        .resize(logoWidth, undefined, { fit: "inside" })
        .png()
        .toBuffer();

      composites.push({
        input: resizedLogo,
        top: margin,
        left: margin,
      });
    }

    await sharp(inputBuffer)
      .resize(dims.width, dims.height, { fit: "cover" })
      .composite(composites)
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
