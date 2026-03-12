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

      const m = result.successMetrics;
      console.log("\n========================================");
      console.log("  Pipeline Complete");
      console.log("========================================");
      console.log(`  Campaign:    ${result.brief.campaign.name}`);
      console.log(`  Locale:      ${m.volume.locale}`);
      console.log(`  Assets:      ${result.assets.length}`);
      console.log("----------------------------------------");
      console.log("  Time Saved");
      console.log(`    Manual estimate:  ${m.timeSaved.manualEstimateFormatted}`);
      console.log(`    Pipeline time:    ${m.timeSaved.pipelineFormatted}`);
      console.log(`    Time saved:       ${m.timeSaved.savedFormatted}`);
      console.log(`    Speedup:          ${m.timeSaved.speedupFactor} faster`);
      console.log("----------------------------------------");
      console.log("  Volume");
      console.log(`    Creatives:    ${m.volume.totalCreatives} (${m.volume.productsProcessed} products x ${m.volume.aspectRatiosPerProduct} ratios)`);
      console.log(`    Generated:    ${m.volume.assetsGenerated} new, ${m.volume.assetsReused} reused`);
      console.log("----------------------------------------");
      console.log("  Efficiency");
      console.log(`    Reuse rate:       ${m.efficiency.assetReuseRate}`);
      console.log(`    Compliance:       ${m.efficiency.compliancePassRate} pass rate`);
      console.log(`    Throughput:       ${m.efficiency.throughputPerMinute} creatives/min`);
      console.log("----------------------------------------");
      console.log(`  Output:  ${opts.output}/`);
      console.log("========================================\n");
    } catch (err) {
      logger.error("cli", err instanceof Error ? err.message : String(err));
      process.exit(1);
    }
  });

program.parse();
