# CLAUDE.md

## Project
adobe-tech-screen — Creative automation pipeline for social ad campaigns using GenAI.

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
- `npm run build` — Compile TypeScript to dist/
- `npm start -- generate --brief <path>` — Run compiled JS

## Architecture
Pipeline stages in `src/stages/`: parse-brief → resolve-assets → generate-images → overlay-text → compliance → upload-assets. Orchestrated by `src/pipeline.ts`, CLI in `src/index.ts`.

## File Structure
- `src/index.ts` — CLI entry point (commander)
- `src/pipeline.ts` — Stage orchestrator + report generation
- `src/config.ts` — Env var loading/validation
- `src/types.ts` — Shared TypeScript types
- `src/schemas/brief.ts` — Zod schema for campaign brief
- `src/stages/` — One file per pipeline stage
- `src/utils/` — Logger, image download helper, dimension map
- `examples/` — Sample campaign brief + pre-existing assets
- `output/` — Generated output (gitignored)
- `dist/` — Compiled JS (gitignored)

## Environment Variables
- `FAL_KEY` — fal.ai API key (required)
- `CLOUDINARY_URL` — Cloudinary connection string (optional, uploads skipped if absent)
