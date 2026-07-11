#!/usr/bin/env python3
"""
Chrome Web Store promotional image generator for Honban Alert.

Turns a raw screenshot (captured from the running extension) into a
1280x800 Chrome Web Store screenshot with a bold Japanese headline,
brand-color gradient background, and the screenshot presented as a
floating browser-window card.

Subcommands:
  crop-mockup   Crop a "browser mockup" screenshot (macOS-style window
                chrome with traffic-light buttons, floating on a plain
                dark background) down to just the browser window,
                letterboxed to 1280x800. Use this for raw screenshots
                taken with a screenshot tool that wraps the browser in
                a decorative frame/background.
  crop-modal    Crop a screenshot that shows ONLY a popup/dialog (no
                surrounding browser chrome, e.g. the options page
                screenshot) and place it centered on a plain white
                1280x800 canvas.
  compose       Take an already-cropped 1280x800 screenshot, add the
                headline + gradient background + floating card, and
                write the final promo-*.png.
  build         Run `compose` for every slide listed in slides.json.

Typical workflow when a new screenshot is provided:
  1. python3 generate_promo.py crop-mockup raw.png docs/store_assets/screenshot-6-new.png
     (or crop-modal for a dialog-only capture)
  2. Add an entry to slides.json pointing at that new screenshot file.
  3. python3 generate_promo.py build
"""
import argparse
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, ImageFilter

SKILL_DIR = Path(__file__).resolve().parent
FONT_PATH = SKILL_DIR / "assets" / "MPLUS1p-Bold.ttf"

W, H = 1280, 800
TARGET_RATIO = W / H  # 1.6


# ---------------------------------------------------------------------------
# crop-mockup: browser-window screenshot floating on a plain background
# ---------------------------------------------------------------------------

def detect_content_bbox(im, threshold=25):
    """Find the bounding box of non-background content.

    Assumes the mockup background is near-black/near-uniform and the
    browser window is much brighter. Works for the "macOS window
    floating on a solid dark background" screenshot style; if a future
    screenshot tool uses a light background instead, pass --threshold
    accordingly (crop-mockup will need a light-background variant).
    """
    gray = im.convert("L")
    bw = gray.point(lambda p: 255 if p > threshold else 0)
    bbox = bw.getbbox()
    if bbox is None:
        raise ValueError("could not detect content bbox — image may be blank")
    return bbox


def crop_mockup(src_path, out_path, threshold=25):
    im = Image.open(src_path)
    bbox = detect_content_bbox(im, threshold=threshold)
    content = im.crop(bbox)
    w, h = content.size
    ratio = w / h
    if ratio > TARGET_RATIO:
        new_w = int(h * TARGET_RATIO)
        x0 = (w - new_w) // 2
        content = content.crop((x0, 0, x0 + new_w, h))
    else:
        # top-anchored crop: keeps the browser chrome + page header,
        # trims empty space from the bottom of the page instead
        new_h = int(w / TARGET_RATIO)
        content = content.crop((0, 0, w, min(new_h, h)))
    content = content.resize((W, H), Image.LANCZOS).convert("RGB")
    content.save(out_path, "PNG")
    print(f"crop-mockup: {src_path} -> {out_path} (detected bbox {bbox})")


# ---------------------------------------------------------------------------
# crop-modal: a popup/dialog screenshot with no surrounding browser chrome
# ---------------------------------------------------------------------------

def crop_modal(src_path, out_path, edge_margin=10, fill_ratio=0.94):
    """Trim a thin border/bleed around a dialog capture and center it
    on a plain white 1280x800 canvas.

    edge_margin: pixels trimmed from each edge of the source image
    before placing it, to remove capture-tool window borders / stray
    background bleed at the very edge (see Gotchas in SKILL.md).
    """
    im = Image.open(src_path).convert("RGB")
    w, h = im.size
    im = im.crop((edge_margin, edge_margin, w - edge_margin, h - edge_margin))

    canvas = Image.new("RGB", (W, H), (255, 255, 255))
    scale = (H * fill_ratio) / im.height
    new_size = (int(im.width * scale), int(im.height * scale))
    im_r = im.resize(new_size, Image.LANCZOS)
    mx = (W - new_size[0]) // 2
    my = (H - new_size[1]) // 2
    canvas.paste(im_r, (mx, my))
    canvas.save(out_path, "PNG")
    print(f"crop-modal: {src_path} -> {out_path}")


# ---------------------------------------------------------------------------
# compose: headline + gradient background + floating screenshot card
# ---------------------------------------------------------------------------

def _font(size):
    return ImageFont.truetype(str(FONT_PATH), size)


def _diagonal_gradient(size, c_topleft, c_botright):
    w, h = size
    top = Image.new("RGB", (w, h))
    d = ImageDraw.Draw(top)
    for y in range(h):
        t = y / h
        r = int(c_topleft[0] + (c_botright[0] - c_topleft[0]) * t)
        g = int(c_topleft[1] + (c_botright[1] - c_topleft[1]) * t)
        b = int(c_topleft[2] + (c_botright[2] - c_topleft[2]) * t)
        d.line([(0, y), (w, y)], fill=(r, g, b))
    side = Image.new("RGB", (w, h))
    d2 = ImageDraw.Draw(side)
    for x in range(w):
        t = x / w
        r = int(c_topleft[0] + (c_botright[0] - c_topleft[0]) * t)
        g = int(c_topleft[1] + (c_botright[1] - c_topleft[1]) * t)
        b = int(c_topleft[2] + (c_botright[2] - c_topleft[2]) * t)
        d2.line([(x, 0), (x, h)], fill=(r, g, b))
    return Image.blend(top, side, 0.5)


def _rounded_shadow_card(im, radius=14, shadow_blur=45, shadow_alpha=170, pad=90):
    w, h = im.size
    mask = Image.new("L", (w, h), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, w, h), radius=radius, fill=255)
    card = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    card.paste(im.convert("RGB"), (0, 0), mask)

    canvas = Image.new("RGBA", (w + pad * 2, h + pad * 2), (0, 0, 0, 0))
    shadow_mask = Image.new("L", (w, h), shadow_alpha)
    shadow_mask = Image.composite(shadow_mask, Image.new("L", (w, h), 0), mask)
    shadow = Image.new("RGBA", (w, h), (0, 0, 0, 0))
    shadow.putalpha(shadow_mask)
    shadow_layer = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    shadow_layer.paste(shadow, (pad, pad + 16), shadow)
    shadow_layer = shadow_layer.filter(ImageFilter.GaussianBlur(shadow_blur))

    canvas.alpha_composite(shadow_layer)
    canvas.alpha_composite(card, (pad, pad))
    return canvas, pad


def _wrap_center(draw, text, f, max_w):
    if draw.textlength(text, font=f) <= max_w:
        return [text]
    lines, cur = [], ""
    for ch in text:
        trial = cur + ch
        if draw.textlength(trial, font=f) > max_w and cur:
            lines.append(cur)
            cur = ch
        else:
            cur = trial
    if cur:
        lines.append(cur)
    return lines


def compose(screenshot_path, headline, out_path, color_top, color_bottom,
            headline_size=50, shot_width=1100):
    bg = _diagonal_gradient((W, H), color_top, color_bottom)
    canvas = bg.convert("RGBA")
    draw = ImageDraw.Draw(canvas)

    f_headline = _font(headline_size)
    max_w = W - 120
    lines = _wrap_center(draw, headline, f_headline, max_w)
    line_h = f_headline.getbbox("本")[3] + 14
    ty = 56
    for line in lines:
        lw = draw.textlength(line, font=f_headline)
        # 1px dark shadow behind the white headline keeps it legible
        # against the lighter half of the gradient
        draw.text(((W - lw) / 2 + 2, ty + 2), line, font=f_headline, fill=(0, 0, 0, 90))
        draw.text(((W - lw) / 2, ty), line, font=f_headline, fill=(255, 255, 255))
        ty += line_h
    headline_bottom = ty + 4

    shot = Image.open(screenshot_path).convert("RGB")
    scale = shot_width / shot.width
    new_size = (shot_width, int(shot.height * scale))
    shot_resized = shot.resize(new_size, Image.LANCZOS)
    card, pad = _rounded_shadow_card(shot_resized)

    # position so the *visible* screenshot (not the shadow padding)
    # starts a fixed, small gap below the headline; letting the card
    # bleed off the bottom edge of the canvas is intentional
    visible_top_target = headline_bottom + 34
    cx = (W - card.width) // 2
    cy = visible_top_target - pad
    canvas.alpha_composite(card, (cx, cy))

    canvas.convert("RGB").save(out_path, "PNG")
    print(f"compose: {out_path}")


# ---------------------------------------------------------------------------
# build: run compose for every entry in slides.json
# ---------------------------------------------------------------------------

def build(manifest_path, repo_root):
    manifest = json.loads(Path(manifest_path).read_text())
    for slide in manifest["slides"]:
        compose(
            screenshot_path=repo_root / slide["screenshot"],
            headline=slide["headline"],
            out_path=repo_root / slide["out"],
            color_top=tuple(manifest["colors"][slide["color"]]["top"]),
            color_bottom=tuple(manifest["colors"][slide["color"]]["bottom"]),
            headline_size=slide.get("headline_size", 50),
            shot_width=slide.get("shot_width", 1100),
        )


# ---------------------------------------------------------------------------
# CLI
# ---------------------------------------------------------------------------

def main():
    p = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    sub = p.add_subparsers(dest="cmd", required=True)

    p_mock = sub.add_parser("crop-mockup", help="crop a browser-mockup screenshot to 1280x800")
    p_mock.add_argument("src")
    p_mock.add_argument("out")
    p_mock.add_argument("--threshold", type=int, default=25)

    p_modal = sub.add_parser("crop-modal", help="crop a dialog-only screenshot onto a white 1280x800 canvas")
    p_modal.add_argument("src")
    p_modal.add_argument("out")
    p_modal.add_argument("--edge-margin", type=int, default=10)

    p_comp = sub.add_parser("compose", help="add headline + gradient + card to one cropped screenshot")
    p_comp.add_argument("screenshot")
    p_comp.add_argument("headline")
    p_comp.add_argument("out")
    p_comp.add_argument("--color-top", default="24,15,14")
    p_comp.add_argument("--color-bottom", default="214,60,40")
    p_comp.add_argument("--headline-size", type=int, default=50)
    p_comp.add_argument("--shot-width", type=int, default=1100)

    p_build = sub.add_parser("build", help="regenerate every slide listed in slides.json")
    p_build.add_argument("--manifest", default=str(SKILL_DIR / "slides.json"))
    p_build.add_argument("--repo-root", default=None,
                          help="defaults to the git repo root containing this skill")

    args = p.parse_args()

    if args.cmd == "crop-mockup":
        crop_mockup(args.src, args.out, threshold=args.threshold)
    elif args.cmd == "crop-modal":
        crop_modal(args.src, args.out, edge_margin=args.edge_margin)
    elif args.cmd == "compose":
        top = tuple(int(x) for x in args.color_top.split(","))
        bottom = tuple(int(x) for x in args.color_bottom.split(","))
        compose(args.screenshot, args.headline, args.out, top, bottom,
                headline_size=args.headline_size, shot_width=args.shot_width)
    elif args.cmd == "build":
        repo_root = Path(args.repo_root) if args.repo_root else SKILL_DIR.parents[2]
        build(args.manifest, repo_root)


if __name__ == "__main__":
    sys.exit(main())
