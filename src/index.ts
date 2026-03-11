#!/usr/bin/env node
import { Command } from "commander";
import { loadConfig } from "./config.js";
import { runPipeline } from "./pipeline.js";
import { logger } from "./utils/logger.js";

const program = new Command();

program
  .name("creative-pipeline")
  .description("Creative automation pipeline for social ad campaigns")
  .version("1.0.0");

program
  .command("generate")
  .description("Generate creative assets from a campaign brief")
  .requiredOption("-b, --brief <path>", "Path to campaign brief JSON")
  .option("-o, --output <dir>", "Output directory", "output")
  .option("-l, --locale <code>", "Override locale from brief (e.g. es-MX, fr-FR)")
  .action(async (opts: { brief: string; output: string; locale?: string }) => {
    try {
      const config = loadConfig();
      const result = await runPipeline(opts.brief, opts.output, config, opts.locale);

      console.log("\n========================================");
      console.log("  Pipeline Complete");
      console.log("========================================");
      console.log(`  Campaign: ${result.brief.campaign.name}`);
      console.log(`  Assets:   ${result.assets.length}`);
      console.log(`  Time:     ${result.timing.total}ms`);
      console.log(`  Output:   ${opts.output}/`);
      console.log("========================================\n");
    } catch (err) {
      logger.error("cli", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parse();
