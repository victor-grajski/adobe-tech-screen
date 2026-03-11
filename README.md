# Creative Automation Pipeline

A Node.js pipeline that automates creative asset generation for social ad campaigns using GenAI. Given a campaign brief (JSON), it generates brand-aware product images, composites logos and campaign text with brand typography, runs structured compliance checks, and uploads to Cloudinary.

## Architecture

```
Campaign Brief (JSON)
       │
       ▼
[1] Parse & Validate Brief (Zod)
       │   rich brand guidelines, localized messages
       │
       ▼
[2] Resolve Assets (reuse existing or mark for generation)
       │
       ▼
[3] Generate Missing Images (fal.ai FLUX Schnell)
       │   brand context injected into prompts (colors, aesthetic, values)
       │
       ▼
[4] Text Overlay (sharp)
       │   brand typography + logo composite + brand-colored banner
       │   localized campaign message
       │
       ▼
[5] Compliance Checks
       │   prohibited words, brand color analysis, logo presence, positive keywords
       │
       ▼
[6] Upload to Cloudinary + Save Locally
       │
       ▼
[7] Generate Report (report.json)
       includes locale, resolved message, brand identity, per-check compliance
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
    "localizedMessages": {
      "es-MX": "Hasta 50% de Descuento — Solo por Tiempo Limitado",
      "fr-FR": "Jusqu'a 50% de Reduction — Offre Limitee"
    },
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
    "colors": {
      "text": "#111111",
      "background": "#FEFEFE",
      "accent": [
        { "hex": "#D1CDC9", "description": "Light warm gray" },
        { "hex": "#D1C481", "description": "Muted gold" }
      ]
    },
    "typography": {
      "heading": { "fontFamily": "Futura, sans-serif", "fontSize": "50pt", "fontWeight": "bold" },
      "subheading": { "fontFamily": "Trade Gothic, sans-serif", "fontSize": "34pt", "fontWeight": "normal" },
      "body": { "fontFamily": "Helvetica, sans-serif", "fontSize": "18pt", "fontWeight": "normal" }
    },
    "positiveKeywords": ["Performance", "Authenticity", "Innovation", "Empowerment"],
    "prohibitedWords": ["Cheap shoes", "Outlet shoes"],
    "identity": {
      "description": "Athletic footwear and apparel brand",
      "mission": "To bring inspiration and innovation to every athlete",
      "purpose": "To move the world forward through the power of sport",
      "vision": "To expand human potential",
      "values": ["Inspiration", "Innovation", "Authentic", "Connected", "Distinctive"]
    },
    "logoPath": "examples/assets/brand/logo.png"
  },
  "aspectRatios": ["1:1", "9:16", "16:9"]
}
```

### Key fields

- **`localizedMessages`** (optional): Map of locale codes to translated campaign messages. The pipeline resolves the message by matching `locale` — exact match, then language-only fallback (e.g. `"es"` matches `"es-MX"`), then default `message`.
- **`brandGuidelines.colors`**: `text` and `background` hex colors plus an `accent` array with hex values and descriptions. Used for overlay styling, prompt context, and compliance color checks.
- **`brandGuidelines.typography`**: Font settings for `heading`, `subheading`, and `body` levels. The heading style is used for campaign text overlay. Font stacks with generic fallbacks (e.g. `"Futura, sans-serif"`) are rendered via sharp's SVG/Pango.
- **`brandGuidelines.identity`**: Brand description, mission, purpose, vision, and values — injected into fal.ai prompts so generated images reflect brand aesthetic.
- **`brandGuidelines.logoPath`** (required): Path to brand logo, composited at top-left of every creative (10% width, 3% margin).
- **`positiveKeywords`**: Encouraged terms. Compliance warns if the message contains none.
- **`prohibitedWords`**: Banned phrases. Compliance fails if any appear in the message.
- **`existingAssetDir`** (optional): Path to pre-existing images. Reused instead of calling GenAI — saves cost and time.
- **`imagePrompt`**: Prompt sent to FLUX Schnell, enhanced with brand context automatically.
- **`aspectRatios`**: Output dimensions. `1:1` → 1080×1080, `9:16` → 1080×1920, `16:9` → 1920×1080.

## Output

```
output/
  product-a/
    1x1/creative.png      # Logo + text-overlaid creative
    9x16/creative.png
    16x9/creative.png
  product-b/
    1x1/creative.png
    9x16/creative.png
    16x9/creative.png
  report.json              # Structured pipeline results
```

The `report.json` includes: locale and resolved message, brand identity, products processed, assets reused vs. generated, structured compliance results (per-check breakdowns with issues and warnings), Cloudinary URLs (if uploaded), and per-stage timing.

## Compliance

Four structured checks run per product:

| Check | Type | Description |
|-------|------|-------------|
| Prohibited words | Hard failure | Phrase-aware matching against banned terms |
| Logo present | Hard failure | Verifies logo file exists at `logoPath` |
| Brand color | Soft warning | Dominant image color distance from all brand colors |
| Positive keywords | Soft warning | Checks for encouraged terms, suggests missing ones |

Results are included in `report.json` with structured `checks` objects per product.

## Design Decisions

1. **Brand-aware image generation**: Brand identity, color palette, and values are injected into every fal.ai prompt, so generated images reflect the brand aesthetic — not just the product description. Prompts also reserve space for logo and text overlay.

2. **Direct ratio generation over crop-from-square**: Each aspect ratio is generated natively at the target dimensions via fal.ai, producing better compositions than cropping a single square image.

3. **Asset reuse**: Products can point to existing image directories. The pipeline checks for images there first and only calls GenAI for missing assets — reduces API calls and cost.

4. **Sharp for compositing**: Using sharp's SVG/Pango renderer for text and PNG compositing for logos keeps overlay fast, offline, and free. Brand typography (font family, size, weight) and colors are applied from the brief.

5. **Localization**: Single locale per run with fallback chain (exact → language-only → default). Localized messages are overlaid on creatives without changing the pipeline flow.

6. **Structured compliance**: Issues (hard failures) vs. warnings (soft) with per-check breakdowns enable downstream systems to make nuanced decisions rather than just pass/fail.

7. **Zod schema validation**: The campaign brief is validated upfront with descriptive error messages, failing fast before any expensive API calls.

8. **Cloudinary as optional**: The pipeline works fully offline with just `FAL_KEY`. Cloudinary upload activates when `CLOUDINARY_URL` is set.

9. **Stage-based pipeline**: Each stage is independent and testable. The orchestrator sequences them and tracks timing per stage for observability.

## Known Limitations

- **Font rendering**: Uses system fonts via sharp's SVG/Pango renderer. Futura and Helvetica render natively on macOS; Trade Gothic falls back to `sans-serif`. No bundled font files.
- **Single locale per run**: The pipeline resolves one locale per execution. Run multiple times for multi-locale campaigns.
- **Prohibited words are language-agnostic**: English-only keyword matching regardless of locale.
- **Logo is a placeholder**: The included `examples/assets/brand/logo.png` is a geometric placeholder shape.
- **Approximate color compliance**: GenAI images rarely match brand colors exactly, so the color distance threshold is lenient (150).
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
