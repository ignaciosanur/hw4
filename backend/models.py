"""Structured types shared by the agent, its tools, and the FastAPI chat route.

Kept separate from the catalogue-serving models in main.py so the agent layer has one
clear contract. As in Homework 3, the agent returns prose while its tools accumulate the
product cards that the chat widget renders alongside that prose.
"""

from __future__ import annotations

from pydantic import BaseModel, Field


class SizeStock(BaseModel):
    size: str
    quantity: int


class ProductMatch(BaseModel):
    """A search hit — just enough for the agent to list options and pick a product_id to
    look up further. Deliberately omits the full description and per-size stock: those are
    one focused tool-call away (lookup_product / check_stock), so search stays short
    (Lecture 3: keep tool returns short) and the model is nudged to confirm live before
    quoting stock."""

    product_id: str          # the key the other tools need
    product_name: str        # what the shopper recognises
    garment_type: str        # lets the agent group/disambiguate ("the hoodie" vs "the tee")
    price: float             # answers the most common follow-up without another call
    colors: list[str] = Field(default_factory=list)
    total_stock: int = 0     # a coarse in-stock-at-all signal; per-size via check_stock


class ProductInfo(BaseModel):
    """Result of looking up one product's details — the answer to "what is this / how much".
    Carries the FULL description and price. Stock is intentionally not here: availability is
    live and belongs in check_stock, so the agent never quotes stock from a cached detail."""

    product_id: str
    product_name: str
    garment_type: str
    description: str          # the full catalogue description, not the card's clipped form
    price: float             # the authoritative price, read from the DB
    colors: list[str] = Field(default_factory=list)
    image_url: str


class SizeAvailability(BaseModel):
    """One size's live stock, with an explicit in_stock flag so the agent does not have to
    infer out-of-stock from a zero — it is told plainly."""

    size: str
    quantity: int
    in_stock: bool


class StockInfo(BaseModel):
    """Result of a stock lookup for one product: the total, every size, and — called out
    explicitly so the agent can say it clearly — which sizes are in and out of stock."""

    product_id: str
    product_name: str
    total_stock: int
    any_in_stock: bool               # false only if every size is zero
    in_stock_sizes: list[str]        # ready-made list for "available in S, M, L"
    out_of_stock_sizes: list[str]    # ready-made list for "XS and XL are out of stock"
    by_size: list[SizeAvailability]  # the full per-size detail


class ProductCard(BaseModel):
    """A product surfaced by the agent, rendered as a card in the chat widget.

    Mirrors the shape stored in the seed `chat_messages.products_json`, so the widget can
    render agent results the same way the catalogue pages render products."""

    product_id: str
    product_name: str
    garment_type: str
    price: float
    image_url: str
    short_description: str
    colors: list[str] = Field(default_factory=list)
    total_stock: int = 0
    sizes_in_stock: list[str] = Field(default_factory=list)
    sizes_out: list[str] = Field(default_factory=list)


class ChatTurn(BaseModel):
    """One prior message, sent by the front end so the agent has conversation context."""

    role: str  # "user" | "assistant"
    content: str


class PageContext(BaseModel):
    """What the shopper is looking at when they send a message, so references like "this"
    resolve. Currently the product being viewed on a single-item page."""

    product_id: str | None = None
    path: str | None = None


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list)
    page_context: PageContext | None = None


class HistoryMessage(BaseModel):
    """One stored past message, returned when a signed-in shopper's conversation reloads."""

    role: str
    content: str
    created_at: str


class ChatResponse(BaseModel):
    reply: str
    products: list[ProductCard] = Field(default_factory=list)
