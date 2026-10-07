"""PydanticAI shop agent: wiring only.

Loads the model from the environment (Portkey gateway) and the system prompt from
prompts/prompt.md, registers the database tools from tools.py, and exposes run_chat()
for the FastAPI chat route. The prompt file is meant to grow — editing prompts/prompt.md
changes the agent's behaviour with no code change here.

Tool returns are the typed models in models.py, so the agent reads structured results
(e.g. StockInfo spells out which sizes are out of stock) rather than parsing prose.
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
from pydantic_ai.usage import UsageLimits

import tools
from models import ChatResponse, ChatTurn, ProductCard, ProductInfo, ProductMatch, StockInfo

ROOT = Path(__file__).resolve().parent.parent
load_dotenv(ROOT / ".env")

DB_PATH = ROOT / "data" / "campus_customs.db"
PROMPT_PATH = Path(__file__).resolve().parent / "prompts" / "prompt.md"

# Stopping rule (Lecture 4 harness): cap model requests so the ReAct loop cannot run away.
USAGE_LIMITS = UsageLimits(request_limit=8)


def _build_model() -> OpenAIChatModel:
    """All agent calls go through PORTKEY_API_KEY; model name from .env (never hard-coded)."""
    key = os.getenv("PORTKEY_API_KEY")
    if not key:
        raise RuntimeError("PORTKEY_API_KEY is not set; the agent cannot start.")
    base_url = os.getenv("OPENAI_BASE_URL", "https://api.portkey.ai/v1")
    client = AsyncOpenAI(api_key=key, base_url=base_url, default_headers={"x-portkey-api-key": key})
    model_name = os.getenv("OPENAI_MODEL") or "gpt-5.6-luna"
    return OpenAIChatModel(model_name, provider=OpenAIProvider(openai_client=client))


@dataclass
class ChatDeps:
    """Per-request state. `surfaced` collects the product cards show_products chose, keyed
    by id to dedupe, so the route can return them with the reply."""

    db_path: Path
    first_name: str | None = None
    surfaced: dict[str, ProductCard] = field(default_factory=dict)


SYSTEM_PROMPT = PROMPT_PATH.read_text()

agent = Agent(_build_model(), deps_type=ChatDeps, system_prompt=SYSTEM_PROMPT)


@agent.system_prompt
def _who_is_here(ctx: RunContext[ChatDeps]) -> str:
    if ctx.deps.first_name:
        return f"The shopper is signed in. Their first name is {ctx.deps.first_name}."
    return "The shopper is browsing as a guest (not signed in)."


# --- tools: every answer about price or stock comes from one of these, read live from the DB ---

@agent.tool
def search_products(ctx: RunContext[ChatDeps], query: str, max_results: int = 8) -> list[ProductMatch]:
    """Find products matching free text (words, colours, garment type, occasion). Returns
    candidates with their product_id and price. Use this to discover products or to turn a
    name the shopper used into a product_id. It does NOT display anything — call
    show_products with the ids you choose to recommend."""
    return tools.search_catalogue(ctx.deps.db_path, query, max_results)


@agent.tool
def lookup_product(ctx: RunContext[ChatDeps], product_id: str) -> ProductInfo | str:
    """Get one product's description, price and colours by its product_id. Use this for any
    question about what a product is, its price, or its colours — never answer from memory."""
    info = tools.lookup_product(ctx.deps.db_path, product_id)
    return info or f"No product with id '{product_id}'."


@agent.tool
def check_stock(ctx: RunContext[ChatDeps], product_id: str) -> StockInfo | str:
    """Get live stock for one product by its product_id: the total and every size, with the
    in-stock and out-of-stock sizes called out. Use this for any availability or size
    question. If a size is out of stock, tell the shopper plainly."""
    info = tools.check_stock(ctx.deps.db_path, product_id)
    return info or f"No product with id '{product_id}'."


@agent.tool
def show_products(ctx: RunContext[ChatDeps], product_ids: list[str]) -> str:
    """Display the given products to the shopper as clickable cards. Pass only the ids you
    are actually recommending, so the cards match what your reply talks about."""
    shown = []
    for pid in product_ids:
        card = tools.get_card(ctx.deps.db_path, pid)
        if card:
            ctx.deps.surfaced[card.product_id] = card
            shown.append(card.product_name)
    return "Shown to shopper: " + ", ".join(shown) if shown else "No matching product ids to show."


@agent.tool_plain
def list_categories() -> str:
    """List the shop's product categories and their prices."""
    cats = tools.list_categories(DB_PATH)
    return "; ".join(f"{name} ${price:.0f}" for name, price in cats.items())


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
    result = await agent.run(
        message, deps=deps, message_history=_to_history(history or []), usage_limits=USAGE_LIMITS
    )
    return ChatResponse(reply=result.output, products=list(deps.surfaced.values()))
