import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { AppConfig } from "./config.js";
import type { PipelineResult } from "./types.js";
import { parseBrief } from "./stages/parse-brief.js";
import { resolveAssets } from "./stages/resolve-assets.js";
import { generateImages } from "./stages/generate-images.js";
import { overlayText } from "./stages/overlay-text.js";
import { runComplianceChecks } from "./stages/compliance.js";
import { uploadAssets } from "./stages/upload-assets.js";
import { logger } from "./utils/logger.js";

export async function runPipeline(
  briefPath: string,
  outputDir: string,
  config: AppConfig,
): Promise<PipelineResult> {
  const projectRoot = process.cwd();
  const absOutputDir = resolve(projectRoot, outputDir);
  await mkdir(absOutputDir, { recursive: true });

  const timing: Record<string, number> = {};
  const totalStart = Date.now();

  function startStage(name: string): () => void {
    const start = Date.now();
    return () => {
      timing[name] = Date.now() - start;
    };
  }

  // Stage 1: Parse brief
  let end = startStage("parse-brief");
  const brief = await parseBrief(briefPath);
  end();

  // Stage 2: Resolve existing assets
  end = startStage("resolve-assets");
  const manifest = await resolveAssets(brief, projectRoot);
  end();

  // Stage 3: Generate missing images
  end = startStage("generate-images");
  const rawAssets = await generateImages(manifest, absOutputDir, config.falKey);
  end();

  // Stage 4: Text overlay
  end = startStage("overlay-text");
  const composited = await overlayText(rawAssets, brief.campaign.message, absOutputDir);
  end();

  // Stage 5: Compliance checks
  end = startStage("compliance");
  const compliance = await runComplianceChecks(composited, brief);
  end();

  // Stage 6: Upload to Cloudinary
  end = startStage("upload");
  const uploaded = await uploadAssets(composited, brief.campaign.name, config.cloudinaryUrl);
  end();

  const totalTime = Date.now() - totalStart;

  const result: PipelineResult = {
    brief,
    assets: uploaded,
    compliance,
    timing: { total: totalTime, stages: timing },
  };

  // Write report
  const reportPath = resolve(absOutputDir, "report.json");
  const report = {
    campaign: brief.campaign.name,
    generatedAt: new Date().toISOString(),
    products: brief.products.map((p) => ({
      id: p.id,
      name: p.name,
      assets: uploaded
        .filter((a) => a.productId === p.id)
        .map((a) => ({
          aspectRatio: a.aspectRatio,
          localPath: a.localPath,
          cloudinaryUrl: a.cloudinaryUrl ?? null,
          reused: rawAssets.find(
            (r) => r.productId === a.productId && r.aspectRatio === a.aspectRatio,
          )?.reused ?? false,
        })),
    })),
    compliance,
    timing: { total: totalTime, stages: timing },
  };
  await writeFile(reportPath, JSON.stringify(report, null, 2));
  logger.info("pipeline", `Report written to ${reportPath}`);
  logger.info("pipeline", `Pipeline complete in ${totalTime}ms`);

  return result;
}
