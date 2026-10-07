"""PydanticAI shop agent: wiring only.

Loads the model from the environment (Portkey gateway) and the system prompt from
prompts/prompt.md, registers the database tools from tools.py, and exposes run_chat()
for the FastAPI chat route. The prompt file is meant to grow in later problems — editing
prompts/prompt.md changes the agent's behaviour with no code change here.
"""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path

from dotenv import load_dotenv
from openai import AsyncOpenAI
from pydantic_ai import Agent, RunContext
from pydantic_ai.messages import (
    ModelMessage,
    ModelRequest,
    ModelResponse,
    TextPart,
    UserPromptPart,
)
from pydantic_ai.models.openai import OpenAIChatModel
from pydantic_ai.providers.openai import OpenAIProvider

import tools
from models import ChatResponse, ChatTurn, ProductCard

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DB_PATH = ROOT / "data" / "campus_customs.db"
PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "prompt.md"


def _build_model() -> OpenAIChatModel:
    """All agent calls go through PORTKEY_API_KEY, model name read from .env (never
    hard-coded). The course budget assumes gpt-5.6-luna."""
    key = os.getenv("PORTKEY_API_KEY")
    if not key:
        raise RuntimeError("PORTKEY_API_KEY is not set; the agent cannot start.")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.portkey.ai/v1")
    client = AsyncOpenAI(api_key=key, base_url=base_url, default_headers={"x-portkey-api-key": key})
    model_name = os.getenv("OPENAI_MODEL") or "gpt-5.6-luna"
    return OpenAIChatModel(model_name, provider=OpenAIProvider(openai_client=client))


@dataclass
class ChatDeps:
    """Per-request state. `surfaced` collects the product cards tools produced, keyed by
    id to dedupe, so the route can return them with the reply."""

    db_path: Path
    first_name: str | None = None
    surfaced: dict[str, ProductCard] = field(default_factory=dict)   # shown to shopper
    _found: dict[str, ProductCard] = field(default_factory=dict)     # searched, not yet shown


SYSTEM_PROMPT = PROMPT_PATH.read_text()

agent = Agent(_build_model(), deps_type=ChatDeps, system_prompt=SYSTEM_PROMPT)


@agent.system_prompt
def _who_is_here(ctx: RunContext[ChatDeps]) -> str:
    """Append the signed-in shopper's first name, if any, so the model can greet them."""
    if ctx.deps.first_name:
        return f"The shopper is signed in. Their first name is {ctx.deps.first_name}."
    return "The shopper is browsing as a guest (not signed in)."


# --- tools (thin wrappers over tools.py; they also stash cards for the widget) ---

@agent.tool
def search_products(ctx: RunContext[ChatDeps], query: str, max_results: int = 8) -> str:
    """Search the catalogue for products matching free text (words, colours, garment type,
    occasion). Returns candidate products with their ids, price and live stock. This does
    NOT display anything to the shopper — call show_products with the ids you choose to
    recommend so the shopper sees them as cards."""
    cards = tools.search_products(ctx.deps.db_path, query, max_results)
    # Cache so show_products need not re-query, but do not surface yet.
    for c in cards:
        ctx.deps._found[c.product_id] = c
    return _render(cards) if cards else "No products matched that search."


@agent.tool
def show_products(ctx: RunContext[ChatDeps], product_ids: list[str]) -> str:
    """Display the given products to the shopper as clickable cards. Pass only the ids you
    are actually recommending, so the cards match what your reply talks about."""
    shown = []
    for pid in product_ids:
        card = ctx.deps._found.get(pid) or tools.get_product(ctx.deps.db_path, pid)
        if card:
            ctx.deps.surfaced[card.product_id] = card
            shown.append(card.product_name)
    return "Shown to shopper: " + ", ".join(shown) if shown else "No matching product ids to show."


@agent.tool
def get_product(ctx: RunContext[ChatDeps], product_id: str) -> str:
    """Get full details and live per-size stock for one product by its id."""
    card = tools.get_product(ctx.deps.db_path, product_id)
    if not card:
        return f"No product with id '{product_id}'."
    ctx.deps.surfaced[card.product_id] = card
    return _render([card])


@agent.tool
def check_stock(ctx: RunContext[ChatDeps], product_id: str) -> str:
    """Check live per-size stock for one product by its id."""
    info = tools.check_stock(ctx.deps.db_path, product_id)
    if not info:
        return f"No product with id '{product_id}'."
    sizes = ", ".join(f"{s}: {q}" for s, q in info["sizes"].items())
    return f"{info['product_name']} — stock by size: {sizes} (total {info['total']})."


@agent.tool_plain
def list_categories() -> str:
    """List the shop's product categories and their prices."""
    cats = tools.list_categories(DB_PATH)
    return "; ".join(f"{name} ${price:.0f}" for name, price in cats.items())


def _render(cards: list[ProductCard]) -> str:
    """Compact text form of cards for the model to read (the shopper sees real cards)."""
    lines = []
    for c in cards:
        stock = "out of stock" if not c.sizes_in_stock else f"sizes {', '.join(c.sizes_in_stock)}"
        out = f" (out: {', '.join(c.sizes_out)})" if c.sizes_out and c.sizes_in_stock else ""
        lines.append(f"- [{c.product_id}] {c.product_name} — ${c.price:.0f}, "
                     f"colours {', '.join(c.colors)}, {stock}{out}")
    return "\n".join(lines)


def _to_history(turns: list[ChatTurn]) -> list[ModelMessage]:
    """Convert the front end's prior turns into PydanticAI message history."""
    history: list[ModelMessage] = []
    for t in turns:
        if t.role == "user":
            history.append(ModelRequest(parts=[UserPromptPart(content=t.content)]))
        elif t.role == "assistant":
            history.append(ModelResponse(parts=[TextPart(content=t.content)]))
    return history


async def run_chat(message: str, first_name: str | None = None,
                   history: list[ChatTurn] | None = None) -> ChatResponse:
    """Run one chat turn and return the reply plus any product cards the tools surfaced."""
    deps = ChatDeps(db_path=DB_PATH, first_name=first_name)
    result = await agent.run(message, deps=deps, message_history=_to_history(history or []))
    return ChatResponse(reply=result.output, products=list(deps.surfaced.values()))
