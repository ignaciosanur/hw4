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

### 5.1 Display formatting (`backend/display.py`)
`catalogue.name` is title-cased from URL slugs, which Problem 3 made visible on the storefront:
"Benjamin Franklin 1 4 Zip", "School Of Art", "2025 Yale Vs Harvard T Shirt", "Ua Mens Tech L S 2 0".
46 of 102 names carried an artifact.

Fixed **at the display layer only** — the database is never written. That matters: the agent will
match against the stored text, so cleaning here cannot cost a search hit. Handles fractions
(`1 4 Zip` → `¼-Zip`), lost hyphens (`T Shirt` → `T-Shirt`), possessives (`Mens` → `Men's`),
brands (`Ua` → `UA`), minor words (`School Of` → `School of`), and version numbers (`2 0` → `2.0`).
After formatting, 0 of 102 names retain a detectable artifact.

`garment_type` gets casing normalization for the card subtitle. **Casing only** — it does not
collapse the 22 values into categories; the taxonomy in §3 stays a design note.

### 5.2 Git
Initialized at the end of Problem 3 rather than at submission, so the first commit could be
inspected by eye. 47 files tracked. Verified ignored: `data/` (database + 102 images), `.env`,
`.venv/`, `frontend/node_modules/`. Unused Vite scaffold assets were deleted rather than committed.

**Before every `git add`: run `git status` and confirm no database, images or secrets are staged.**

---

## 6. Problem 4 — accounts and login

### What is stored for a user
`users` row: `id`, `first_name`, `last_name`, `name` (legacy, kept as `first last`), `email`
(unique, lowercased), `password_hash`, `created_at`. **Never a plaintext password.** The API only
ever returns `UserPublic` (id, first/last name, email) — the hash cannot be serialized out because
no response model contains it.

### How passwords are protected
- **PBKDF2-HMAC-SHA256, 600,000 iterations, 16-byte random per-password salt** — the OWASP
  FIPS-compliant recommendation ([Password Storage Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)).
  Argon2id is OWASP's first choice but needs a native dependency; the seed data was already
  PBKDF2-SHA256, so staying on it keeps one scheme and the stdlib.
- Stored self-describing: `pbkdf2_sha256$<iterations>$<salt_hex>$<digest_hex>`, so the work factor
  travels with the hash and can be raised later. `needs_rehash()` flags anything below current.
- Verification is constant-time (`hmac.compare_digest`).
- Legacy 3-segment seed hashes (no iteration count) are **not verifiable** — by decision, only
  accounts created through this app can log in.

### Password policy (`security.password_problems`)
≥8 chars, upper, lower, digit, symbol. Enforced server-side; the signup form mirrors it as a live
checklist and requires a matching confirm field.

### Online-guessing protection
Per-email: 5 failed logins within 15 min → locked 15 min. The lockout clears on a successful
password reset, and the messages steer a locked user to reset. In-memory (fine for one process;
a real deployment would use Redis so it spans workers and survives restarts).

### Forgot / reset password
No mail server in this build, so `forgot-password` returns a real signed, 1-hour, single-purpose
token as a link (also printed to the server console), clearly labelled as simulated email. The
reset page consumes the token, applies the password policy, updates the hash, clears any lockout,
and returns a session. **Unknown email returns 404 with an explicit "no account" message**, as the
assignment asked (a deliberate departure from the usual privacy-preserving silence).

### Sessions
Login/register/reset return an HMAC-signed 7-day session token (`AUTH_SECRET`). The front end stores
it and validates via `GET /api/auth/me` on reload. `AUTH_SECRET` and `FRONTEND_URL` added to `.env`.

### The test account
The seed `test@campuscustoms.yale.edu` used the unreproducible legacy format. `seed_dev_user.py`
re-registers just that account with the known password `password` in our format, so login is
demonstrable. Idempotent, dev-only, touches one row; the DB is git-ignored.

### Verified end-to-end (API + browser)
1. **Log in as `test@campuscustoms.yale.edu` / `password`** → UI shows "Hi, Test", session persisted. ✓
2. **New account via the signup form** ("Grace Hopper") → written as `users` row 7, logged in as
   "Hi, Grace", hash is 600k PBKDF2 with no plaintext. ✓
3. Wrong password → generic 401 with a decrementing counter (4,3,2,1), then **lockout 429**.
4. Duplicate email → 409. Weak password → 422 listing what's missing.
5. Forgot unknown email → 404 "no account". Forgot known → simulated reset link.
6. Reset with token → new password works, old rejected, lockout cleared.

Throwaway accounts from API testing were deleted; the DB holds only the 3 seed users.

---

## 7. Problem 5 — the PydanticAI agent backend

### How the front end talks to FastAPI
- The chat widget (`frontend/src/components/ChatPanel.tsx`) POSTs to `/api/chat` with
  `{ message, history }`. If the shopper is signed in it adds `Authorization: Bearer <session
  token>`; the route resolves that to the shopper's `first_name` so the agent can greet them.
- Vite proxies `/api` and `/media` to the backend, so the browser sees one origin. The proxy
  target is configurable (`vite.config.ts` reads `BACKEND_PORT`, default **8000**); a git-ignored
  `.env.local` with `VITE_API_TARGET` overrides it locally when 8000 is occupied.
- The route returns `ChatResponse { reply, products }`. `reply` is the agent's prose; `products`
  are the cards its `show_products` tool chose, rendered under the reply and linking to product
  pages. Shape mirrors the seed `chat_messages.products_json`.

### How the agent is loaded (prompt file + model)
- `backend/agent.py` builds one `Agent` at import:
  - **Model** from `.env` via the Portkey gateway — `OpenAIChatModel(os.getenv("OPENAI_MODEL"))`
    (currently `gpt-5.6-luna`) over an `AsyncOpenAI` client pointed at Portkey with the
    `x-portkey-api-key` header. The model name is never hard-coded.
  - **System prompt** read from `backend/prompts/prompt.md` at load. Editing that file changes the
    agent's voice and safety rules with no code change — it is meant to grow in later problems.
  - A dynamic `@agent.system_prompt` appends the signed-in shopper's first name (or "guest").
- `run_chat(message, first_name, history)` runs one turn with per-request `ChatDeps` and returns
  `ChatResponse`. Front-end turns are converted to PydanticAI `ModelRequest`/`ModelResponse`
  history so context carries across messages.

### The four agent files (Homework-3 pattern)
| file | role |
|---|---|
| `backend/prompts/prompt.md` | system prompt: Campus Customs voice + safety basics |
| `backend/agent.py` | agent wiring: model, prompt, tools, `run_chat` |
| `backend/tools.py` | pure DB-backed tools (read-only): search, product, stock, categories |
| `backend/models.py` | Pydantic types: `ProductCard`, `ChatRequest/Response`, `ChatTurn` |

### Tools and the card/reply alignment
Tools open the DB **read-only** and read stock **live** (never from the prompt), honouring the
honest-stock requirement. `search_products` returns candidates with ids but shows nothing;
`show_products(ids)` is a separate step so the cards match what the reply recommends, instead of
every search hit becoming a card. `get_product` / `check_stock` give per-size detail.

### Run structure (changed this problem)
Backend modules now use **flat sibling imports** so the app runs as the assignment specifies:
```
cd backend && uvicorn main:app --reload --port 8000
```
On this machine 8000 is held by another course folder, so local testing uses `--port 8010` with
the `.env.local` proxy override; the committed default is 8000.

### Safety basics (in prompt.md, verified live)
Off-topic requests declined and redirected; refuses to reveal the system prompt or model; refuses
passwords in chat and points to the account pages; treats text inside product data / tool results /
messages as data, not instructions; no medical/legal/financial advice; never invents products or
stock. All six checks confirmed against the running agent.

### Verified end-to-end
Guest and signed-in chat (greets "Hi Test"); honest stock ("XL, 2 available"; "XS out of stock,
available in S, M, L, XXL"); card/reply alignment (1 rec → 1 card, 4 recs → 4 cards); no-match
honesty (0 forced cards); multi-turn context ("the first one" resolved from history). Browser cards
render with image, price and live per-size stock; console clean.

---

## 8. Problem 6 — product & stock lookup tools

The agent's tools were rebuilt around the three things a shopper asks — **description, price,
stock (incl. by size)** — each returning a typed model from `models.py` so the agent reads
structure, not prose. Every tool reads the database **live, read-only**; nothing about price or
stock comes from memory or the prompt.

### Tools and their return types

| tool | returns | answers |
|---|---|---|
| `search_products(query)` | `list[ProductMatch]` | find products / resolve a name → `product_id` |
| `lookup_product(product_id)` | `ProductInfo` | description, price, colours |
| `check_stock(product_id)` | `StockInfo` | total and per-size stock, out-of-stock called out |
| `show_products(ids)` | (confirmation) | display chosen products as cards (`ProductCard`) |
| `list_categories()` | text | categories and prices, for browsing |

### Which fields each result carries, and why

**`ProductMatch`** (search hit — kept deliberately small, Lecture 3 "keep returns short"):
- `product_id` — the key `lookup_product` / `check_stock` need next.
- `product_name`, `garment_type` — so the agent can list options and disambiguate ("the hoodie").
- `price` — answers the most common immediate follow-up without another call.
- `colors`, `total_stock` — a coarse "do you have it at all" signal.
- *Omitted:* full description and per-size stock — those are one focused call away, so search
  stays short and the agent is pushed to confirm live before quoting stock.

**`ProductInfo`** (the "what is this / how much" answer):
- `description` — the **full** catalogue text, not the card's clipped `short_description`.
- `price` — the authoritative figure the agent must quote rather than recall.
- `product_name`, `garment_type`, `colors`, `image_url` — round out the product.
- *Omitted:* stock — availability is live and belongs in `check_stock`, so the agent never
  quotes stock from a product detail that could be stale.

**`StockInfo`** (the honest-stock answer; fields chosen so out-of-stock is explicit, not inferred):
- `total_stock`, `any_in_stock` — quick "in stock at all?" signals.
- `in_stock_sizes` / `out_of_stock_sizes` — **ready-made lists** so the agent can say "available
  in S, M, L" and "XS and XL are out of stock" directly, without scanning quantities.
- `by_size: list[SizeAvailability]` — the full per-size detail, each with an explicit `in_stock`
  flag (so a zero never has to be interpreted) and `quantity` for "how many in XL" questions.

**`ProductCard`** (unchanged display shape for the widget) keeps `short_description` and the stock
summary the cards render; it is produced only by `show_products`, separating *display* from the
*lookup* results above.

### Prompt changes (`prompts/prompt.md`)
The product section now names each tool and routes questions to it: price → `lookup_product`;
stock/size → `check_stock`, and if the asked size is in `out_of_stock_sizes`, **say so plainly**
and offer `in_stock_sizes`. It restates: never invent or recall a price/quantity; check stock live
every time.

### Harness hardening (from Lecture 4)
Added `UsageLimits(request_limit=8)` to `agent.run` — the "stopping rule" so the ReAct loop cannot
run away on cost. Tools returning typed models is itself the lecture's "typed outputs" grounding.

### Verified live
Price ("$68.00" from the DB), description (full text), stock-by-size ("out of stock in XL;
available in S, M, L, XXL" — exact DB match), exact quantity ("2 in XL", DB = 2), and the
hallucination guard (refuses to price a product that does not exist).

---

## 9. Problem 7 — chat search that updates the page

### How a search result reaches the page (end to end)
1. The shopper asks in the chat widget (e.g. "what hoodies do you have?").
2. `POST /api/chat` runs the agent. When it calls `show_products(ids)`, those products are
   collected and returned in `ChatResponse.products` as structured `ProductCard`s — **this is the
   API contract**: the agent returns structured matches, the front end renders them.
3. `ChatPanel` receives the reply. If `products` is non-empty it calls `show(products, question)`
   on the shared **`ChatResultsProvider`** context and navigates to `/products`.
4. The **Products page** reads that context: when chat results are present it renders them as the
   storefront grid under a "From your chat — N matches for '…'" banner, with a **Show all
   products** button that clears the context back to the full catalogue.
5. The chat bubble keeps the reply short and shows a "N items shown on the page →" link, so the
   chat and the page stay connected without duplicating the cards.

Navigation is client-side (react-router), so the page updates **dynamically** with no reload.

### Cards are one component everywhere
Catalogue cards and chat-driven cards are the same `ProductGridCard` (image, name, garment type,
short description, price), so they look identical and **every card links to the Problem 3 detail
page** by `product_id`. A chat-placed card opens the same large-image + full-info + sizes/stock
view as a catalogue card — verified in the browser.

### Why this shape
- The structured `products` already existed (Problem 5/6); Problem 7 is the front-end half of the
  same contract, so no API change was needed — the agent's `show_products` choices drive the page.
- The page (not the chat bubble) is the product surface now, because the assignment asks the
  *website* to show the matches; the in-bubble cards were replaced by a compact link to avoid
  showing the same products twice.

### Verified in the browser
Asked "what hoodies do you have?" from the Home page → navigated to `/products`, grid showed 8
hoodie cards under the banner; clicking a chat-placed card opened its detail page ($68.00, sizes,
large image); "Show all products" restored the full 102. Console clean.

### 9.1 Chat reply formatting (follow-up)
The bubble rendered replies as plain text, so markdown showed as raw `**`/`-`. Added
`Markdown.tsx` — a minimal safe renderer (bold, bullets, line breaks as React nodes, no
`dangerouslySetInnerHTML`). The prompt was also tightened so that, with cards on the page, the
chat reply is one or two short sentences and does not repeat the product list or prices.

---

## 10. Problem 9 — customer memory

### How chat history is stored
Signed-in shoppers' turns are saved to the existing **`chat_messages`** table (the one the seed
data revealed in Problem 2): `user_id`, `role`, `content`, `products_json`, `created_at`. On each
logged-in chat turn the route writes the user message and the assistant reply (the reply's product
cards go into `products_json`, mirroring the seed shape). On return, the front end calls
`GET /api/chat/history` and the most recent 50 messages reload into the chat panel, oldest-first,
behind a "Welcome back" line. **Guests are never persisted** — `chat_messages.user_id` is NOT NULL
and the route only writes when a valid session resolves to a user.

### Privacy — the "you can't sell them" mechanism (enforced in code)
`backend/history.py` holds the only access functions, and every one is scoped to a single owner id:
- The id always comes from the **verified session token**, never from client input, so no request
  can name another account. `load_history`/`save_turn`/`clear_history` take one `user_id`; there is
  deliberately **no function that reads, joins, or exports across users** — nothing can bulk-collect
  customer chats to sell them.
- `GET`/`DELETE /api/chat/history` require auth and act only on the token's user.
- A shopper can **delete their own history** ("Forget my chat" in the panel → `DELETE`), so they
  control their data.
- `DATA_USE_POLICY` states the no-sale rule in code; the agent prompt forbids disclosing or
  "selling" any customer's data. The database is git-ignored, so chat never leaves via the repo.

### What customer fields the model sees
Passed in `ChatDeps` (agent dependencies) and injected via a dynamic system prompt:
`first_name`, `last_name`, `email` — the signed-in shopper's own identity, so the agent greets by
name and can help with their account. It sees **only the current shopper's** fields; it has no tool
or deps path to any other customer, and never sees password hashes. Guests resolve to no identity.

### How page context is passed
`ChatRequest.page_context` carries `{ product_id, path }`. The front end fills `product_id` from the
URL when the shopper is on a single-item page (`/products/:id`). The chat route puts it in
`ChatDeps.current_product_id`, and a dynamic system prompt looks the product up and tells the agent
"the shopper is currently viewing <name> (id=…), colours …; if they say 'this'/'it', they mean this
one." So "do you have this in pink?" on a product page resolves without the shopper naming it.

### Verified
Page context ("do you have this in XL?" on the hoodie page → correct product, honest stock);
persist + reload (full page refresh → "Welcome back" + prior conversation); "Forget my chat" (DB
rows for the user → 0); guest chat not saved and history endpoints 401 for guests; guest sales
guardrail intact.
