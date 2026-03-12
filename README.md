# Creative Automation Pipeline

A Node.js pipeline that automates creative asset generation for social ad campaigns using GenAI. Given a campaign brief (JSON), it generates brand-aware product images, composites logos, product name, description, and campaign text with brand typography, runs structured compliance checks, and uploads to Cloudinary.

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
       │   brand context + audience injected into prompts
       │
       ▼
[4] Text Overlay (sharp)
       │   product name (heading) + description (body) + campaign message (subheading)
       │   brand typography + logo composite + dark semi-transparent banner + white text
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
npm run dev:example

# Override locale (uses matching localizedMessages entry)
npm run dev -- generate --brief examples/campaign-brief.json --locale es-MX

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
      "name": "Heir Series 2",
      "description": "Take 'em for everything they've got.",
      "existingAssetDir": "examples/assets/product-a",
      "localizedFields": {
        "es-MX": { "name": "Heir Series 2", "description": "Llévate todo lo que tienen." },
        "fr-FR": { "name": "Heir Series 2", "description": "Prenez-leur tout ce qu'ils ont." }
      }
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
    "prohibitedWords": ["Cheap", "Outlet", "Secondhand"],
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

- **`localizedMessages`** (optional): Map of locale codes to translated campaign messages. The pipeline resolves the message by matching `locale` — exact match, then language-only fallback (e.g. `"es"` matches `"es-MX"`), then default `message`. Use `--locale <code>` to override the brief's locale at runtime.
- **`localizedFields`** (optional, per product): Map of locale codes to `{ name, description }` overrides. When a locale is active, product names and descriptions on creatives are rendered in the target language using the same fallback chain.
- **`audience`** (optional): Target audience description (e.g. `"Young professionals aged 25-35"`). Injected into fal.ai prompts to tailor generated imagery.
- **`brandGuidelines.colors`**: `text` and `background` hex colors plus an `accent` array with hex values and descriptions. Used for overlay styling, prompt context, and compliance color checks.
- **`brandGuidelines.typography`**: Font settings for `heading`, `subheading`, and `body` levels. The overlay uses heading for product name, body for description, and subheading for campaign message. Font stacks with generic fallbacks (e.g. `"Futura, sans-serif"`) are rendered via sharp's SVG/Pango.
- **`brandGuidelines.identity`**: Brand description, mission, purpose, vision, and values — injected into fal.ai prompts so generated images reflect brand aesthetic.
- **`brandGuidelines.logoPath`** (required): Path to brand logo, composited at top-left of every creative (10% width, 3% margin).
- **`positiveKeywords`**: Encouraged terms. Compliance warns if the message contains none.
- **`prohibitedWords`**: Banned phrases. Compliance fails if any appear in the message.
- **`existingAssetDir`** (optional): Path to pre-existing images. Reused instead of calling GenAI — saves cost and time.
- **`imagePrompt`** (optional): Prompt sent to FLUX Schnell, enhanced with brand context automatically. If omitted, a prompt is auto-generated from the product's `name` and `description`.
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

The `report.json` includes: locale and resolved message, brand identity, products processed, assets reused vs. generated, structured compliance results (per-check breakdowns with issues and warnings), Cloudinary URLs (if uploaded), per-stage timing, and success metrics (time saved, volume, efficiency).

## Compliance

Four structured checks run per product:

| Check | Type | Description |
|-------|------|-------------|
| Prohibited words | Hard failure | Phrase-aware matching against banned terms |
| Logo present | Hard failure | Verifies logo file exists at `logoPath` |
| Brand color | Soft warning | Dominant image color distance from all brand colors |
| Positive keywords | Soft warning | Checks for encouraged terms, suggests missing ones |

Results are included in `report.json` with structured `checks` objects per product.

## Success Metrics

The pipeline computes and displays three categories of success metrics in both the CLI summary and `report.json`:

| Category | Metrics |
|----------|---------|
| **Time Saved** | Manual estimate (30 min/creative baseline), pipeline time, time saved, speedup factor |
| **Volume** | Total creatives, products processed, aspect ratios, assets generated vs reused, locale |
| **Efficiency** | Asset reuse rate, compliance pass rate, throughput (creatives/min), per-stage time breakdown |

Example CLI output:
```
========================================
  Pipeline Complete
========================================
  Campaign:    Summer Sale 2025
  Locale:      fr-FR
  Assets:      6
----------------------------------------
  Time Saved
    Manual estimate:  3.0 hours
    Pipeline time:    19.8 seconds
    Time saved:       3.0 hours
    Speedup:          546x faster
----------------------------------------
  Volume
    Creatives:    6 (2 products x 3 ratios)
    Generated:    3 new, 3 reused
----------------------------------------
  Efficiency
    Reuse rate:       50.0%
    Compliance:       100.0% pass rate
    Throughput:       18.2 creatives/min
----------------------------------------
  Output:  output/
========================================
```

## Design Decisions

1. **Brand-aware image generation**: Brand identity, color palette, values, and target audience are injected into every fal.ai prompt, so generated images reflect the brand aesthetic — not just the product description. Prompts also reserve space for logo and text overlay.

2. **Direct ratio generation over crop-from-square**: Each aspect ratio is generated natively at the target dimensions via fal.ai, producing better compositions than cropping a single square image.

3. **Asset reuse**: Products can point to existing image directories. The pipeline checks for images there first and only calls GenAI for missing assets — reduces API calls and cost.

4. **Sharp for compositing**: Using sharp's SVG/Pango renderer for text and PNG compositing for logos keeps overlay fast, offline, and free. Each creative composites the product name (heading), description (body), and campaign message (subheading) on a near-black semi-transparent banner with white text, with the logo at top-left.

5. **Localization**: Single locale per run with fallback chain (exact → language-only → default). Both campaign messages and product fields (name, description) are localized, so creatives are fully rendered in the target language.

6. **Structured compliance**: Issues (hard failures) vs. warnings (soft) with per-check breakdowns enable downstream systems to make nuanced decisions rather than just pass/fail.

7. **Zod schema validation**: The campaign brief is validated upfront with descriptive error messages, failing fast before any expensive API calls.

8. **Cloudinary as optional**: The pipeline works fully offline with just `FAL_KEY`. Cloudinary upload activates when `CLOUDINARY_URL` is set.

9. **Stage-based pipeline**: Each stage is independent and testable. The orchestrator sequences them and tracks timing per stage for observability.

## Future Directions

### Test Suite

The utility layer (`brand-helpers.ts`, `metrics.ts`, Zod schema, compliance logic) is composed of pure functions with no side effects — ideal candidates for unit testing with vitest. Priority test targets: locale fallback chains, font size parsing, success metrics computation, prohibited word matching, and schema validation edge cases.

### Concurrent Image Generation

Products are generated sequentially today. Since each product's images are independent, they could be generated concurrently with bounded `Promise.all` (concurrency of 3–4 to respect API rate limits) — turning wall time from `N * products` API calls to roughly 1x.

### Retry with Exponential Backoff

A generic `withRetry` utility with exponential backoff would make the pipeline resilient to transient API failures. Applied to fal.ai image generation, image downloads, and Cloudinary uploads, it would prevent a single network blip from crashing the entire run.

### Deeper Compliance Checks

- **All-text scanning**: Prohibited words currently only checks the campaign message. Extending to product names and descriptions would catch more violations.
- **WCAG contrast ratio**: Verify that overlay text color against banner background meets WCAG AA (4.5:1 minimum). The pipeline already computes relative luminance — adding a contrast ratio check would catch illegible text combinations.

### A/B Variant Generation

The spec calls for "generating variations for campaign assets." A `--variants <n>` CLI flag would generate multiple creative variants per product/ratio with prompt variations (e.g. "dynamic composition", "close-up product focus", "lifestyle context"). This directly addresses the ideation business goal — a creative director reviews 3 options per format instead of a single take-it-or-leave-it output.

### Text Overflow Handling

Long product names or descriptions can exceed the banner width and silently clip. Character-width estimation with ellipsis truncation would handle edge cases gracefully.

### Graceful Per-Asset Error Handling

Currently any single asset failure crashes the pipeline. Wrapping per-asset operations in try-catch with a `status: "success" | "failed"` field would allow the pipeline to continue processing remaining assets and report failures in `report.json`.

### Multi-Locale Batch Mode

A `--locales es-MX,fr-FR,en-US` flag would generate base images once and fan out the overlay stage per locale — avoiding redundant image generation (the most expensive step) while producing localized creatives for all markets in a single run.

### Mock Campaign Analytics

The current success metrics measure pipeline performance (speed, throughput). Adding simulated engagement predictions based on creative attributes (aspect ratio, brand color alignment, keyword density) would address business goal #5 — "track effectiveness at scale and learn what content drives the best business outcomes." Even mock heuristics turn `report.json` from an operational log into a creative intelligence report.

### Dry-Run / Preview Mode

A `--dry-run` flag that skips image generation and upload but runs all other stages (brief validation, asset resolution, compliance on existing assets). Useful for validating briefs before spending API credits, and for CI integration.

### Figma Plugin

A Figma plugin could replace sharp-based compositing with Figma's rendering engine, giving designers direct control over creative layout:

- **Template-driven compositing**: Designers build templates in Figma with named layers (e.g. `#product-name`, `#campaign-message`, `#logo`). The plugin populates these from the campaign brief, preserving exact typography, spacing, and effects that are difficult to replicate in SVG.
- **Review workflow**: Generated creatives appear as Figma frames that designers can review, tweak, and approve before export — rather than getting final PNGs from a CLI with no way to adjust.
- **Design token sync**: Brand guidelines (colors, typography) could be pulled from Figma variables instead of duplicated in JSON, keeping the brief and design system in sync.

The tradeoff is complexity: a Figma plugin requires its own build toolchain (React UI, sandboxed iframe API, manifest), adds an external dependency (Figma account + auth), and makes the pipeline harder to run in CI or review from a terminal. For a headless automation pipeline, sharp compositing is more appropriate. The plugin makes sense when the audience shifts from engineers to designers, or when creative fidelity matters more than automation speed.

## Known Limitations

- **Font rendering**: Uses system fonts via sharp's SVG/Pango renderer. Futura and Helvetica render natively on macOS; Trade Gothic falls back to `sans-serif`. No bundled font files.
- **Single locale per run**: The pipeline resolves one locale per execution. Run multiple times for multi-locale campaigns (see multi-locale batch mode in Future Directions).
- **Prohibited words are language-agnostic**: English-only keyword matching regardless of locale.
- **Logo is a placeholder**: The included `examples/assets/brand/logo.png` is a geometric placeholder shape.
- **Approximate color compliance**: GenAI images rarely match brand colors exactly, so the color distance threshold is lenient (150).

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
