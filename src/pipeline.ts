import { writeFile, mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import type { AppConfig } from "./config.js";
import type { OverlayOptions, PipelineResult } from "./types.js";
import { parseBrief } from "./stages/parse-brief.js";
import { resolveAssets } from "./stages/resolve-assets.js";
import { generateImages } from "./stages/generate-images.js";
import { overlayText } from "./stages/overlay-text.js";
import { runComplianceChecks } from "./stages/compliance.js";
import { uploadAssets } from "./stages/upload-assets.js";
import { resolveLocalizedMessage } from "./utils/brand-helpers.js";
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

  // Resolve localized message and build overlay options
  const resolvedMessage = resolveLocalizedMessage(brief.campaign);
  const { brandGuidelines } = brief;

  // Banner uses text color as background when the brand background is light;
  // overlay text uses the opposite color for contrast.
  const useDarkBanner = brandGuidelines.colors.background.toUpperCase() >= "#C00000";
  const bannerBackground = useDarkBanner
    ? brandGuidelines.colors.text
    : brandGuidelines.colors.background;
  const overlayTextColor = useDarkBanner
    ? brandGuidelines.colors.background
    : brandGuidelines.colors.text;

  const overlayOptions: OverlayOptions = {
    typography: brandGuidelines.typography,
    textColor: overlayTextColor,
    bannerBackground,
    logoPath: brandGuidelines.logoPath,
    projectRoot,
  };

  logger.info("pipeline", `Locale: ${brief.campaign.locale}, resolved message: "${resolvedMessage}"`);

  // Stage 2: Resolve existing assets
  end = startStage("resolve-assets");
  const manifest = await resolveAssets(brief, projectRoot);
  end();

  // Stage 3: Generate missing images (with brand context in prompts)
  end = startStage("generate-images");
  const rawAssets = await generateImages(manifest, absOutputDir, config.falKey, brandGuidelines);
  end();

  // Stage 4: Text overlay (with brand typography, logo, colors)
  end = startStage("overlay-text");
  const composited = await overlayText(rawAssets, resolvedMessage, absOutputDir, overlayOptions);
  end();

  // Stage 5: Compliance checks (with resolved message and brand guidelines)
  end = startStage("compliance");
  const compliance = await runComplianceChecks(composited, resolvedMessage, brandGuidelines, projectRoot);
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
    locale: brief.campaign.locale,
    resolvedMessage,
    generatedAt: new Date().toISOString(),
    brandIdentity: {
      description: brandGuidelines.identity.description,
      mission: brandGuidelines.identity.mission,
      vision: brandGuidelines.identity.vision,
      values: brandGuidelines.identity.values,
    },
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
