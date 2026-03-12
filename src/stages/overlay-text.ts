import sharp from "sharp";
import { mkdir, readFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import type { Product } from "../schemas/brief.js";
import type { GeneratedAsset, OverlayOptions } from "../types.js";
import { DIMENSION_MAP } from "../utils/image-helpers.js";
import { parseFontSize, computeLogoPlacement } from "../utils/brand-helpers.js";
import { logger } from "../utils/logger.js";

export async function overlayText(
  assets: GeneratedAsset[],
  campaignMessage: string,
  products: Product[],
  outputDir: string,
  options: OverlayOptions,
): Promise<GeneratedAsset[]> {
  const result: GeneratedAsset[] = [];
  const productMap = new Map(products.map((p) => [p.id, p]));

  // Load and prepare logo
  const logoPath = resolve(options.projectRoot, options.logoPath);
  let logoBuffer: Buffer | null = null;
  let logoMeta: { width: number; height: number } | null = null;
  try {
    logoBuffer = await readFile(logoPath);
    const meta = await sharp(logoBuffer).metadata();
    logoMeta = { width: meta.width!, height: meta.height! };
  } catch {
    logger.warn("overlay-text", `Logo not found at ${logoPath}, skipping logo composite`);
  }

  for (const asset of assets) {
    const dims = DIMENSION_MAP[asset.aspectRatio];
    const ratioDir = asset.aspectRatio.replace(":", "x");
    const destPath = resolve(outputDir, asset.productId, ratioDir, "creative.png");
    await mkdir(dirname(destPath), { recursive: true });

    const product = productMap.get(asset.productId);
    const productName = product?.name ?? asset.productId;
    const productDescription = product?.description ?? "";

    // Expanded banner to fit name + description + campaign message
    const bannerHeight = Math.round(dims.height * 0.28);
    const bannerY = dims.height - bannerHeight;

    // Typography sizes
    const headingSize = parseFontSize(options.typography.heading.fontSize, dims.width);
    const baseBodySize = parseFontSize(options.typography.body.fontSize, dims.width);
    const bodySize = asset.aspectRatio === "9:16" ? Math.round(baseBodySize * 1.5) : baseBodySize;
    const subheadingSize = parseFontSize(options.typography.subheading.fontSize, dims.width);

    // Create semi-transparent banner with brand background color
    const banner = Buffer.from(
      `<svg width="${dims.width}" height="${dims.height}">
        <rect x="0" y="${bannerY}" width="${dims.width}" height="${bannerHeight}"
              fill="${options.bannerBackground}" opacity="0.75"/>
      </svg>`,
    );

    // Layout: product name (top of banner), description (middle), campaign message (bottom)
    const padding = Math.round(bannerHeight * 0.12);
    const nameY = bannerY + padding + headingSize / 2;
    const descY = nameY + headingSize / 2 + padding + bodySize / 2;
    const messageY = bannerY + bannerHeight - padding - subheadingSize / 2;
    const centerX = Math.round(dims.width / 2);

    let logoSvgElement = "";
    if (logoBuffer && logoMeta) {
      const placement = computeLogoPlacement(asset.aspectRatio, logoMeta);
      const logoB64 = logoBuffer.toString("base64");
      logoSvgElement = `<image x="${placement.x}" y="${placement.y}" width="${placement.width}" href="data:image/png;base64,${logoB64}" preserveAspectRatio="xMinYMin meet"/>`;
    }

    const textSvg = Buffer.from(
      `<svg width="${dims.width}" height="${dims.height}">
        ${logoSvgElement}
        <text x="${centerX}" y="${Math.round(nameY)}"
              font-family="${escapeXml(options.typography.heading.fontFamily)}"
              font-size="${headingSize}" font-weight="${options.typography.heading.fontWeight}"
              fill="${options.textColor}" text-anchor="middle" dominant-baseline="middle">
          ${escapeXml(productName)}
        </text>
        <text x="${centerX}" y="${Math.round(descY)}"
              font-family="${escapeXml(options.typography.body.fontFamily)}"
              font-size="${bodySize}" font-weight="${options.typography.body.fontWeight}"
              fill="${options.textColor}" text-anchor="middle" dominant-baseline="middle">
          ${escapeXml(productDescription)}
        </text>
        <text x="${centerX}" y="${Math.round(messageY)}"
              font-family="${escapeXml(options.typography.subheading.fontFamily)}"
              font-size="${subheadingSize}" font-weight="${options.typography.subheading.fontWeight}"
              fill="${options.textColor}" text-anchor="middle" dominant-baseline="middle">
          ${escapeXml(campaignMessage)}
        </text>
      </svg>`,
    );

    logger.info("overlay-text", `Compositing text on ${asset.productId} (${asset.aspectRatio})`);

    const inputBuffer = await readFile(asset.localPath);

    const composites: sharp.OverlayOptions[] = [
      { input: banner, top: 0, left: 0 },
      { input: textSvg, top: 0, left: 0 },
    ];


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
