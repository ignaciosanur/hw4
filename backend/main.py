"""Campus Customs API — read-only catalogue service for Homework 4, Problem 3.

Serves the product catalogue and product images to the React front end. The agent
backend grows out of this in Problem 5.

    .venv/bin/python -m uvicorn backend.main:app --reload --port 8010

Design notes (see output/harness.md):
- Images are served under /media/, the convention inferred from the `image_url` field
  in the seeded chat_messages.products_json.
- Responses never use a bare `name` or `id`: `product_id` / `product_name` instead, so
  nothing collides with the user fields of the same name (harness §4.6).
- The database is opened read-only; this problem does not write.
"""

from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from backend import display

ROOT = Path(__file__).resolve().parent.parent
DB_PATH = ROOT / "data" / "campus_customs.db"
PRODUCTS_DIR = ROOT / "data" / "products"

app = FastAPI(title="Campus Customs API", version="0.1.0")

# The Vite dev server runs on a different port, so the browser needs CORS.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5183", "http://127.0.0.1:5183"],
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------- models

class SizeStock(BaseModel):
    size: str
    quantity: int


class ProductSummary(BaseModel):
    """What a product card needs. Deliberately small — the grid loads 102 of these."""

    product_id: str
    product_name: str
    garment_type: str
    price: float
    image_url: str
    short_description: str
    colors: list[str]


class ProductDetail(ProductSummary):
    """Adds the full text and per-size stock for the single-item page."""

    description: str
    search_tags: list[str]
    inventory: list[SizeStock]
    total_stock: int


# ---------------------------------------------------------------- data access

@contextmanager
def get_db():
    """Read-only connection. Fails loudly if the git-ignored database is absent."""
    if not DB_PATH.exists():
        raise HTTPException(
            status_code=503,
            detail=f"Database not found at {DB_PATH}. It is git-ignored; restore it from the course data.",
        )
    conn = sqlite3.connect(f"file:{DB_PATH}?mode=ro", uri=True)
    conn.row_factory = sqlite3.Row
    try:
        yield conn
    finally:
        conn.close()


# Explicit column lists everywhere, never SELECT * (harness §4.6).
CATALOGUE_COLUMNS = (
    "product_id, name, garment_type, description, colors, search_tags, image_file_path, price"
)


def short(text: str, limit: int = 110) -> str:
    """First sentence, or a clipped prefix — enough for a card without wrapping forever."""
    first = text.split(". ")[0].strip().rstrip(".")
    if len(first) <= limit:
        return first + "."
    return first[:limit].rsplit(" ", 1)[0] + "…"


def image_url(image_file_path: str) -> str:
    """'products/foo.jpg' -> '/media/products/foo.jpg'."""
    return f"/media/{image_file_path}"


def to_summary(row: sqlite3.Row) -> ProductSummary:
    return ProductSummary(
        product_id=row["product_id"],
        # Display formatting only; the stored text is untouched so the agent can still
        # match against it verbatim (see backend/display.py).
        product_name=display.product_name(row["name"]),
        garment_type=display.garment_type(row["garment_type"]),
        price=row["price"],
        image_url=image_url(row["image_file_path"]),
        short_description=short(row["description"]),
        colors=json.loads(row["colors"]),
    )


# ---------------------------------------------------------------- routes

@app.get("/api/health")
def health() -> dict:
    """Used by the front end to show an honest 'API offline' state."""
    with get_db() as conn:
        n = conn.execute("SELECT COUNT(*) FROM catalogue").fetchone()[0]
    return {"status": "ok", "products": n}


@app.get("/api/products", response_model=list[ProductSummary])
def list_products() -> list[ProductSummary]:
    with get_db() as conn:
        rows = conn.execute(f"SELECT {CATALOGUE_COLUMNS} FROM catalogue ORDER BY name").fetchall()
    return [to_summary(r) for r in rows]


@app.get("/api/products/{product_id}", response_model=ProductDetail)
def get_product(product_id: str) -> ProductDetail:
    with get_db() as conn:
        row = conn.execute(
            f"SELECT {CATALOGUE_COLUMNS} FROM catalogue WHERE product_id = ?", (product_id,)
        ).fetchone()
        if row is None:
            raise HTTPException(status_code=404, detail=f"No product '{product_id}'")
        # Sizes sort alphabetically in SQL, which is wrong for clothing; order them properly.
        stock = conn.execute(
            """SELECT size, quantity FROM inventory WHERE product_id = ?
               ORDER BY CASE size WHEN 'XS' THEN 1 WHEN 'S' THEN 2 WHEN 'M' THEN 3
                                  WHEN 'L' THEN 4 WHEN 'XL' THEN 5 WHEN 'XXL' THEN 6 ELSE 7 END""",
            (product_id,),
        ).fetchall()

    inventory = [SizeStock(size=s["size"], quantity=s["quantity"]) for s in stock]
    return ProductDetail(
        **to_summary(row).model_dump(),
        description=row["description"],
        search_tags=json.loads(row["search_tags"]),
        inventory=inventory,
        total_stock=sum(i.quantity for i in inventory),
    )


@app.post("/api/chat")
def chat_stub(payload: dict) -> dict:
    """Placeholder so the front-end chat has a real endpoint to call.

    Problem 5 replaces this with the PydanticAI agent. It deliberately returns no
    products: inventing matches here would make the stub look more finished than it is.
    """
    message = (payload or {}).get("message", "")
    return {
        "reply": (
            "Thanks for the message! The Campus Customs assistant isn't connected yet — "
            "it arrives in Problem 5. Until then, browse the Products page for the full "
            f"catalogue. (You said: “{message[:200]}”)"
        ),
        "products": [],
        "stub": True,
    }


# Product images. Mounted last so it cannot shadow an /api route.
if PRODUCTS_DIR.exists():
    app.mount("/media/products", StaticFiles(directory=PRODUCTS_DIR), name="product-images")
