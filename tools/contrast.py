#!/usr/bin/env python3
"""WCAG contrast checker for folio's night-gallery palette.

Verifies every declared (foreground, background) pair meets its target ratio.
Run before any commit that touches color tokens:  python3 tools/contrast.py

Exit code 0 = all pairs pass; 1 = at least one failure (printed).
"""

from __future__ import annotations

import sys

# ---------------------------------------------------------------- palette ---
# Night-gallery tokens. Keep in sync with :root in src/style.css.
TOKENS: dict[str, str] = {
    # walls & surfaces
    "bg": "#141210",          # museum wall, warm charcoal
    "surface": "#1d1a17",     # exhibit card
    "surface-2": "#262220",   # raised panel / code bg
    "stage": "#0c1222",       # session installation (pre-existing)
    # text
    "ink": "#f2ede4",         # warm ivory body text
    "muted": "#c5bdb1",       # secondary text
    "lead": "#d9d2c7",        # lede paragraphs
    # identity
    "brass": "#c9a86a",       # brass plaques / numbering
    "brass-bright": "#e3c88d",# brass on hover / on stage
    "accent": "#4fd1c5",      # teal glow (links, primary)
    "accent-ink": "#0b3d38",  # text on accent-filled buttons
    # status
    "ok": "#7fd8a5",
    "bad": "#f2a09c",
    "ok-bg": "#12271b",
    "bad-bg": "#2d1614",
    # hairlines (non-text UI)
    "line": "#453f38",
}

# ------------------------------------------------------------------ pairs ---
# (foreground, background, minimum ratio, note)
# Body text 7:1; secondary/status/interactive text 4.5:1; non-text UI 3:1.
PAIRS: list[tuple[str, str, float, str]] = [
    # body text everywhere it sits
    ("ink", "bg", 7.0, "body on wall"),
    ("ink", "surface", 7.0, "body on card"),
    ("ink", "surface-2", 7.0, "body on raised panel"),
    ("ink", "stage", 7.0, "body on stage"),
    # secondary text
    ("muted", "bg", 4.5, "muted on wall (target 7)"),
    ("muted", "surface", 4.5, "muted on card (target 7)"),
    ("muted", "surface-2", 4.5, "muted on raised panel"),
    ("muted", "stage", 4.5, "muted on stage"),
    ("lead", "bg", 7.0, "lede on wall"),
    # identity
    ("brass", "bg", 4.5, "plaque text on wall"),
    ("brass", "surface", 4.5, "plaque text on card"),
    ("brass-bright", "stage", 4.5, "brass on stage"),
    ("accent", "bg", 4.5, "link on wall"),
    ("accent", "surface", 4.5, "link on card"),
    ("accent-ink", "accent", 4.5, "label on filled primary button"),
    # status
    ("ok", "surface", 4.5, "ok text on card"),
    ("bad", "surface", 4.5, "error text on card"),
    ("ok", "ok-bg", 4.5, "ok text on ok tint"),
    ("bad", "bad-bg", 4.5, "error text on error tint"),
    # non-text UI
    ("line", "bg", 1.2, "hairline vs wall (decorative)"),
    ("brass", "surface-2", 4.5, "plaque on raised panel"),
    ("accent", "stage", 4.5, "link on stage"),
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
        r = ratio(TOKENS[fg], TOKENS[bg])
        status = "PASS" if r >= minimum else "FAIL"
        if r < minimum:
            failures += 1
        print(f"{fg + ' / ' + bg:<34} {r:>6.2f}:1 {minimum:>4.1f}:1  {status}  {note}")
    print("-" * 78)
    for fg, bg, target, note in SOFT_PAIRS:
        r = ratio(TOKENS[fg], TOKENS[bg])
        mark = "meets" if r >= target else "below"
        print(f"soft: {fg}/{bg} = {r:.2f}:1 ({mark} {target}:1 target) — {note}")
    if failures:
        print(f"\n{failures} pair(s) FAILED")
        return 1
    print("\nAll required pairs pass.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
