import { fal } from "@fal-ai/client";
import { resolve } from "node:path";
import type { BrandGuidelines } from "../schemas/brief.js";
import type { AssetManifest, GeneratedAsset } from "../types.js";
import { DIMENSION_MAP, downloadImage } from "../utils/image-helpers.js";
import { buildBrandPromptContext } from "../utils/brand-helpers.js";
import { logger } from "../utils/logger.js";

export async function generateImages(
  manifest: AssetManifest,
  outputDir: string,
  falKey: string,
  brandGuidelines: BrandGuidelines,
): Promise<GeneratedAsset[]> {
  fal.config({ credentials: falKey });

  const brandContext = buildBrandPromptContext(brandGuidelines);
  const assets: GeneratedAsset[] = [];

  // Include reused assets as-is
  for (const entry of manifest.existing) {
    assets.push({
      productId: entry.productId,
      aspectRatio: entry.aspectRatio,
      localPath: entry.sourcePath,
      reused: true,
    });
  }

  // Generate missing assets
  for (const item of manifest.missing) {
    const dims = DIMENSION_MAP[item.aspectRatio];
    const ratioDir = item.aspectRatio.replace(":", "x");
    const destPath = resolve(outputDir, item.productId, ratioDir, "creative.png");

    const enhancedPrompt = `${item.imagePrompt}. ${brandContext}`;

    logger.info(
      "generate-images",
      `Generating ${item.productId} at ${item.aspectRatio} (${dims.width}x${dims.height})`,
    );

    const result = await fal.subscribe("fal-ai/flux/schnell", {
      input: {
        prompt: enhancedPrompt,
        image_size: { width: dims.width, height: dims.height },
        num_images: 1,
        num_inference_steps: 4,
      },
    });

    const imageUrl = result.data.images[0]?.url;
    if (!imageUrl) {
      throw new Error(`No image returned for ${item.productId} at ${item.aspectRatio}`);
    }

    await downloadImage(imageUrl, destPath);
    logger.info("generate-images", `Saved ${destPath}`);

    assets.push({
      productId: item.productId,
      aspectRatio: item.aspectRatio,
      localPath: destPath,
      reused: false,
    });
  }

  return assets;
}
