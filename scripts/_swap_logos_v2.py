"""One-shot script to swap in the v2 logos from frontend/public/logo/
into all the slots the app/PWA expects, generating maskable variants
where needed.

Source files in frontend/public/logo/ (provided by user):
  Favicon 512x512.png        - main square 512 master (transparent)
  Favicon 192 .jpeg.png      - 192x192 transparent
  Favicon apple .jpeg.png    - 180x180 transparent
  Favicon 32x32 .jpeg.png    - 32x32 transparent
  Favicon 16x16 .jpeg.png    - 16x16 transparent
  logo.png                   - the "wordmark with disc" image used for
                               OG / Twitter previews + footer

Outputs (overwrite the existing files in frontend/public/):
  favicon-16x16.png
  favicon-32x32.png
  logo-icon.png                  (navbar uses this — point at the 512)
  logo.png                       (OG / Twitter / footer)
  apple-touch-icon.png           (180x180 — TEAL BG baked in since iOS
                                  strips alpha)
  android-chrome-192x192.png     (transparent — for "any" purpose)
  android-chrome-512x512.png     (transparent — for "any" purpose)
  android-chrome-maskable-192.png (92% logo on teal canvas)
  android-chrome-maskable-512.png (92% logo on teal canvas)

This is a copy-and-resize pass — no alpha cleanup, no edge thresholding.
The new sources are already clean.
"""
from PIL import Image
from pathlib import Path
import shutil

PUBLIC = Path("frontend/public")
SRC = PUBLIC / "logo"

# Source-of-truth filenames inside frontend/public/logo/
SRC_512 = SRC / "Favicon 512x512.png"
SRC_192 = SRC / "Favicon 192 .jpeg.png"
SRC_180 = SRC / "Favicon apple .jpeg.png"
SRC_32 = SRC / "Favicon 32x32 .jpeg.png"
SRC_16 = SRC / "Favicon 16x16 .jpeg.png"
SRC_LOGO = SRC / "logo.png"

BG = (30, 107, 107, 255)  # #1e6b6b — brand teal


def tight_crop(src: Image.Image) -> Image.Image:
    """Crop to the bounding box of non-transparent pixels. Removes the
    transparent margin every source PNG has around the disc so we can
    scale to actual fill rather than wasting 25-30% on padding."""
    bbox = src.getbbox()
    if not bbox:
        return src
    return src.crop(bbox)


def composite_on_teal(src: Image.Image, size: int, scale: float = 1.0) -> Image.Image:
    """Center src on a solid-teal square canvas, scaled to `scale` of the
    canvas (1.0 = edge-to-edge). Used for apple-touch-icon (iOS strips
    alpha, so we bake teal) and maskable Android icons (mask shape can
    clip outer pixels, safe-area must be inside)."""
    canvas = Image.new("RGBA", (size, size), BG)
    target = int(size * scale)
    s = src.copy()
    s.thumbnail((target, target), Image.LANCZOS)
    x = (size - s.width) // 2
    y = (size - s.height) // 2
    canvas.alpha_composite(s, (x, y))
    return canvas


def copy_resized(src_path: Path, dest_path: Path, size: int | None = None) -> None:
    im = Image.open(src_path).convert("RGBA")
    if size and im.size != (size, size):
        im = im.resize((size, size), Image.LANCZOS)
    im.save(dest_path, optimize=True)
    print(f"wrote {dest_path.name}  ({im.size[0]}x{im.size[1]})")


def crop_and_fit_transparent(src: Image.Image, size: int, scale: float = 1.0) -> Image.Image:
    """Tight-crop source then place centered on transparent canvas, scaled
    to `scale` of canvas. For transparent-background icons (favicons,
    android any). scale=1.0 = logo touches all 4 edges."""
    tight = tight_crop(src)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    target = int(size * scale)
    s = tight.copy()
    s.thumbnail((target, target), Image.LANCZOS)
    x = (size - s.width) // 2
    y = (size - s.height) // 2
    canvas.alpha_composite(s, (x, y))
    return canvas


def main():
    # 512 master we crop+rescale from — the user-supplied source has ~30%
    # transparent margin around the disc that we strip on every output.
    master_512 = Image.open(SRC_512).convert("RGBA")

    # Wordmark logo for OG / Twitter / footer — copy as-is (it's a
    # different layout than the badge, has its own composition).
    shutil.copy2(SRC_LOGO, PUBLIC / "logo.png")
    print("wrote logo.png  (copied as-is from logo/logo.png)")

    # Navbar logo — tight-cropped 512 master. 98% fill leaves a single-px
    # safe band so anti-aliasing doesn't get clipped by the css rounded
    # container.
    nav = crop_and_fit_transparent(master_512, 512, scale=0.98)
    nav.save(PUBLIC / "logo-icon.png", optimize=True)
    print("wrote logo-icon.png  (512x512, 98% fill — tight-cropped from master)")

    # Browser tab favicons — tight-crop to maximize legibility at tiny
    # sizes. Logo fills 95% (4-5px of breathing room at 16/32 prevents
    # the rim from looking jammed against the tab border).
    for sz in (16, 32):
        ico = crop_and_fit_transparent(master_512, sz, scale=0.95)
        ico.save(PUBLIC / f"favicon-{sz}x{sz}.png", optimize=True)
        print(f"wrote favicon-{sz}x{sz}.png  ({sz}x{sz}, 95% fill)")

    # Google search result favicon — Google prefers >= 48px. The 192 we
    # also generate for the manifest doubles as Google's high-quality
    # favicon source once we link to it from index.html.
    # 96x96 is the documented sweet spot for Google's favicon-in-search.
    g96 = crop_and_fit_transparent(master_512, 96, scale=0.95)
    g96.save(PUBLIC / "favicon-96x96.png", optimize=True)
    print("wrote favicon-96x96.png  (96x96, 95% fill — Google search)")

    # Android "any" PWA icons — transparent, tight-cropped to 98%.
    for sz in (192, 512):
        out = crop_and_fit_transparent(master_512, sz, scale=0.98)
        out.save(PUBLIC / f"android-chrome-{sz}x{sz}.png", optimize=True)
        print(f"wrote android-chrome-{sz}x{sz}.png  ({sz}x{sz}, 98% fill, transparent)")

    # Apple touch icon — iOS strips alpha + rounds corners, so bake teal
    # behind the tight-cropped logo at full-edge.
    apple_inner = crop_and_fit_transparent(master_512, 180, scale=1.0)
    apple = Image.new("RGBA", (180, 180), BG)
    apple.alpha_composite(apple_inner)
    apple.save(PUBLIC / "apple-touch-icon.png", optimize=True)
    print("wrote apple-touch-icon.png  (180x180, teal bg, 100% fill)")

    # Android maskable — launcher mask determines the visible shape. Logo
    # is round, so 100% on teal canvas means whatever shape the launcher
    # applies (circle/squircle/rounded-square) shows the full disc at
    # max size with teal corners clipped invisibly.
    for sz in (192, 512):
        inner = crop_and_fit_transparent(master_512, sz, scale=1.0)
        out = Image.new("RGBA", (sz, sz), BG)
        out.alpha_composite(inner)
        out.save(PUBLIC / f"android-chrome-maskable-{sz}.png", optimize=True)
        print(f"wrote android-chrome-maskable-{sz}.png  ({sz}x{sz}, teal bg, 100%)")


if __name__ == "__main__":
    main()
