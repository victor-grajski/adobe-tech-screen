# Plan: Creative Automation Pipeline for Social Ad Campaigns

## Context
Adobe FDE take-home exercise. Build a POC that automates creative asset generation for social ad campaigns using GenAI. The pipeline accepts a campaign brief, generates/reuses images, resizes to 3 aspect ratios, overlays campaign text, and saves organized outputs. Must run locally, be demo-ready, and show thoughtful design.

## Tool Choices

### Image Generation: fal.ai (FLUX Schnell model)
- Supports all 3 required ratios: 1:1, 9:16, 16:9 with exact pixel dimensions
- Fast (4 inference steps) and cheap ($0.003/megapixel)
- SDK: `@fal-ai/client` — used directly in pipeline code
- MCP server available (`piebro/fal-ai-mcp-server`) for Claude Code-assisted iteration
- Requires `FAL_KEY` env var

### Storage: Cloudinary
- Upload via file path/URL/base64, automatic transformations, CDN delivery
- Free tier (~25GB storage)
- SDK: `cloudinary` npm package — used to upload final outputs
- MCP server available (`cloudinary/mcp-servers`) for Claude Code-assisted asset management
- Requires `CLOUDINARY_URL` env var

### Text Overlay: sharp (local, no cloud dependency)
- Native `composite()` with Pango text rendering
- Semi-transparent banner + white text pattern
- Zero cost, offline, fast

## Architecture

```
Campaign Brief (JSON)
       │
       ▼
[1] Parse & Validate Brief (zod)
       │
       ▼
[2] Resolve Assets (check local folders for existing images)
       │
       ▼
[3] Generate Missing Images (fal.ai FLUX Schnell)
       │   ─ generates at each target aspect ratio directly
       │
       ▼
[4] Text Overlay (sharp composite)
       │   ─ semi-transparent banner + campaign message
       │
       ▼
[5] Compliance Checks (bonus)
       │   ─ prohibited words scan
       │   ─ brand color presence check
       │
       ▼
[6] Upload to Cloudinary + Save Locally
       │
       ▼
[7] Generate Report (report.json)
```

## Tech Stack
- **Runtime**: Node.js 20+ (ESM, `"type": "module"`)
- **Language**: TypeScript (compiled via `tsx` for dev, `tsc` for build)
- **CLI**: `commander`
- **Image gen**: `@fal-ai/client`
- **Image processing**: `sharp` + `@types/sharp`
- **Validation**: `zod` (infer types from schemas)
- **Storage**: `cloudinary`
- **Env**: `dotenv`

## File Structure

```
adobe-tech-screen/
├── package.json
├── tsconfig.json
├── .env.example                # FAL_KEY=, CLOUDINARY_URL=
├── .gitignore
├── README.md
├── CLAUDE.md
├── src/
│   ├── index.ts                # CLI entry point (commander)
│   ├── pipeline.ts             # Main orchestrator
│   ├── config.ts               # Load .env, validate env vars
│   ├── types.ts                # Shared types (inferred from Zod + pipeline types)
│   ├── schemas/
│   │   └── brief.ts            # Zod schema for campaign brief (types inferred via z.infer)
│   ├── stages/
│   │   ├── parse-brief.ts      # Parse + validate JSON brief
│   │   ├── resolve-assets.ts   # Check for existing assets
│   │   ├── generate-images.ts  # fal.ai image generation
│   │   ├── overlay-text.ts     # sharp text compositing
│   │   ├── compliance.ts       # Brand/legal checks (bonus)
│   │   └── upload-assets.ts    # Cloudinary upload
│   └── utils/
│       ├── logger.ts           # Structured logging
│       └── image-helpers.ts    # Download image from URL, etc.
├── examples/
│   ├── campaign-brief.json     # Example input
│   └── assets/                 # Pre-existing assets
│       ├── product-a/
│       │   └── hero.png
│       └── product-b/          # (empty — triggers generation)
└── output/                     # Generated output (gitignored)
    ├── <product-id>/
    │   ├── 1x1/creative.png
    │   ├── 9x16/creative.png
    │   └── 16x9/creative.png
    └── report.json
```

## Campaign Brief Schema (JSON)

```json
{
  "campaign": {
    "name": "Summer Sale 2025",
    "message": "Up to 50% Off — Limited Time Only",
    "region": "US",
    "locale": "en-US",
    "audience": "Young professionals aged 25-35"
  },
  "products": [
    {
      "id": "product-a",
      "name": "UltraBoost Running Shoes",
      "description": "Lightweight performance running shoes with responsive cushioning",
      "imagePrompt": "Professional product photo of modern white running shoes on clean minimal background, studio lighting",
      "existingAssetDir": "examples/assets/product-a"
    },
    {
      "id": "product-b",
      "name": "CloudWalk Sandals",
      "description": "Comfortable everyday sandals with memory foam insole",
      "imagePrompt": "Professional product photo of stylish brown leather sandals on clean minimal background, studio lighting"
    }
  ],
  "brandGuidelines": {
    "primaryColor": "#FF5733",
    "secondaryColor": "#1A1A2E",
    "prohibitedWords": ["cheap", "guarantee", "miracle"]
  },
  "aspectRatios": ["1:1", "9:16", "16:9"]
}
```

## Implementation Order

### Step 0: Account Setup & MCP Configuration (~10 min)
1. **fal.ai**: Sign up at https://fal.ai → Dashboard → API Keys → create key → save as `FAL_KEY`
2. **Cloudinary**: Sign up at https://cloudinary.com → Dashboard → copy `CLOUDINARY_URL` (format: `cloudinary://API_KEY:API_SECRET@CLOUD_NAME`)
3. **Configure MCP servers in Claude Code**:
   - fal.ai MCP: Add to Claude Code settings with `FAL_KEY` env var
   - Cloudinary MCP: Add to Claude Code settings with `CLOUDINARY_URL` env var
4. Create `.env` in project root with both keys

### Step 1: Scaffolding (~10 min)
- `npm init`, set `"type": "module"`, install deps
- Install dev deps: `typescript`, `tsx`, `@types/node`, `@types/sharp`
- Create `tsconfig.json` (target ES2022, module NodeNext, strict mode)
- Create directory structure, `.env.example`, `src/config.ts`
- Set up CLI with commander in `src/index.ts`
- Add scripts: `"dev": "tsx src/index.ts"`, `"build": "tsc"`, `"start": "node dist/index.js"`

### Step 2: Types & Brief Parsing (~15 min)
- Define Zod schema in `src/schemas/brief.ts`, export inferred types via `z.infer`
- Define pipeline types in `src/types.ts` (AssetManifest, PipelineResult, etc.)
- Implement `src/stages/parse-brief.ts`
- Create `examples/campaign-brief.json`

### Step 3: Asset Resolution (~15 min)
- Implement `src/stages/resolve-assets.ts`
- Check `existingAssetDir` for each product, return typed manifest of what exists vs. needs generation

### Step 4: Image Generation (~25 min)
- Implement `src/stages/generate-images.ts`
- Call `fal.run("fal-ai/flux/schnell")` per product per aspect ratio
- Generate directly at target dimensions (not crop from square)
- Dimension map: 1:1→1080x1080, 9:16→1080x1920, 16:9→1920x1080
- Download result URLs to local files

### Step 5: Text Overlay (~25 min)
- Implement `src/stages/overlay-text.ts`
- Semi-transparent dark banner (bottom 15% of image, black at 60% opacity)
- White campaign message text, centered, font size = 4% of width
- Use sharp's `composite()` with SVG text rendering

### Step 6: Cloudinary Upload (~15 min)
- Implement `src/stages/upload-assets.ts`
- Upload each final creative to Cloudinary with folder organization
- Store CDN URLs in the report

### Step 7: Pipeline Orchestrator (~15 min)
- Implement `src/pipeline.ts` — sequences all stages
- Wire into CLI: `npm start -- generate --brief examples/campaign-brief.json`

### Step 8: Bonus Features (~15 min)
- Prohibited words check (string matching against word list)
- Brand color presence check (sharp `stats()` + color distance)
- Structured report.json with: products processed, assets reused vs generated, compliance results, output paths, timing

### Step 9: Documentation (~15 min)
- Rewrite README.md with: overview, architecture, prerequisites, install/run steps, example I/O, design decisions, limitations
- Update CLAUDE.md

## Output Organization

```
output/
  product-a/
    1x1/creative.png
    9x16/creative.png
    16x9/creative.png
  product-b/
    1x1/creative.png
    9x16/creative.png
    16x9/creative.png
  report.json
```

## Verification
1. `npm install` succeeds
2. `npm start -- generate --brief examples/campaign-brief.json` runs end-to-end
3. Output folder contains 6 images (2 products x 3 ratios) with visible text overlays
4. `report.json` contains structured results
5. Cloudinary dashboard shows uploaded assets (if CLOUDINARY_URL configured)
6. Running with a pre-existing asset in `examples/assets/product-a/hero.png` reuses it instead of generating

## MCP Server Setup (for Claude Code workflow)
Configure in Claude Code settings to enable AI-assisted iteration:
- **fal.ai MCP**: `uvx fal-ai-mcp-server` with `FAL_KEY` env var
- **Cloudinary MCP**: `npx @cloudinary/mcp-server` with `CLOUDINARY_URL` env var
