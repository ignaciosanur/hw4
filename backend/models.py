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


class ChatRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    history: list[ChatTurn] = Field(default_factory=list)


class ChatResponse(BaseModel):
    reply: str
    products: list[ProductCard] = Field(default_factory=list)
