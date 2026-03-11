import { v2 as cloudinary } from "cloudinary";
import type { GeneratedAsset, UploadedAsset } from "../types.js";
import { logger } from "../utils/logger.js";

export async function uploadAssets(
  assets: GeneratedAsset[],
  campaignName: string,
  cloudinaryUrl: string | undefined,
): Promise<UploadedAsset[]> {
  if (!cloudinaryUrl) {
    logger.warn("upload", "CLOUDINARY_URL not set — skipping upload");
    return assets.map((a) => ({ ...a, cloudinaryUrl: undefined }));
  }

  // cloudinary auto-configures from CLOUDINARY_URL env var
  cloudinary.config(true);

  const results: UploadedAsset[] = [];

  for (const asset of assets) {
    const folder = `campaigns/${slugify(campaignName)}/${asset.productId}/${asset.aspectRatio.replace(":", "x")}`;

    logger.info("upload", `Uploading ${asset.productId} (${asset.aspectRatio}) to ${folder}`);

    const uploadResult = await cloudinary.uploader.upload(asset.localPath, {
      folder,
      public_id: "creative",
      overwrite: true,
      resource_type: "image",
    });

    results.push({
      productId: asset.productId,
      aspectRatio: asset.aspectRatio,
      localPath: asset.localPath,
      cloudinaryUrl: uploadResult.secure_url,
    });
  }

  logger.info("upload", `Uploaded ${results.length} asset(s) to Cloudinary`);
  return results;
}

function slugify(str: string): string {
  return str.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}
