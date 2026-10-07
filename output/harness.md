# Campus Customs — Build Harness

The working document for Homework 4. It grows each problem: Problem 2 starts it with the
data dictionary; models, tools, safety and specs follow.

Machine-generated profiling (types, heads, distributions) lives in
[`data_exploration.md`](data_exploration.md), regenerated with `.venv/bin/python explore_db.py`.
This file holds the human read: what each field is *for*.

---

## 1. Data dictionary

### `catalogue` — 102 rows, one per product

These fields exist to **filter, pull and categorize** — they are what a shopping UI is built out of,
and what the chatbot narrows a request with.

| field | type | why it matters |
|---|---|---|
| `product_id` | TEXT, PK | The slug the whole app keys on — URLs, cart lines, and the chatbot's product references. Stable and human-readable, so a bad agent answer is traceable to one product. |
| `name` | TEXT | What the shopper actually reads on the card and what the chatbot says out loud. Title-cased from the slug, so it carries artifacts like "Vs" and "T Shirt" that look wrong on a real storefront. |
| `garment_type` | TEXT | The natural category filter ("show me hoodies") and the chatbot's main way to narrow a request. Unnormalized today, so it can't be trusted as a filter key until it's mapped. |
| `description` | TEXT | The richest signal for matching a vague request ("something warm for the game") to a product. Primary text for search or embeddings. |
| `colors` | TEXT (JSON array) | Answers the single most common shopper question after price — "do you have it in X?" Must be parsed from JSON, not string-matched. |
| `search_tags` | TEXT (JSON array) | Curated synonyms bridging shopper vocabulary and catalogue wording ("The Game", "rivalry"), catching matches the description misses. |
| `image_file_path` | TEXT | Lets matched products render as real cards with pictures, which is what makes the chat feel like a shop. Relative to `data/`. |
| `price` | REAL | Needed for honest price answers and any budget filter. Flat per category, so it is effectively a function of garment type. |

### `inventory` — 612 rows, one per product × size

| field | type | why it matters |
|---|---|---|
| `id` | INTEGER, PK | Surrogate key with no business meaning — storage bookkeeping only. The real identity is the `(product_id, size)` pair, and code should treat it that way. Removable in principle (nothing references it) but not worth a table rebuild; see §4.5. |
| `product_id` | TEXT, FK → `catalogue` | Joins stock to product. Clean: no orphans and every product has all 6 sizes. |
| `size` | TEXT | Shoppers ask by size, not by product alone — "do you have that in M?" is a size question, not a stock question. |
| `quantity` | INTEGER | Tells us whether something is **out of stock, which the UI has to flag** — and the chatbot has to say out loud. 24% of rows are zero, so assuming availability is wrong often. Must be read live, never cached into the prompt. |

### `users` — 3 rows

| field | type | why it matters |
|---|---|---|
| `id` | INTEGER, PK | Ties a session to its chat history; the FK `chat_messages` points at. Shares the bare name `id` with `inventory` and `chat_messages` — always qualify it, and expose it as `user_id` in code (§4.6). |
| `name` | TEXT | Legacy full name, duplicated by `first_name`/`last_name` (§4.4). Keep it populated, never parse it. Collides with `catalogue.name` — never let a bare `name` cross an API or tool boundary (§4.6). |
| `email` | TEXT, UNIQUE | The login identifier, and the uniqueness constraint that makes "account already exists" a real case to handle at signup. |
| `password_hash` | TEXT | Stores a pbkdf2 hash, never a password. Must never reach the agent, the API response, or a log line. |
| `created_at` | TEXT | Account age; useful for telling a new shopper from a returning one. |
| `first_name` | TEXT | What the chatbot greets the shopper by. The personalization the DB is built for. |
| `last_name` | TEXT | Completes the display name for account and order contexts. |

### `chat_messages` — 22 rows (not named in the problem, but it shapes the design)

| field | type | why it matters |
|---|---|---|
| `id` | INTEGER, PK | Message order within a conversation. |
| `user_id` | INTEGER, FK → `users` | Scopes history per account — this is what lets the bot answer "do you remember me?" |
| `role` | TEXT | `user` / `assistant`, the shape the model needs to replay a conversation as context. |
| `content` | TEXT | The message text; the transcript itself. |
| `products_json` | TEXT (JSON array) | The key design hint: the products the assistant surfaced are stored *with* the message. Null on user turns. This is how matched items re-render when history reloads. |
| `created_at` | TEXT | Timestamps the turn and orders the transcript. |

---

## 2. What the data forces on the build

Findings from `explore_db.py` that constrain later problems:

1. **Stock is genuinely patchy** — 145 of 612 rows (24%) are quantity 0, though no product is dead in every size. "Honest answers about stock" is a real requirement, not a formality: the agent must query live per size.
2. **`garment_type` is inconsistent, but it does not break search.** 22 distinct values (21 case-insensitive) for ~6 real categories, including the pure case split `short-sleeve T-shirt` vs `short-sleeve t-shirt`. Each product carries exactly one label, so the variants are inconsistent naming, not alternate tags.

   Crucially, `search_tags` + `description` is a **strict superset** of the label as a retrieval path. Across every category tested (hood, crew, t-shirt, zip, jacket, fleece, sweatshirt, performance), **zero** products have the category word only in `garment_type`, and the text path often finds more (`sweatshirt` 59 vs 38; `crew` 39 vs 29). Any search that reads tags and description cannot lose a product to the messy labels.

   Where the mess *does* bite is **presentation**: a category filter or facet built directly on `garment_type` renders 22 options with `hoodie` and `pullover hoodie` as separate entries — visibly broken to a shopper. So normalization is needed for the filter UI and for honest counts, not for recall.
3. **Price is a function of category, not a free variable** — t-shirt $32; performance/mock/some hooded $45; crewneck $58; hoodie $68; quarter-zip $72; full-zip hoodie $88; jacket $98. A category answer is implicitly a price answer.
4. **`colors` and `search_tags` are JSON strings** — 22 distinct colors and 270 distinct tags, all parsing cleanly. Rich matching material, but it must be `json.loads`-ed, never `LIKE`-matched.
5. **Referential integrity is clean** — 0 orphan inventory rows, 0 products without stock rows, 0 catalogue images missing from disk. No defensive handling needed for missing joins or broken images.
6. **The database arrived populated** — 3 users and 22 chat messages from a prior session. Don't assume empty tables on first run, and don't let seeded rows get mistaken for our own writes when demonstrating database writes as evidence.

---

## 3. Proposed category taxonomy (design note, not yet implemented)

`garment_type`'s 22 labels are unusable as a filter. The fix is **two levels**, with level 1
derived from **price tier**, not from substring matching.

**Why not substring matching:** labels containing `hood` span three price tiers — `hooded
sweatshirt` at $45, `hoodie`/`pullover hoodie` at $68, `full-zip hooded sweatshirt` at $88. A
`LIKE '%hood%'` → "Hoodie" rule merges three different products into one category and makes the
category's price range meaningless.

**Level 1 — 7 categories, matching price exactly:**

| L1 | price | n |
|---|---|---|
| T-shirt | $32 | 25 |
| Lightweight / performance | $45 | 5 |
| Crewneck sweatshirt | $58 | 28 |
| Hoodie | $68 | 23 |
| Quarter-zip | $72 | 11 |
| Full-zip hoodie | $88 | 2 |
| Jacket | $98 | 8 |

**Level 2 — no new columns.** Modelling each modifier (closure, sleeve, neckline, fabric, weight)
as its own column was considered and rejected: measured against the 102 products, those columns
would be 64%, 75%, 44%, 94% and **99%** empty respectively — a `weight` column populated for a
single product. Five mostly-null columns is an anti-pattern.

Much of that emptiness is a modelling artifact: closure is not *missing* for a T-shirt, it is *not
applicable*. Real storefronts handle this with **category-scoped facets** — the Closure filter only
appears once the shopper is inside Hoodies, where it is nearly complete.

So level 2 is computed at query time from `search_tags` + `description`, scoped to the selected L1
category, and never stored as columns. `search_tags` is already a dense attribute store: 270
distinct tags, 4–12 per product, 9.1 on average. Adding sparse columns beside it would duplicate it
badly.

Net: **one new derived column (L1), not six.**

**Open judgment call:** the $45 tier is heterogeneous — five singletons (mockneck sweatshirt, two
long-sleeve performance shirts, two hooded sweatshirts) sharing a price but no shopper-facing
identity. Price does not resolve this tier; it needs a human decision before the taxonomy ships.

Retrieval does not depend on this (see finding 2) — the taxonomy is for the filter UI, facet
counts, and precise agent answers.

---

## 4. Resolved questions from the Problem 2 review

### 4.1 The $45 tier — resolved, price is not a perfect category key
Inspecting the five products showed three distinct groups, not one ambiguous bucket:

| items | belongs in |
|---|---|
| UA Gameday Double Knit Hood, Yale Sports Hoodie Tennis | **Hoodie** |
| Yale Maplehouse Diana Mockneck | **Crewneck / sweatshirt** |
| Dry Zone Long Sleeve, UA Mens Tech LS 2.0 | **Performance** (new, athletic/technical) |

Two are plainly hoodies — the Tennis item's own description opens "Heather gray pullover hoodie
with drawstring hood" — just cheaper than the $68 ones. **Accepted:** these five are an exception
to the price rule. Price separates six of seven tiers cleanly, but $45 is a price point, not a
category. Hoodie therefore spans $45–$68, which is the right trade against telling a shopper a
hoodie is not a hoodie.

### 4.2 Long-tail tags — accepted as-is
270 tags, many on a single product, specific hooks like "The Game" and "MapleHouse". Good for chat
matching, deliberately not used for the filter UI.

### 4.3 Out-of-stock skew by size — flagged, not a cleaning task
Zero-stock rows are not evenly spread across sizes (per-size breakdown in `field_evidence.md`).
This is real inventory, not dirty data. Revisit only if specific sizes cause problems.

### 4.4 `name` vs `first_name`/`last_name` — a display-purpose split, added later
The schema ends `created_at ... , first_name TEXT, last_name TEXT)` — SQLite's signature for
`ALTER TABLE ADD COLUMN`. The added columns are nullable while every original column is `NOT NULL`.
So `name` came first and the split was bolted on afterwards. `first_name || ' ' || last_name`
equals `name` for all 3 rows, so the split carries no extra information.

**Its purpose is the greeting.** Seeded chat turn 6: "Hi, **Test**! I can see you're logged in as
**Test User**." Turn 8: "Hey **Tauhid**! Welcome to Campus Customs". The bot addresses the shopper
by first name; full `name` only appears in the formal "logged in as" confirmation. With only the
original `name` column the greeting reads "Hey Tauhid Zaman!", which is why the columns were added.

**Consequences for the build:**
- Collect first and last name as **separate fields at signup**. Never split `name` on whitespace —
  compound surnames ("Sanchez Urdaneta") lose half the name, and the three seeded rows are all tidy
  two-token names that hide the bug in testing.
- `first_name` is the source of truth for addressing the shopper; `name` is legacy. Keep it
  populated as `first + ' ' + last` for compatibility, but never parse it.
- The seeded `chat_messages` act as a reference implementation of the intended voice, including the
  `**bold**` markdown used for product names and prices.

### 4.5 `inventory.id` — keep it
Nothing in the database references it: the only foreign keys are `inventory.product_id →
catalogue.product_id` and `chat_messages.user_id → users.id`. With `UNIQUE (product_id, size)`
already present, `PRIMARY KEY (product_id, size)` would be a valid replacement. But SQLite cannot
drop a primary-key column in place — it needs a full table rebuild — on a database we did not
author and do not commit, for no functional gain. **Decision: leave it.** Treat `(product_id,
size)` as the real identity in code; `id` is storage bookkeeping.

### 4.6 Column-name collisions — fix at the application boundary, not in the schema
Columns reused across tables:

| column | appears in |
|---|---|
| `id` | `inventory`, `users`, `chat_messages` (PK of each) |
| `name` | **`catalogue`, `users`** |
| `created_at` | `users`, `chat_messages` |
| `product_id` | `catalogue` (PK), `inventory` (FK) |

`id` per table is the normal convention and needs no change (`catalogue` already departs from it,
using `product_id` as its PK). But the collision is not theoretical:

```sql
SELECT * FROM users u JOIN chat_messages m ON m.user_id = u.id WHERE m.id = 6
-- dict key 'id' == 1  (users.id wins; chat_messages.id = 6 is silently lost)
```

Duplicate columns collapse with **no error**, and the same happens to `created_at`.

`name` is the more dangerous one because it escapes SQL: an agent tool returning `{"name": ...}`
means *product* name in one tool and *person* name in another, and the model reads those field
names. That is how a bot greets a shopper as "Hi, Basic Hoodie Big Yale."

**Rules for the build:**
- Never `SELECT *` across a join; alias every column explicitly.
- In Pydantic models and tool schemas use unambiguous names — `product_name`, `product_id`,
  `user_id`, `first_name`. Never a bare `name` or bare `id` crossing a boundary.
- The database keeps its column names; disambiguation happens in our code.

### 4.7 `password_hash` — handling rules
Stored format: `pbkdf2_sha256$<salt>$<hexdigest>` — 256-bit digest, **unique random salt per user**
(user 1's is the fixture `hw4testsalt0001`). A sound scheme.

**Gap: the iteration count is not stored.** Only algorithm, salt and digest. The work factor lives
in application code, so if our login uses a different count than whoever seeded the data, the three
existing users cannot authenticate. A compatibility trap, not a vulnerability.

**Rules:**
1. **Make leaking structurally impossible.** Separate Pydantic models: `UserInDB` carries the hash,
   `UserPublic` *cannot*. Type every API response as `UserPublic` so no code path can serialize it.
   This is the rule that survives future carelessness — the rest are discipline.
2. **Explicit column lists, never `SELECT *`** (§4.6 shows `SELECT *` is already hazardous here).
3. **Verify with `hmac.compare_digest`**, never `==`.
4. **Never** into a log, an error message, or the agent's context. The agent receives `first_name`
   and nothing else from `users`.
5. New signups: pbkdf2-sha256 at **600,000 iterations** (OWASP guidance), unique random salt.
   Record the iteration count here, since the stored format does not.

### 4.8 `products_json` — a full product snapshot, with a live-stock caveat
Not an ID list. Each entry carries:
`product_id, name, garment_type, description, colors, search_tags, image_file_path, image_url,
price, inventory[{size, quantity}], total_stock` — 1 to 8 products per assistant message.

**`image_url` does not exist in the database.** It is `/media/products/<slug>.jpg`, synthesized by
the backend. This tells us the API is expected to serve product images under **`/media/`**.

**Use the snapshot for the transcript, re-query stock for anything actionable.** The snapshot is
correct for fidelity — it preserves what the bot actually showed, so an old conversation stays
coherent after a catalogue edit. But `inventory` and `total_stock` go stale immediately. Re-query
live stock when re-rendering, or a shopper reloading yesterday's chat sees "2 left in XL" for a
sold-out size.

---

## 5. Problem 3 — the website

### Stack
React 19 + Vite 8 + TypeScript, react-router 7, plain CSS with design tokens (no Tailwind — one
fewer build dependency, and a reviewer can read it). FastAPI + uvicorn on the backend.

### Ports
**8010** (API) and **5183** (Vite), not the defaults 8000/5173, which other folders in this course
already occupy. Vite proxies `/api` and `/media` to the backend so the browser sees one origin.

### API surface
| route | purpose |
|---|---|
| `GET /api/health` | row count; lets the UI show an honest "API offline" state |
| `GET /api/products` | 102 summaries for the grid |
| `GET /api/products/{id}` | full text, colours, tags, per-size stock |
| `POST /api/chat` | **stub**; returns a fixed reply and no products |
| `/media/products/*` | product images |

### Decisions carried from Problem 2
- **`/media/` is the image route**, inferred from the `image_url` key in seeded `products_json`
  (§4.8) — it exists nowhere in the schema.
- **No bare `name` or `id` crosses the API** (§4.6): the models use `product_id` / `product_name`,
  and TypeScript mirrors them.
- **Explicit column lists, never `SELECT *`** (§4.6).
- **Sizes are ordered XS→XXL in SQL**, not alphabetically — SQLite would otherwise return
  L, M, S, XL, XS, XXL.
- The database is opened **read-only**; Problem 3 writes nothing.

### Scope held back deliberately
- **No category filter.** The L1 taxonomy (§3) stays a design note until a problem asks for it.
- **Auth is forms only.** Submitting shows a notice rather than faking an account.
- **The chat does not invent product matches.** A stub that returned plausible products would
  look more finished than it is.

### Verified in the browser
Home, Products (102 cards, real images), ProductDetail, About, Log in, Create account, 404.
Card click navigates to the item page. Stock logic checked against the database:
`basic-hoodie-big-yale` XL=2 renders "Only 2 left"; `baseball-left-chest-crewneck` XS and XL
(both 0) render disabled and struck through with `aria-label="XS, out of stock"`. Chat round trip
reaches FastAPI and returns. Console clean, no warnings. Mobile (375px) reflows.

### Snag worth remembering
Vite 8 binds `::1` only by default, so anything probing `127.0.0.1` — including the in-app preview
— cannot reach it. `server.host: '127.0.0.1'` in `vite.config.ts` fixes it.
