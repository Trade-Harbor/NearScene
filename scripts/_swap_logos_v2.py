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


def main():
    # Master copies — used by navbar / OG cards / footer
    copy_resized(SRC_512, PUBLIC / "logo-icon.png")
    shutil.copy2(SRC_LOGO, PUBLIC / "logo.png")
    print(f"wrote logo.png  (copied as-is from logo/logo.png)")

    # Tiny browser favicons — use the user's hand-tuned small versions
    copy_resized(SRC_16, PUBLIC / "favicon-16x16.png")
    copy_resized(SRC_32, PUBLIC / "favicon-32x32.png")

    # Android "any" — transparent is fine, Android handles alpha
    copy_resized(SRC_192, PUBLIC / "android-chrome-192x192.png", size=192)
    copy_resized(SRC_512, PUBLIC / "android-chrome-512x512.png", size=512)

    # Apple touch icon — iOS strips alpha + rounds corners, so bake teal
    # at edge-to-edge so the rounded corners stay teal too.
    master_180 = Image.open(SRC_180).convert("RGBA")
    apple = composite_on_teal(master_180, 180, scale=1.0)
    apple.save(PUBLIC / "apple-touch-icon.png", optimize=True)
    print("wrote apple-touch-icon.png  (180x180, teal bg, edge-to-edge)")

    # Android maskable — launcher applies circle/squircle/rounded-square
    # mask; logo must sit inside 80% safe zone to survive any shape.
    # We use 92% since the logo is round (matches circular masks exactly,
    # rounded-square masks clip only outer teal — invisible).
    master_512 = Image.open(SRC_512).convert("RGBA")
    for sz in (192, 512):
        out = composite_on_teal(master_512, sz, scale=0.92)
        out.save(PUBLIC / f"android-chrome-maskable-{sz}.png", optimize=True)
        print(f"wrote android-chrome-maskable-{sz}.png  ({sz}x{sz}, teal bg, 92%)")


if __name__ == "__main__":
    main()
