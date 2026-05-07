"""One-off helper to fix backslash-escaped quotes in usePageTitle calls."""
from pathlib import Path

pages_dir = Path("frontend/src/pages")
fixed = 0
for p in pages_dir.glob("*.js"):
    text = p.read_text(encoding="utf-8")
    new = text.replace("\\'", "'")
    if new != text:
        p.write_text(new, encoding="utf-8")
        print(f"  fixed {p.name}")
        fixed += 1
print(f"Total: {fixed}")
