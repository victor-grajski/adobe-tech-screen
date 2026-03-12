import type { CampaignBrief } from "../schemas/brief.js";
import type { GeneratedAsset, ComplianceResult, SuccessMetrics } from "../types.js";

const MANUAL_MS_PER_CREATIVE = 30 * 60 * 1000; // 30 minutes

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60_000) return `${(ms / 1000).toFixed(1)} seconds`;
  if (ms < 3_600_000) return `${(ms / 60_000).toFixed(1)} minutes`;
  return `${(ms / 3_600_000).toFixed(1)} hours`;
}

export function computeSuccessMetrics(
  brief: CampaignBrief,
  rawAssets: GeneratedAsset[],
  composited: GeneratedAsset[],
  compliance: ComplianceResult[],
  timing: { total: number; stages: Record<string, number> },
): SuccessMetrics {
  const totalCreatives = composited.length;
  const manualEstimateMs = totalCreatives * MANUAL_MS_PER_CREATIVE;
  const pipelineMs = timing.total;
  const savedMs = Math.max(0, manualEstimateMs - pipelineMs);
  const speedupFactor = pipelineMs > 0
    ? `${Math.round(manualEstimateMs / pipelineMs)}x`
    : "N/A";

  const assetsGenerated = rawAssets.filter((a) => !a.reused).length;
  const assetsReused = rawAssets.filter((a) => a.reused).length;

  const reuseRate = rawAssets.length > 0
    ? ((assetsReused / rawAssets.length) * 100).toFixed(1) + "%"
    : "0.0%";

  const compliancePassed = compliance.filter((c) => c.passed).length;
  const compliancePassRate = compliance.length > 0
    ? ((compliancePassed / compliance.length) * 100).toFixed(1) + "%"
    : "100.0%";

  const throughputPerMinute = pipelineMs > 0
    ? ((totalCreatives / pipelineMs) * 60_000).toFixed(1)
    : "0.0";

  const totalStageMs = Object.values(timing.stages).reduce((s, v) => s + v, 0);
  const stageBreakdown: Record<string, string> = {};
  for (const [stage, ms] of Object.entries(timing.stages)) {
    stageBreakdown[stage] = totalStageMs > 0
      ? ((ms / totalStageMs) * 100).toFixed(1) + "%"
      : "0.0%";
  }

  return {
    timeSaved: {
      manualEstimateMs,
      pipelineMs,
      savedMs,
      speedupFactor,
      manualPerCreativeFormatted: formatDuration(MANUAL_MS_PER_CREATIVE),
      manualEstimateFormatted: formatDuration(manualEstimateMs),
      pipelineFormatted: formatDuration(pipelineMs),
      savedFormatted: formatDuration(savedMs),
    },
    volume: {
      totalCreatives,
      productsProcessed: brief.products.length,
      aspectRatiosPerProduct: brief.aspectRatios.length,
      assetsGenerated,
      assetsReused,
      locale: brief.campaign.locale,
    },
    efficiency: {
      assetReuseRate: reuseRate,
      compliancePassRate,
      throughputPerMinute,
      stageBreakdown,
    },
  };
}
