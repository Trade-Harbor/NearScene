"""Auto-crop the cream/beige background from a LocalDrift logo image.

The AI-generated logos have a cream-colored canvas around the actual circular
badge. This script:
  1. Samples the corner pixel as the "background color"
  2. Builds a mask of pixels that are NOT background (within tolerance)
  3. Finds the tight bounding box of the non-background content
  4. Crops to that bounding box
  5. Optionally pads to a square (so circular avatars render correctly)
  6. Optionally resizes to a target dimension (default 512x512)

Usage:
    python scripts/crop_logo.py frontend/public/logo.png
    python scripts/crop_logo.py frontend/public/logo-icon.png

It overwrites the file in place after creating a `.bak` backup.
"""
import sys
from pathlib import Path

from PIL import Image


def color_distance(c1, c2):
    """Approximate visual distance between two RGB colors (0-441 range)."""
    return sum((a - b) ** 2 for a, b in zip(c1[:3], c2[:3])) ** 0.5


def crop_logo(input_path: Path, target_size: int = 512, tolerance: int = 30, pad_pct: float = 0.02) -> None:
    """Crop background and save in place.

    target_size: final width/height in pixels. The cropped logo is centered in
                 a square canvas with transparent padding so circular CSS
                 frames (rounded-full) render the logo edge-to-edge.
    tolerance:   color distance threshold (lower = stricter background detection)
    pad_pct:     extra padding around the detected bbox as a fraction of size
    """
    img = Image.open(input_path).convert("RGBA")
    w, h = img.size
    pixels = img.load()

    # Sample 4 corners — they should all be background
    corners = [pixels[0, 0], pixels[w - 1, 0], pixels[0, h - 1], pixels[w - 1, h - 1]]
    bg_color = tuple(sum(c[i] for c in corners) // 4 for i in range(3))
    print(f"Detected background color: RGB{bg_color}")

    # Build alpha mask: pixels far from background -> opaque, near background -> transparent.
    # We use a soft transition over a small distance band so anti-aliased edges
    # don't get hard-clipped, which would leave a visible cream halo around
    # curves in the badge. Pixels well within tolerance -> fully transparent;
    # well outside -> fully opaque; in-between -> linearly faded.
    mask = Image.new("L", (w, h), 0)
    mask_pixels = mask.load()
    matched = 0
    fade_band = 12  # extra distance over which alpha ramps from 0 to 255
    for y in range(h):
        for x in range(w):
            px = pixels[x, y]
            d = color_distance(px, bg_color)
            if d <= tolerance:
                mask_pixels[x, y] = 0
                matched += 1
            elif d >= tolerance + fade_band:
                mask_pixels[x, y] = 255
            else:
                # Linear ramp through the fade band
                mask_pixels[x, y] = int(255 * (d - tolerance) / fade_band)

    # Apply the mask as the image's alpha channel — background becomes transparent
    img.putalpha(mask)
    print(f"Background pixels (now transparent): {matched}/{w*h} ({100*matched/(w*h):.1f}%)")

    # Find bounding box of the mask
    bbox = mask.getbbox()
    if bbox is None:
        print(f"WARNING: no foreground pixels found — leaving {input_path} unchanged")
        return

    left, top, right, bottom = bbox
    bw, bh = right - left, bottom - top
    print(f"Bounding box: ({left}, {top}) -> ({right}, {bottom}) = {bw}x{bh}")

    # Crop with a small padding margin
    pad = int(max(bw, bh) * pad_pct)
    left = max(0, left - pad)
    top = max(0, top - pad)
    right = min(w, right + pad)
    bottom = min(h, bottom + pad)

    cropped = img.crop((left, top, right, bottom))
    cw, ch = cropped.size

    # Make the canvas square (centered) so a CSS rounded-full circle hits the edge
    side = max(cw, ch)
    canvas = Image.new("RGBA", (side, side), (0, 0, 0, 0))
    canvas.paste(cropped, ((side - cw) // 2, (side - ch) // 2))

    # Resize to target
    final = canvas.resize((target_size, target_size), Image.LANCZOS)

    # Backup, then overwrite (specify format explicitly since .bak isn't a known suffix)
    backup = input_path.with_suffix(input_path.suffix + ".bak")
    if not backup.exists():
        Image.open(input_path).save(backup, format="PNG")
        print(f"Backed up to {backup}")

    final.save(input_path, "PNG", optimize=True)
    print(f"Saved {input_path}: {target_size}x{target_size}, "
          f"file size {input_path.stat().st_size // 1024} KB")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    for arg in sys.argv[1:]:
        path = Path(arg)
        if not path.exists():
            print(f"ERROR: {path} not found")
            continue
        print(f"\n=== Processing {path} ===")
        crop_logo(path)
