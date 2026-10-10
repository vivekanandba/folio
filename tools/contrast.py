#!/usr/bin/env python3
"""WCAG contrast checker for folio's night-gallery palette.

Verifies every declared (foreground, background) pair meets its target ratio.
Run before any commit that touches color tokens:  python3 tools/contrast.py

Exit code 0 = all pairs pass; 1 = at least one failure (printed).
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

# ---------------------------------------------------------------- palette ---
# The palette is READ FROM src/style.css, never copied into this file.
#
# It used to be a hand-maintained duplicate and had already drifted: this
# checker carried `stage` and `bad-bg`, neither of which is declared anywhere
# in the stylesheet. It was validating two colours the app does not have, and
# passing. Two copies of the same values is the boundary defect CON-COV-003
# warns about, so now there is one copy and this reads it.

CSS = Path(__file__).resolve().parent.parent / "src" / "style.css"
TOKEN_RE = re.compile(r"--([a-z0-9-]+)\s*:\s*(#[0-9a-fA-F]{3,8})\s*;")


def load_tokens(css_path: Path) -> dict[str, str]:
    """Every `--name: #hex;` custom property the stylesheet declares."""
    tokens = dict(TOKEN_RE.findall(css_path.read_text(encoding="utf-8")))
    if not tokens:
        sys.exit(f"contrast: no colour tokens found in {css_path} — has the format changed?")
    return tokens


TOKENS: dict[str, str] = load_tokens(CSS)


def require(name: str) -> str:
    """A pair may only name a token the stylesheet actually declares."""
    if name not in TOKENS:
        sys.exit(
            f"contrast: '{name}' is checked here but is not declared in {CSS.name}. "
            "Either the token was renamed or this check is stale — fix one of them."
        )
    return TOKENS[name]


# ------------------------------------------------------------------ pairs ---
# (foreground, background, minimum ratio, note)
# Body text 7:1; secondary/status/interactive text 4.5:1; non-text UI 3:1.
PAIRS: list[tuple[str, str, float, str]] = [
    # body text everywhere it sits
    ("ink", "bg", 7.0, "body on wall"),
    ("ink", "surface", 7.0, "body on card"),
    ("ink", "surface-2", 7.0, "body on raised panel"),
    # secondary text
    ("muted", "bg", 4.5, "muted on wall (target 7)"),
    ("muted", "surface", 4.5, "muted on card (target 7)"),
    ("muted", "surface-2", 4.5, "muted on raised panel"),
    ("lead", "bg", 7.0, "lede on wall"),
    # identity
    ("brass", "bg", 4.5, "plaque text on wall"),
    ("brass", "surface", 4.5, "plaque text on card"),
    ("accent", "bg", 4.5, "link on wall"),
    ("accent", "surface", 4.5, "link on card"),
    ("accent-ink", "accent", 4.5, "label on filled primary button"),
    # status
    ("ok", "surface", 4.5, "ok text on card"),
    ("bad", "surface", 4.5, "error text on card"),
    ("ok", "ok-bg", 4.5, "ok text on ok tint"),
    # non-text UI
    ("line", "bg", 1.2, "hairline vs wall (decorative)"),
    ("brass", "surface-2", 4.5, "plaque on raised panel"),
    ("muted", "ok-bg", 4.5, "muted on ok tint"),
]

# aspirational (report, don't fail): muted should ideally hit 7:1 on main surfaces
SOFT_PAIRS: list[tuple[str, str, float, str]] = [
    ("muted", "bg", 7.0, "muted on wall"),
    ("muted", "surface", 7.0, "muted on card"),
]


def srgb_channel(c: float) -> float:
    c /= 255.0
    return c / 12.92 if c <= 0.04045 * 12.92 else ((c + 0.055) / 1.055) ** 2.4


def luminance(hex_color: str) -> float:
    h = hex_color.lstrip("#")
    r, g, b = (int(h[i : i + 2], 16) for i in (0, 2, 4))
    return 0.2126 * srgb_channel(r) + 0.7152 * srgb_channel(g) + 0.0722 * srgb_channel(b)


def ratio(fg: str, bg: str) -> float:
    l1, l2 = sorted((luminance(fg), luminance(bg)), reverse=True)
    return (l1 + 0.05) / (l2 + 0.05)


def main() -> int:
    failures = 0
    print(f"{'pair':<34} {'ratio':>7}  {'min':>5}  note")
    print("-" * 78)
    for fg, bg, minimum, note in PAIRS:
        r = ratio(require(fg), require(bg))
        status = "PASS" if r >= minimum else "FAIL"
        if r < minimum:
            failures += 1
        print(f"{fg + ' / ' + bg:<34} {r:>6.2f}:1 {minimum:>4.1f}:1  {status}  {note}")
    print("-" * 78)
    for fg, bg, target, note in SOFT_PAIRS:
        r = ratio(require(fg), require(bg))
        mark = "meets" if r >= target else "below"
        print(f"soft: {fg}/{bg} = {r:.2f}:1 ({mark} {target}:1 target) — {note}")
    if failures:
        print(f"\n{failures} pair(s) FAILED")
        return 1
    print("\nAll required pairs pass.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
