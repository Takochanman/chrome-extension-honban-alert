---
name: create-store-assets
description: Generate, update, or add Chrome Web Store promotional screenshots (1280x800) for Honban Alert. Use when asked to create store listing images, regenerate promo screenshots, add a new store screenshot for a new feature, or change the headline/colors/layout of the existing ones.
---

Regenerates the Chrome Web Store screenshots in `docs/store_assets/`
(bold Japanese headline + brand gradient background + the actual
extension UI as a floating browser-window card). Driven by
`.claude/skills/create-store-assets/generate_promo.py`, a Pillow-based
generator — no GUI, no browser automation needed to *regenerate*
existing slides. All paths below are relative to the repo root.

## Prerequisites

```bash
python3 -c "import PIL" || pip3 install Pillow
```

Everything else (the M+ 1p Bold font) is bundled in
`.claude/skills/create-store-assets/assets/` — nothing else to install.

## Run (agent path)

**Regenerate all 5 current slides from `docs/store_assets/screenshot-*.png`:**

```bash
python3 .claude/skills/create-store-assets/generate_promo.py build
```

This reads `.claude/skills/create-store-assets/slides.json` (headline
text, color scheme, and source screenshot per slide) and writes
`docs/store_assets/promo-*.png`. Verified in this session — output is
byte-for-byte what's currently in the repo.

**Add a new slide** (e.g. a new feature screenshot):

1. Get the raw screenshot into the repo immediately — the chat
   upload/image-cache it arrives in is session-scoped and *will* be
   gone in a future session. Save it under `docs/store_assets/` first,
   crop later.
2. Crop it to a clean 1280x800 source. Two raw formats have come up so
   far:
   - **Full browser window** (macOS-style traffic-light chrome,
     floating on a plain dark background — this is the format the
     user's screenshot tool produces):
     ```bash
     python3 .claude/skills/create-store-assets/generate_promo.py \
       crop-mockup path/to/raw.png docs/store_assets/screenshot-6-newfeature.png
     ```
   - **Dialog/popup only, no browser chrome** (e.g. the options page):
     ```bash
     python3 .claude/skills/create-store-assets/generate_promo.py \
       crop-modal path/to/raw.png docs/store_assets/screenshot-6-newfeature.png
     ```
3. Add an entry to `slides.json`:
   ```json
   {
     "screenshot": "docs/store_assets/screenshot-6-newfeature.png",
     "out": "docs/store_assets/promo-6-newfeature.png",
     "headline": "新機能の見出しテキスト",
     "color": "brand_1"
   }
   ```
4. `python3 .claude/skills/create-store-assets/generate_promo.py build`
5. **Look at the output image** (Read tool / open the PNG) before
   calling it done — text wrapping and card sizing are geometry-based
   and can misjudge long headlines or unusual screenshot aspect ratios.

**Change wording/colors on an existing slide:** edit its entry in
`slides.json`, re-run `build`. Don't hand-edit the `promo-*.png`
files — they're generated output and will be silently overwritten by
the next `build`.

**One-off tweak without touching the manifest:**

```bash
python3 .claude/skills/create-store-assets/generate_promo.py compose \
  docs/store_assets/screenshot-1-banner.png \
  "見出しテキスト" \
  docs/store_assets/promo-1-banner.png \
  --color-top 24,15,14 --color-bottom 214,60,40 \
  --headline-size 50 --shot-width 1100
```

## Test

No automated test — this is image generation. Verification is visual:
open each `promo-*.png` and confirm the headline fits on one or two
lines without clipping, and the screenshot card sits just below the
headline (small, consistent gap — see Gotchas).

## Gotchas

- **Chat-uploaded images are ephemeral.** Raw screenshots the user
  pastes into the conversation live in a session-scoped image cache
  (`~/.claude/image-cache/<session-id>/`). It does **not** survive
  across sessions — this bit us once (`docs/store_assets/screenshot-4-options.png`
  had to be reconstructed by re-cropping the modal out of an already-composed
  promo image because the original raw upload was gone). Always save
  a cropped, plain copy into `docs/store_assets/` in the same turn the
  screenshot is provided.
- **Don't feed an already-composed image back into `compose`.** Early
  iterations baked the brand gradient into the *screenshot* itself
  (`screenshot-4-options.png` used to have an orange gradient behind
  the white modal). Composing that onto the outer gradient template
  produced two overlapping gradients whose edges didn't line up —
  looked like a rendering bug but was really "wrong input file."
  `screenshot-*.png` files must always be plain (white or the real
  captured page background), never pre-gradiented.
- **`crop-mockup`'s content-detection assumes a near-black background**
  (`detect_content_bbox`, threshold on luminance). It's what every raw
  screenshot has used so far. If a future capture uses a light/white
  surrounding background instead, this will detect the wrong bbox (or
  the whole image) — pass a different `--threshold` or extend the
  function with a background-color check rather than assuming dark.
- **Font must be a real Japanese font, not a Chinese (zh) one.** The
  first version used `Hiragino Sans GB` (a Simplified Chinese system
  font available in this environment) because it was easy to find and
  *looked* fine in isolation — but glyphs like 誤 render with
  Chinese-style stroke shapes that Japanese readers immediately notice
  as wrong (Han unification: same Unicode codepoint, different
  regional glyph). Fixed by bundling **M+ 1p Bold**
  (`assets/MPLUS1p-Bold.ttf`, OFL-licensed, license text alongside it)
  instead of depending on whatever CJK font happens to be on the host.
  Don't swap in a font without checking actual kanji rendering (誤,
  環境, 検知 are good test characters — draw them and look, don't just
  confirm `getbbox()` returns something).
- **Headline-to-screenshot gap is controlled by `compose()`'s
  `visible_top_target = headline_bottom + 34`**, not by the card's
  own padding (`pad=90` in `_rounded_shadow_card` is shadow margin,
  not visual gap — the function subtracts it back out via `cy =
  visible_top_target - pad`). If the gap looks wrong after changing
  `headline_size` or adding a second headline line, this is the line
  to adjust, not the card's `pad`.
- **The screenshot card is meant to bleed off the bottom edge.** At
  the default `shot_width=1100`, the card's bottom clips out of the
  800px canvas — that's intentional (matches the reference store
  listing's "rising from below" composition), not a bug to center-fit.

## Troubleshooting

- **Headline text overlaps or looks unbalanced**: `_wrap_center` wraps
  per-character (correct for Japanese, which has no spaces), but a
  long headline at the default `headline_size=50` may still run close
  to the 1280px edge. Slide 2 and the request-block slide both needed
  `headline_size` dropped to 44/42 to fit comfortably — check the
  rendered output, not just that it didn't crash.
- **`ImageFont.truetype` raises `OSError: cannot open resource`**: the
  bundled font path resolves relative to `generate_promo.py`'s own
  location (`SKILL_DIR / "assets" / "MPLUS1p-Bold.ttf"`), so this only
  happens if the skill directory was copied without its `assets/`
  subfolder. Re-copy the whole `create-store-assets/` directory, not
  just the `.py` file.
