import { readFile } from "node:fs/promises";
import { campaignBriefSchema, type CampaignBrief } from "../schemas/brief.js";
import { logger } from "../utils/logger.js";

export async function parseBrief(briefPath: string): Promise<CampaignBrief> {
  logger.info("parse-brief", `Reading brief from ${briefPath}`);

  const raw = await readFile(briefPath, "utf-8");
  const json = JSON.parse(raw);
  const result = campaignBriefSchema.safeParse(json);

  if (!result.success) {
    const errors = result.error.issues
      .map((i) => `  - ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Invalid campaign brief:\n${errors}`);
  }

  logger.info(
    "parse-brief",
    `Campaign "${result.data.campaign.name}" with ${result.data.products.length} product(s)`,
  );
  return result.data;
}
