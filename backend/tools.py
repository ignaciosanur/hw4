"""Database-backed tools the shop agent can call.

Pure functions (no agent decorators) so they are independently testable; agent.py wraps
them as PydanticAI tools. Every function opens the database **read-only** — the agent can
read the catalogue and live stock but can never write through a tool.

The tools are split by intent so each return type is small and purpose-built (Lecture 3:
keep tool returns short):
- search_catalogue -> ProductMatch   : find products / resolve a name to a product_id
- lookup_product   -> ProductInfo     : description, price, colours for one product
- check_stock      -> StockInfo        : live per-size stock, with out-of-stock called out
- get_card         -> ProductCard      : the richer shape the chat widget renders
Stock is always read live here, never baked into the prompt: 24% of size rows are out of
stock (output/harness.md §2), so availability must be queried every time it matters.
"""

from __future__ import annotations

import json
import sqlite3
from pathlib import Path

import display
from models import ProductCard, ProductInfo, ProductMatch, SizeAvailability, StockInfo

_SIZE_ORDER = (
    "CASE size WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3 "
    "WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6 ELSE 7 END"
)
_COLUMNS = "product_id, name, garment_type, description, colors, search_tags, image_file_path, price"


def _connect(db_path: Path) -> sqlite3.Connection:
    conn = sqlite3.connect(f"file:{db_path}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    return conn


def _short(text: str, limit: int = 110) -> str:
    first = text.split(". ")[0].strip().rstrip(".")
    return first + "." if len(first) <= limit else first[:limit].rsplit(" ", 1)[0] + "…"


def _sizes(conn: sqlite3.Connection, product_id: str) -> list[SizeAvailability]:
    rows = conn.execute(
        f"SELECT size, quantity FROM inventory WHERE product_id = ? ORDER BY {_SIZE_ORDER}",
        (product_id,),
    ).fetchall()
    return [SizeAvailability(size=r["size"], quantity=r["quantity"], in_stock=r["quantity"] > 0) for r in rows]


def search_catalogue(db_path: Path, query: str, max_results: int = 8) -> list[ProductMatch]:
    """Find catalogue products matching free-text words against name, garment type,
    description, colours and search_tags; rank by how many query words match.

    Searching description + search_tags alongside the label is deliberate: it is a strict
    superset of the messy garment_type values (output/harness.md finding 2), so nothing is
    missed to a label inconsistency."""
    words = [w.lower() for w in query.split() if len(w) > 1]
    if not words:
        return []
    conn = _connect(db_path)
    try:
        rows = conn.execute(f"SELECT {_COLUMNS} FROM catalogue").fetchall()
        scored = []
        for row in rows:
            haystack = " ".join(
                [row["name"], row["garment_type"], row["description"], row["colors"], row["search_tags"]]
            ).lower()
            score = sum(1 for w in words if w in haystack)
            if score:
                total = conn.execute(
                    "SELECT COALESCE(SUM(quantity), 0) FROM inventory WHERE product_id = ?",
                    (row["product_id"],),
                ).fetchone()[0]
                scored.append((score, row, total))
        scored.sort(key=lambda s: s[0], reverse=True)
        return [
            ProductMatch(
                product_id=row["product_id"],
                product_name=display.product_name(row["name"]),
                garment_type=display.garment_type(row["garment_type"]),
                price=row["price"],
                colors=json.loads(row["colors"]),
                total_stock=total,
            )
            for _, row, total in scored[:max_results]
        ]
    finally:
        conn.close()


def lookup_product(db_path: Path, product_id: str) -> ProductInfo | None:
    """Full details for one product: description, price, colours. None if id is unknown."""
    conn = _connect(db_path)
    try:
        row = conn.execute(f"SELECT {_COLUMNS} FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None:
            return None
        return ProductInfo(
            product_id=row["product_id"],
            product_name=display.product_name(row["name"]),
            garment_type=display.garment_type(row["garment_type"]),
            description=row["description"],
            price=row["price"],
            colors=json.loads(row["colors"]),
            image_url=f"/media/{row['image_file_path']}",
        )
    finally:
        conn.close()


def check_stock(db_path: Path, product_id: str) -> StockInfo | None:
    """Live per-size stock for one product, with in/out-of-stock called out. None if
    the product id is unknown."""
    conn = _connect(db_path)
    try:
        row = conn.execute("SELECT name FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None:
            return None
        sizes = _sizes(conn, product_id)
    finally:
        conn.close()
    return StockInfo(
        product_id=product_id,
        product_name=display.product_name(row["name"]),
        total_stock=sum(s.quantity for s in sizes),
        any_in_stock=any(s.in_stock for s in sizes),
        in_stock_sizes=[s.size for s in sizes if s.in_stock],
        out_of_stock_sizes=[s.size for s in sizes if not s.in_stock],
        by_size=sizes,
    )


def get_card(db_path: Path, product_id: str) -> ProductCard | None:
    """The richer shape the chat widget renders (image, short description, stock summary)."""
    conn = _connect(db_path)
    try:
        row = conn.execute(f"SELECT {_COLUMNS} FROM catalogue WHERE product_id = ?", (product_id,)).fetchone()
        if row is None:
            return None
        sizes = _sizes(conn, product_id)
    finally:
        conn.close()
    return ProductCard(
        product_id=row["product_id"],
        product_name=display.product_name(row["name"]),
        garment_type=display.garment_type(row["garment_type"]),
        price=row["price"],
        image_url=f"/media/{row['image_file_path']}",
        short_description=_short(row["description"]),
        colors=json.loads(row["colors"]),
        total_stock=sum(s.quantity for s in sizes),
        sizes_in_stock=[s.size for s in sizes if s.in_stock],
        sizes_out=[s.size for s in sizes if not s.in_stock],
    )


def list_categories(db_path: Path) -> dict[str, float]:
    """Price-tier categories (the L1 taxonomy, output/harness.md §3): seven real categories
    derived from the flat per-category price, each mapped to that price."""
    conn = _connect(db_path)
    try:
        rows = conn.execute("SELECT DISTINCT price FROM catalogue ORDER BY price").fetchall()
    finally:
        conn.close()
    labels = {32: "T-shirt", 45: "Lightweight / performance", 58: "Crewneck sweatshirt",
              68: "Hoodie", 72: "Quarter-zip", 88: "Full-zip hoodie", 98: "Jacket"}
    return {labels.get(int(r["price"]), f"${r['price']:.0f} items"): r["price"] for r in rows}
