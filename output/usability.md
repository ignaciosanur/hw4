# Usability improvements (Problem 9)

Four improvements on top of the working shop — two front-end, two agent/backend. Each is live
in the running app.

## Front-end

### FE1 — Browse controls on the Products page (filter, search, sort)
**What we added.** A control bar above the catalogue grid: category chips built from the L1
price-tier taxonomy (All, T-shirt, Lightweight/performance, Crewneck, Hoodie, Quarter-zip,
Full-zip hoodie, Jacket), a live keyword search box (name / type / colour), an **In stock only**
toggle, and a sort control (Featured, Price low→high, Price high→low, Name A–Z). Filtering is
instant and client-side.
**Why it helps.** 102 items is too many to scroll. A shopper who wants "a hoodie under $70 in navy"
can get there in two clicks instead of hunting. For the business, easier browsing means fewer
bounces and more items seen per visit. It also puts the Problem 2 taxonomy to work on the storefront.

### FE2 — "You might also like" on the product page
**What we added.** Each single-item page shows a row of related products (same category / shared
search tags, in stock), as the same clickable cards used everywhere.
**Why it helps.** Shoppers rarely want exactly one thing; showing close alternatives keeps them
browsing and rescues the case where their size is out of stock in the item they opened. For the
business this is classic cross-sell — more basket depth per visit.

## Agent / backend

### BE1 — `filter_products` tool (more accurate answers)
**What we added.** A structured catalogue-filter tool the agent can call with explicit constraints:
category (price tier), maximum price, colour, and a size that must be in stock. It returns only
products that match every constraint, read live from the database.
**Why it helps.** Free-text search is fuzzy on precise asks. "Show me hoodies under $70 in navy
that have an XL" is answered exactly, with no near-misses and no inventing — the agent filters on
real data instead of guessing from a text match. More accurate answers, fewer wrong recommendations.

### BE2 — Guest response caching (tokenomics: faster and cheaper)
**What we added.** Repeated identical questions from signed-out shoppers (no personalisation, no
page context) are served from a short-lived in-process cache instead of calling the model again.
The common opener "what hoodies do you have?" costs one model run; the next identical ask within
the window returns instantly with zero tokens.
**Why it helps.** The lectures' tokenomics point: don't pay the model twice for the same answer.
Guests ask the same handful of questions constantly, so caching cuts latency to near zero and cost
to zero on those repeats, while signed-in and context-specific chats always run fresh so nothing
personal is ever cached or stale. Short TTL keeps stock answers honest.
