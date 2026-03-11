import { writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import type { AspectRatio } from "../schemas/brief.js";

export const DIMENSION_MAP: Record<AspectRatio, { width: number; height: number }> = {
  "1:1": { width: 1080, height: 1080 },
  "9:16": { width: 1080, height: 1920 },
  "16:9": { width: 1920, height: 1080 },
};

export async function downloadImage(url: string, destPath: string): Promise<void> {
  await mkdir(dirname(destPath), { recursive: true });
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to download image: ${response.status} ${response.statusText}`);
  }
  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(destPath, buffer);
}
