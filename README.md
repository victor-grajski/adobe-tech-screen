# Creative Automation Pipeline

A Node.js pipeline that automates creative asset generation for social ad campaigns using GenAI. Given a campaign brief (JSON), it generates product images, resizes to multiple aspect ratios, overlays campaign text, runs compliance checks, and uploads to Cloudinary.

## Architecture

```
Campaign Brief (JSON)
       │
       ▼
[1] Parse & Validate Brief (Zod)
       │
       ▼
[2] Resolve Assets (reuse existing or mark for generation)
       │
       ▼
[3] Generate Missing Images (fal.ai FLUX Schnell)
       │   generates at each target aspect ratio directly
       │
       ▼
[4] Text Overlay (sharp)
       │   semi-transparent banner + campaign message
       │
       ▼
[5] Compliance Checks
       │   prohibited words + brand color analysis
       │
       ▼
[6] Upload to Cloudinary + Save Locally
       │
       ▼
[7] Generate Report (report.json)
```

## Prerequisites

- Node.js 20+
- A [fal.ai](https://fal.ai) API key (required for image generation)
- A [Cloudinary](https://cloudinary.com) account (optional — uploads are skipped if not configured)

## Setup

```bash
npm install
cp .env.example .env
# Edit .env with your API keys:
#   FAL_KEY=your_fal_ai_key
#   CLOUDINARY_URL=cloudinary://API_KEY:API_SECRET@CLOUD_NAME
```

## Usage

```bash
# Run with tsx (development)
npm run dev -- generate --brief examples/campaign-brief.json

# Or build and run compiled JS
npm run build
npm start -- generate --brief examples/campaign-brief.json

# Custom output directory
npm run dev -- generate --brief examples/campaign-brief.json --output my-output
```

## Campaign Brief Format

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
      "description": "Lightweight performance running shoes",
      "imagePrompt": "Professional product photo of modern white running shoes...",
      "existingAssetDir": "examples/assets/product-a"
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

### Key fields

- **`existingAssetDir`** (optional): Path to a directory with pre-existing images. If an image is found here, it's reused instead of calling the GenAI API — saving cost and time.
- **`imagePrompt`**: Prompt sent to FLUX Schnell for image generation.
- **`aspectRatios`**: Output dimensions. `1:1` → 1080×1080, `9:16` → 1080×1920, `16:9` → 1920×1080.

## Output

```
output/
  product-a/
    1x1/creative.png      # Text-overlaid creative
    9x16/creative.png
    16x9/creative.png
  product-b/
    1x1/creative.png
    9x16/creative.png
    16x9/creative.png
  report.json              # Structured pipeline results
```

The `report.json` includes: products processed, assets reused vs. generated, compliance results, Cloudinary URLs (if uploaded), and per-stage timing.

## Design Decisions

1. **Direct ratio generation over crop-from-square**: Each aspect ratio is generated natively at the target dimensions via fal.ai, producing better compositions than cropping a single square image.

2. **Asset reuse**: Products can point to existing image directories. The pipeline checks for images there first and only calls GenAI for missing assets — reduces API calls and cost.

3. **Sharp for text overlay**: Using sharp's SVG compositing instead of a cloud service keeps text overlay fast, offline, and free. The semi-transparent banner ensures readability over any background.

4. **Zod schema validation**: The campaign brief is validated upfront with descriptive error messages, failing fast before any expensive API calls.

5. **Cloudinary as optional**: The pipeline works fully offline with just `FAL_KEY`. Cloudinary upload is a bonus that activates when `CLOUDINARY_URL` is set.

6. **Stage-based pipeline**: Each stage is independent and testable. The orchestrator sequences them and tracks timing per stage for observability.

## Limitations

- Text overlay uses SVG text rendering, which doesn't support custom font files (uses system sans-serif).
- The compliance color check is approximate — GenAI images rarely match brand colors exactly, so the threshold is lenient.
- No retry/backoff on fal.ai API failures (would add for production use).
- Single-threaded generation — could parallelize across products for faster throughput.

## Tech Stack

| Concern | Tool |
|---------|------|
| Runtime | Node.js 20+ (ESM) |
| Language | TypeScript |
| CLI | commander |
| Validation | zod |
| Image gen | fal.ai (FLUX Schnell) |
| Image processing | sharp |
| Cloud storage | Cloudinary |
| Env config | dotenv |
