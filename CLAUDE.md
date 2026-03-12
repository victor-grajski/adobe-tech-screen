# CLAUDE.md

## Project
adobe-tech-screen — Creative automation pipeline for social ad campaigns using GenAI. Supports rich brand guidelines, localization, logo compositing, and structured compliance checks.

## Quick Start
```bash
npm install
cp .env.example .env   # Add FAL_KEY (required), CLOUDINARY_URL (optional)
npm run dev -- generate --brief examples/campaign-brief.json
```

## Tech Stack
- Node.js 20+ (ESM, `"type": "module"`)
- TypeScript compiled via `tsx` (dev) / `tsc` (build)
- Deps: commander, zod, sharp, @fal-ai/client, cloudinary, dotenv

## Key Commands
- `npm run dev -- generate --brief <path>` — Run pipeline with tsx
- `npm run dev -- generate --brief <path> --locale es-MX` — Run with locale override
- `npm run build` — Compile TypeScript to dist/
- `npm start -- generate --brief <path>` — Run compiled JS

## Architecture
Pipeline stages in `src/stages/`: parse-brief → resolve-assets → generate-images → overlay-text → compliance → upload-assets. Orchestrated by `src/pipeline.ts`, CLI in `src/index.ts`. The overlay stage composites product name (heading), description (body), and campaign message (subheading) onto a near-black semi-transparent banner with white text, plus logo at top-left.

## File Structure
- `src/index.ts` — CLI entry point (commander)
- `src/pipeline.ts` — Stage orchestrator, localization resolution, overlay options wiring, report generation, success metrics
- `src/config.ts` — Env var loading/validation
- `src/types.ts` — Shared TypeScript types (OverlayOptions, ComplianceResult, SuccessMetrics)
- `src/schemas/brief.ts` — Zod schema for campaign brief (brand colors, typography, identity, logo, localized messages)
- `src/stages/` — One file per pipeline stage
- `src/utils/logger.ts` — Colored console logger
- `src/utils/image-helpers.ts` — Image download + dimension map
- `src/utils/brand-helpers.ts` — Locale resolution (message + product fields), brand color aggregation, font size parsing, prompt context builder, WCAG relative luminance
- `src/utils/metrics.ts` — Success metrics computation (time saved, volume, efficiency)
- `examples/` — Sample campaign brief + pre-existing assets + brand logo
- `output/` — Generated output (gitignored)
- `dist/` — Compiled JS (gitignored)

## Brand Guidelines Schema
The brief's `brandGuidelines` object includes:
- `colors` — `text`, `background`, and `accent[]` (hex + description)
- `typography` — `heading` (product name), `subheading` (campaign message), `body` (product description) with fontFamily, fontSize, fontWeight
- `identity` — `description`, `mission`, `purpose`, `vision`, `values[]`
- `positiveKeywords[]` — Terms encouraged in campaign messaging
- `prohibitedWords[]` — Phrases that fail compliance
- `logoPath` — Required path to brand logo (composited on all creatives)

## Localization
Set `campaign.locale` (e.g. `"es-MX"`) and provide `campaign.localizedMessages` as a locale-to-string map. The pipeline resolves the message with exact match → language-only fallback → default `message`. The CLI `--locale` flag overrides the brief's locale.

Products support per-locale `localizedFields` (name, description) using the same fallback chain. When a locale is active, product names and descriptions on creatives are rendered in the target language.

## Compliance Checks
Four structured checks per product:
1. **Prohibited words** — phrase-aware word boundary matching (hard failure)
2. **Brand color** — dominant color distance against all brand colors (soft warning)
3. **Logo present** — verifies logo file exists (hard failure)
4. **Positive keywords** — checks message for brand keywords, suggests missing ones (soft warning)

## Success Metrics
The pipeline computes and reports three categories of success metrics (in CLI output and `report.json`):
- **Time saved** — Manual estimate (30 min/creative baseline) vs pipeline time, speedup factor
- **Volume** — Total creatives, products processed, aspect ratios, assets generated vs reused, locale
- **Efficiency** — Asset reuse rate, compliance pass rate, throughput (creatives/min), per-stage breakdown

Computed in `src/utils/metrics.ts`, wired through `src/pipeline.ts`, displayed in `src/index.ts`.

## Environment Variables
- `FAL_KEY` — fal.ai API key (required)
- `CLOUDINARY_URL` — Cloudinary connection string (optional, uploads skipped if absent)
