import type { CampaignBrief, BrandGuidelines, BrandColors, Product, AspectRatio } from "../schemas/brief.js";
import type { LogoPlacement } from "../types.js";
import { DIMENSION_MAP } from "./image-helpers.js";

/**
 * Resolves the campaign message for the current locale.
 * Falls back: exact locale → language-only match → default message.
 */
export function resolveLocalizedMessage(campaign: CampaignBrief["campaign"]): string {
  const { locale, message, localizedMessages } = campaign;
  if (!localizedMessages) return message;

  // Exact match (e.g. "es-MX")
  if (localizedMessages[locale]) return localizedMessages[locale];

  // Language-only match (e.g. "es" from "es-MX")
  const lang = locale.split("-")[0];
  const langMatch = Object.keys(localizedMessages).find(
    (key) => key.split("-")[0] === lang,
  );
  if (langMatch) return localizedMessages[langMatch];

  return message;
}

/**
 * Resolves localized product fields for the current locale.
 * Falls back: exact locale → language-only match → default fields.
 */
export function resolveLocalizedProduct(product: Product, locale: string): Product {
  if (!product.localizedFields) return product;

  const fields =
    product.localizedFields[locale] ??
    product.localizedFields[
      Object.keys(product.localizedFields).find(
        (key) => key.split("-")[0] === locale.split("-")[0],
      ) ?? ""
    ];

  if (!fields) return product;

  return {
    ...product,
    name: fields.name ?? product.name,
    description: fields.description ?? product.description,
  };
}

/**
 * Aggregates all brand colors into a flat list for compliance checking.
 */
export function getAllBrandColors(
  colors: BrandColors,
): { hex: string; label: string }[] {
  const result: { hex: string; label: string }[] = [
    { hex: colors.text, label: "text" },
    { hex: colors.background, label: "background" },
  ];
  for (const accent of colors.accent) {
    result.push({
      hex: accent.hex,
      label: accent.description ?? "accent",
    });
  }
  return result;
}

/**
 * Parses a fontSize string (e.g. "50pt", "4%") into a pixel value
 * relative to the given reference dimension (typically image width).
 */
export function parseFontSize(fontSize: string, referencePx: number): number {
  if (fontSize.endsWith("pt")) {
    // Treat pt as roughly 1:1 with px for screen rendering
    return parseInt(fontSize.replace("pt", ""), 10);
  }
  if (fontSize.endsWith("%")) {
    const pct = parseFloat(fontSize.replace("%", ""));
    return Math.round((pct / 100) * referencePx);
  }
  return parseInt(fontSize, 10) || Math.round(referencePx * 0.04);
}

/**
 * Builds a brand context string to append to fal.ai image prompts.
 */
export function buildBrandPromptContext(guidelines: BrandGuidelines): string {
  const { identity, colors, positiveKeywords, prohibitedWords } = guidelines;

  const colorList = [
    colors.text,
    colors.background,
    ...colors.accent.map((a) => a.hex),
  ];
  const uniqueColors = [...new Set(colorList)].join(", ");

  const values = identity.values.join(", ");

  let context =
    `Brand aesthetic: ${identity.description} ` +
    `Mission: ${identity.mission}. ` +
    `Purpose: ${identity.purpose}. ` +
    `Vision: ${identity.vision}. ` +
    `Colors: ${uniqueColors}. ` +
    `Values: ${values}. `;

  if (positiveKeywords.length > 0) {
    context += `Positive keywords to embody: ${positiveKeywords.join(", ")}. `;
  }
  if (prohibitedWords.length > 0) {
    context += `Avoid depicting: ${prohibitedWords.join(", ")}. `;
  }

  context += `Leave clean space in upper-left corner and bottom 15% for text overlay`;

  return context;
}

/**
 * Computes the logo bounding box for a given aspect ratio and logo intrinsic dimensions.
 * Mirrors the placement logic used in overlay-text.
 */
export function computeLogoPlacement(
  aspectRatio: AspectRatio,
  logoIntrinsic: { width: number; height: number },
): LogoPlacement {
  const dims = DIMENSION_MAP[aspectRatio];
  const logoScale = aspectRatio === "16:9" ? 0.1 : 0.18;
  const logoWidth = Math.round(dims.width * logoScale);
  const logoHeight = Math.round(logoWidth * (logoIntrinsic.height / logoIntrinsic.width));
  const margin = Math.round(dims.width * 0.03);
  return { x: margin, y: margin, width: logoWidth, height: logoHeight };
}
