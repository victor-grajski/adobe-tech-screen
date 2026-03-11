import type { AspectRatio, CampaignBrief } from "./schemas/brief.js";

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

export interface ComplianceResult {
  productId: string;
  passed: boolean;
  issues: string[];
}

export interface UploadedAsset {
  productId: string;
  aspectRatio: AspectRatio;
  localPath: string;
  cloudinaryUrl?: string;
}

export interface PipelineResult {
  brief: CampaignBrief;
  assets: UploadedAsset[];
  compliance: ComplianceResult[];
  timing: {
    total: number;
    stages: Record<string, number>;
  };
}
