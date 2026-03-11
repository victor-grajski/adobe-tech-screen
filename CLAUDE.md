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
Pipeline stages in `src/stages/`: parse-brief → resolve-assets → generate-images → overlay-text → compliance → upload-assets. Orchestrated by `src/pipeline.ts`, CLI in `src/index.ts`. The overlay stage composites product name (heading), description (body), and campaign message (subheading) onto a brand-colored banner, plus logo at top-left.

## File Structure
- `src/index.ts` — CLI entry point (commander)
- `src/pipeline.ts` — Stage orchestrator, localization resolution, overlay options wiring, report generation
- `src/config.ts` — Env var loading/validation
- `src/types.ts` — Shared TypeScript types (OverlayOptions, ComplianceResult with structured checks)
- `src/schemas/brief.ts` — Zod schema for campaign brief (brand colors, typography, identity, logo, localized messages)
- `src/stages/` — One file per pipeline stage
- `src/utils/logger.ts` — Colored console logger
- `src/utils/image-helpers.ts` — Image download + dimension map
- `src/utils/brand-helpers.ts` — Locale resolution, brand color aggregation, font size parsing, prompt context builder
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

## Compliance Checks
Four structured checks per product:
1. **Prohibited words** — phrase-aware word boundary matching (hard failure)
2. **Brand color** — dominant color distance against all brand colors (soft warning)
3. **Logo present** — verifies logo file exists (hard failure)
4. **Positive keywords** — checks message for brand keywords, suggests missing ones (soft warning)

## Environment Variables
- `FAL_KEY` — fal.ai API key (required)
- `CLOUDINARY_URL` — Cloudinary connection string (optional, uploads skipped if absent)
