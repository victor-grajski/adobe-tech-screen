import { z } from "zod";

const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  imagePrompt: z.string().min(1),
  existingAssetDir: z.string().optional(),
});

const brandGuidelinesSchema = z.object({
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color"),
  secondaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/, "Must be a hex color"),
  prohibitedWords: z.array(z.string()).default([]),
});

const aspectRatioSchema = z.enum(["1:1", "9:16", "16:9"]);

export const campaignBriefSchema = z.object({
  campaign: z.object({
    name: z.string().min(1),
    message: z.string().min(1),
    region: z.string().default("US"),
    locale: z.string().default("en-US"),
    audience: z.string().optional(),
  }),
  products: z.array(productSchema).min(1),
  brandGuidelines: brandGuidelinesSchema,
  aspectRatios: z.array(aspectRatioSchema).min(1).default(["1:1", "9:16", "16:9"]),
});

export type CampaignBrief = z.infer<typeof campaignBriefSchema>;
export type Product = z.infer<typeof productSchema>;
export type AspectRatio = z.infer<typeof aspectRatioSchema>;
