import type { AspectRatio, CampaignBrief } from "./schemas/brief.js";

export interface LogoPlacement { x: number; y: number; width: number; height: number }

export interface AssetEntry {
  productId: string;
  aspectRatio: AspectRatio;
  sourcePath: string;
  reused: boolean;
}

export interface AssetManifest {
  existing: AssetEntry[];
  missing: { productId: string; aspectRatio: AspectRatio; imagePrompt: string }[];
}

export interface GeneratedAsset {
  productId: string;
  aspectRatio: AspectRatio;
  localPath: string;
  reused: boolean;
}

export interface OverlayOptions {
  typography: {
    heading: { fontFamily: string; fontSize: string; fontWeight: string };
    subheading: { fontFamily: string; fontSize: string; fontWeight: string };
    body: { fontFamily: string; fontSize: string; fontWeight: string };
  };
  textColor: string;
  bannerBackground: string;
  logoPath: string;
  projectRoot: string;
}

export interface ComplianceResult {
  productId: string;
  aspectRatio: string;
  passed: boolean;
  issues: string[];
  warnings: string[];
  checks: {
    prohibitedWords: { passed: boolean; flagged: string[] };
    brandColor: { passed: boolean; closestColor: string; distance: number };
    logoPresent: { passed: boolean };
    positiveKeywords: { passed: boolean; found: string[]; suggested: string[] };
  };
}

export interface UploadedAsset {
  productId: string;
  aspectRatio: AspectRatio;
  localPath: string;
  cloudinaryUrl?: string;
}

export interface SuccessMetrics {
  timeSaved: {
    manualEstimateMs: number;
    pipelineMs: number;
    savedMs: number;
    speedupFactor: string;
    manualPerCreativeFormatted: string;
    manualEstimateFormatted: string;
    pipelineFormatted: string;
    savedFormatted: string;
  };
  volume: {
    totalCreatives: number;
    productsProcessed: number;
    aspectRatiosPerProduct: number;
    assetsGenerated: number;
    assetsReused: number;
    locale: string;
  };
  efficiency: {
    assetReuseRate: string;
    compliancePassRate: string;
    throughputPerMinute: string;
    stageBreakdown: Record<string, string>;
  };
}

export interface PipelineResult {
  brief: CampaignBrief;
  assets: UploadedAsset[];
  compliance: ComplianceResult[];
  timing: {
    total: number;
    stages: Record<string, number>;
  };
  successMetrics: SuccessMetrics;
}
