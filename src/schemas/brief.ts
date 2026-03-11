import { z } from "zod";

const hexRegex = /^#[0-9A-Fa-f]{6}$/;

const productSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string(),
  imagePrompt: z.string().min(1),
  existingAssetDir: z.string().optional(),
});

const typographyStyleSchema = z.object({
  fontFamily: z.string(),
  fontSize: z.string(),
  fontWeight: z.string().default("bold"),
});

const brandColorsSchema = z.object({
  text: z.string().regex(hexRegex, "Must be a hex color"),
  background: z.string().regex(hexRegex, "Must be a hex color"),
  accent: z
    .array(
      z.object({
        hex: z.string().regex(hexRegex, "Must be a hex color"),
        description: z.string().optional(),
      }),
    )
    .default([]),
});

const brandIdentitySchema = z.object({
  description: z.string(),
  mission: z.string(),
  purpose: z.string(),
  vision: z.string(),
  values: z.array(z.string()),
});

const brandGuidelinesSchema = z.object({
  colors: brandColorsSchema,
  typography: z.object({
    heading: typographyStyleSchema,
    subheading: typographyStyleSchema,
    body: typographyStyleSchema,
  }),
  positiveKeywords: z.array(z.string()).default([]),
  prohibitedWords: z.array(z.string()).default([]),
  identity: brandIdentitySchema,
  logoPath: z.string(),
});

const aspectRatioSchema = z.enum(["1:1", "9:16", "16:9"]);

export const campaignBriefSchema = z.object({
  campaign: z.object({
    name: z.string().min(1),
    message: z.string().min(1),
    localizedMessages: z.record(z.string(), z.string().min(1)).optional(),
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
export type BrandGuidelines = z.infer<typeof brandGuidelinesSchema>;
export type BrandColors = z.infer<typeof brandColorsSchema>;
export type TypographyStyle = z.infer<typeof typographyStyleSchema>;
