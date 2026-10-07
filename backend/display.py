"""Display formatting for catalogue text.

The `catalogue.name` column was title-cased from URL slugs, which leaves artifacts a real
storefront would not show: "Benjamin Franklin 1 4 Zip", "School Of Art", "2025 Yale Vs
Harvard T Shirt", "Ua Mens Tech L S 2 0".

This fixes them **for display only**. The database is never modified, and the agent keeps
matching against the raw text, so cleaning here cannot cost us a search hit.
"""

from __future__ import annotations

import re

# Fractions written as separate digits by the slug: "1 4 Zip" -> "¼-Zip".
_FRACTIONS = [
    (re.compile(r"\b1 4[- ]?zip\b", re.I), "¼-Zip"),
    (re.compile(r"\b1 2[- ]?zip\b", re.I), "½-Zip"),
    (re.compile(r"\b3 4\b", re.I), "¾"),
]

# Garment words split by the slug's hyphen loss.
_COMPOUNDS = [
    (re.compile(r"\bT Shirt\b", re.I), "T-Shirt"),
    (re.compile(r"\bV Neck\b", re.I), "V-Neck"),
    (re.compile(r"\bCrew Neck\b", re.I), "Crew-Neck"),
    (re.compile(r"\bQuarter Zip\b", re.I), "Quarter-Zip"),
    (re.compile(r"\bFull Zip\b", re.I), "Full-Zip"),
    (re.compile(r"\bLong Sleeve\b", re.I), "Long-Sleeve"),
    (re.compile(r"\bShort Sleeve\b", re.I), "Short-Sleeve"),
    (re.compile(r"\bTri Blend\b", re.I), "Tri-Blend"),
    (re.compile(r"\bL S\b", re.I), "LS"),
    (re.compile(r"\bS S\b", re.I), "SS"),
]

# Brands and initialisms that title-casing flattened.
_BRANDS = {
    "ua": "UA",
    "nike": "Nike",
    "som": "SOM",
    "mba": "MBA",
    "ny": "NY",
    "usa": "USA",
    "ncaa": "NCAA",
}

# Words that stay lowercase inside a title (never first or last).
_MINOR = {"of", "the", "and", "in", "on", "for", "with", "at", "to", "a", "an", "vs"}

# Possessives the slug dropped: "Mens" -> "Men's".
_POSSESSIVES = [
    (re.compile(r"\bMens\b"), "Men's"),
    (re.compile(r"\bWomens\b"), "Women's"),
    (re.compile(r"\bKids\b"), "Kids'"),
    (re.compile(r"\bYales\b"), "Yale's"),
]

# "2 0" at the end of a name is a version number: "Tech LS 2 0" -> "Tech LS 2.0".
_VERSION = re.compile(r"\b(\d) (\d)\b(?!\s*\d)")


def product_name(raw: str) -> str:
    """Turn a slug-derived catalogue name into something a shop would print."""
    text = raw

    for pattern, replacement in _FRACTIONS:
        text = pattern.sub(replacement, text)
    for pattern, replacement in _COMPOUNDS:
        text = pattern.sub(replacement, text)
    for pattern, replacement in _POSSESSIVES:
        text = pattern.sub(replacement, text)

    text = _VERSION.sub(r"\1.\2", text)

    words = text.split()
    out: list[str] = []
    for i, word in enumerate(words):
        bare = word.lower().strip(".,")
        if bare in _BRANDS:
            out.append(_BRANDS[bare])
        elif bare == "vs":
            out.append("vs.")
        elif bare in _MINOR and 0 < i < len(words) - 1:
            out.append(bare)
        else:
            out.append(word)
    return " ".join(out)


def garment_type(raw: str) -> str:
    """Normalize the category line shown on cards.

    Casing only — this does NOT collapse the 22 values into categories. The two-level
    taxonomy (output/harness.md §3) stays a design note until a problem calls for it.
    """
    text = raw.strip().lower()
    for pattern, replacement in _COMPOUNDS:
        text = pattern.sub(replacement.lower(), text)
    # Capitalise the first letter only; "T-shirt" reads better than "T-Shirt" in a subtitle.
    return text[:1].upper() + text[1:] if text else text
