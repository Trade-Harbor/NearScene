"""Polish logo edges so they're crisp on both light AND dark backgrounds.

Problem:
  logo-icon.png has ~7k semi-transparent (alpha 1..254) "feather" pixels
  along the rim of the gold border. The original alpha-unmatting baked a
  neutral teal-ish color into those pixels, so against the splash teal
  they're invisible — but against the dark navbar/footer they appear as
  a teal halo around the disc.

Solution:
  Sharpen the alpha channel: pixels below a low threshold drop to 0,
  pixels above a high threshold rise to 255. The remaining narrow band
  (alpha 40..200 -> 0..255 linear remap) keeps the edge from looking
  pixel-jagged. Net effect: ~75% fewer feather pixels, halo gone.

This is non-destructive — backs up the original to logo-icon.orig.png
on first run so we can re-run with different thresholds if needed.
"""
from PIL import Image, ImageFilter
import numpy as np
from pathlib import Path

PUBLIC = Path("frontend/public")
SRC = PUBLIC / "logo-icon.png"
BACKUP = PUBLIC / "logo-icon.orig.png"

ALPHA_LOW = 70   # pixels below this go fully transparent (kills halo)
ALPHA_HIGH = 180  # pixels above this go fully opaque
SOFTEN_BLUR = 0.0  # no post-blur — keep the cleanup sharp; jaggies are
                   # imperceptible at display sizes (icon, navbar, splash).


def main():
    if not BACKUP.exists():
        Image.open(SRC).save(BACKUP)
        print(f"backed up original -> {BACKUP.name}")

    im = Image.open(BACKUP).convert("RGBA")
    arr = np.array(im).astype(np.float32)
    alpha = arr[..., 3].copy()

    edges_before = int(((alpha > 0) & (alpha < 255)).sum())

    new_alpha = np.where(
        alpha <= ALPHA_LOW, 0.0,
        np.where(
            alpha >= ALPHA_HIGH, 255.0,
            (alpha - ALPHA_LOW) / (ALPHA_HIGH - ALPHA_LOW) * 255.0,
        )
    )

    arr[..., 3] = new_alpha
    out = Image.fromarray(arr.astype(np.uint8), "RGBA")

    if SOFTEN_BLUR > 0:
        # Apply a tiny gaussian blur to the alpha channel only, so the
        # newly-sharpened edge doesn't look pixel-jagged at display sizes.
        a = out.split()[3].filter(ImageFilter.GaussianBlur(SOFTEN_BLUR))
        out.putalpha(a)

    arr_after = np.array(out)
    edges_after = int(((arr_after[..., 3] > 0) & (arr_after[..., 3] < 255)).sum())

    out.save(SRC, optimize=True)
    print(f"feather pixels: {edges_before} -> {edges_after} ({100*(1-edges_after/edges_before):.0f}% reduction)")
    print(f"saved {SRC}")


if __name__ == "__main__":
    main()
