import { access } from "node:fs/promises";
import { resolve } from "node:path";
import { readdir } from "node:fs/promises";
import type { CampaignBrief } from "../schemas/brief.js";
import type { AssetManifest } from "../types.js";
import { logger } from "../utils/logger.js";

const IMAGE_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp"]);

async function findExistingImage(dir: string): Promise<string | null> {
  try {
    await access(dir);
    const files = await readdir(dir);
    const image = files.find((f) => {
      const ext = f.slice(f.lastIndexOf(".")).toLowerCase();
      return IMAGE_EXTENSIONS.has(ext);
    });
    return image ? resolve(dir, image) : null;
  } catch {
    return null;
  }
}

export async function resolveAssets(
  brief: CampaignBrief,
  projectRoot: string,
): Promise<AssetManifest> {
  const manifest: AssetManifest = { existing: [], missing: [] };

  for (const product of brief.products) {
    for (const ratio of brief.aspectRatios) {
      if (product.existingAssetDir) {
        const absDir = resolve(projectRoot, product.existingAssetDir);
        const existingImage = await findExistingImage(absDir);

        if (existingImage) {
          logger.info(
            "resolve-assets",
            `Reusing existing asset for ${product.id} (${ratio}): ${existingImage}`,
          );
          manifest.existing.push({
            productId: product.id,
            aspectRatio: ratio,
            sourcePath: existingImage,
            reused: true,
          });
          continue;
        }
      }

      logger.info("resolve-assets", `Will generate ${product.id} at ${ratio}`);
      manifest.missing.push({
        productId: product.id,
        aspectRatio: ratio,
        imagePrompt: product.imagePrompt,
      });
    }
  }

  logger.info(
    "resolve-assets",
    `${manifest.existing.length} existing, ${manifest.missing.length} to generate`,
  );
  return manifest;
}
