import type { CampaignBrief, BrandGuidelines, BrandColors } from "../schemas/brief.js";

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
  const { identity, colors } = guidelines;

  const colorList = [
    colors.text,
    colors.background,
    ...colors.accent.map((a) => a.hex),
  ];
  const uniqueColors = [...new Set(colorList)].join(", ");

  const values = identity.values.join(", ");

  return (
    `Brand aesthetic: ${identity.description} ` +
    `Colors: ${uniqueColors}. ` +
    `Values: ${values}. ` +
    `Leave clean space in upper-left corner and bottom 15% for text overlay`
  );
}
