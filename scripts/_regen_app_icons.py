"""Regenerate PWA / app icons with proper backgrounds.

Source of truth: frontend/public/logo-icon.png (transparent, 512x512).

Outputs (all written to frontend/public/):
  - apple-touch-icon.png      180x180, teal bg (iOS ignores alpha)
  - android-chrome-192x192.png 192x192, transparent (Android handles alpha)
  - android-chrome-512x512.png 512x512, transparent
  - android-chrome-maskable-192.png 192x192, teal bg + 80% safe area
  - android-chrome-maskable-512.png 512x512, teal bg + 80% safe area

Why maskable: Android home-screen launchers crop icons into a shape
(circle/squircle/rounded square depending on device). A "maskable" icon
includes a colored backdrop so the crop never clips the logo.
"""
from PIL import Image
from pathlib import Path

PUBLIC = Path("frontend/public")
SRC = PUBLIC / "logo-icon.png"
BG = (30, 107, 107, 255)  # #1e6b6b — matches theme_color in manifest


def fit_centered(src: Image.Image, canvas_size: int, logo_fraction: float, bg) -> Image.Image:
    """Place src centered on a canvas, scaled so its bounding box fits
    within `logo_fraction` of the canvas (e.g. 0.8 = 80% safe area)."""
    canvas = Image.new("RGBA", (canvas_size, canvas_size), bg)
    target = int(canvas_size * logo_fraction)
    # Preserve aspect ratio while fitting into target x target.
    s = src.copy()
    s.thumbnail((target, target), Image.LANCZOS)
    x = (canvas_size - s.width) // 2
    y = (canvas_size - s.height) // 2
    canvas.alpha_composite(s, (x, y))
    return canvas


def main():
    src = Image.open(SRC).convert("RGBA")

    # apple-touch-icon: iOS forces opaque, so bake teal in. Logo at ~88%
    # because iOS auto-applies its own rounded-corner mask outside of that.
    apple = fit_centered(src, 180, 0.88, BG)
    apple.save(PUBLIC / "apple-touch-icon.png", optimize=True)
    print("wrote apple-touch-icon.png (180x180, teal bg)")

    # android-chrome (transparent — used as "any" purpose icons)
    for sz in (192, 512):
        out = src.resize((sz, sz), Image.LANCZOS)
        out.save(PUBLIC / f"android-chrome-{sz}x{sz}.png", optimize=True)
        print(f"wrote android-chrome-{sz}x{sz}.png (transparent)")

    # maskable variants — logo at 70% so safe-area survives any mask shape
    for sz in (192, 512):
        m = fit_centered(src, sz, 0.70, BG)
        m.save(PUBLIC / f"android-chrome-maskable-{sz}.png", optimize=True)
        print(f"wrote android-chrome-maskable-{sz}.png (teal bg, 70% safe)")


if __name__ == "__main__":
    main()
