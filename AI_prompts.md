# AI Prompts

Running log of the prompts typed into the vibe coder (Claude Code) for Homework 4,
Campus Customs Shop + Chatbot. One section per problem, added as each problem is
worked — not backfilled at the end.

Each section holds the prompt verbatim, any follow-up that was genuinely needed,
and a short note on what we worked out in discussion before any code was written.

---

## Problem 1: Vibe Coder Prompts

### Initial prompt

> Problem 1: Vibe coder prompts
>
> Create AI_prompts.md at the start assignment and keep it updated as you work. This file will be a log of what we've been typing into the vibe coder.
>
> There has to be one section for each problem. Each section must include:
>
> * Problem number and title
> * At least one pormpt we worked on
> * One follow-up prompt if it was needed (and one sentence on what was lacking after the first)
>
> We are running site, database writes, and screenshorts are eeidence, we do not need extra proof essay beyond these prompts.
>
> This is pretty standard

### Follow-up prompt

> ok sure. But I do want some representation of our back and forth in prompt engineering being represented in the log

What was lacking after the first: the log would have captured only the typed prompts,
losing the prompt-engineering discussion where most of the actual decisions get made.

### What we worked out before building

- **Verbatim prompts, not reconstructions.** The log records what the human actually
  typed. The assistant's suggestions and summaries stay out of the blockquotes — this
  file is evidence of what was asked, not a transcript of the conversation.
- **Follow-ups only when real.** This project runs as discuss-then-build, so most
  course-corrections happen in conversation *before* code exists and never become a
  second typed prompt. A `### Follow-up prompt` is recorded only when the user actually
  typed one to fix or extend something already built. No invented follow-ups to satisfy
  the template.
- **Added this section type** so the prompt-engineering back-and-forth is visible,
  without disturbing the verbatim record above it.
- **Dropped `output/harness.md`** (a second engineering-decisions log kept in Homework 3).
  The running site, database writes and screenshots are the evidence; no proof essay is
  needed beyond these prompts. `AI_prompts.md` is the
  single log.

---

## Problem 2: Analyze the Database

### Initial prompt

> Problem 2: Analyze the database
>
> We are looking at the database (data/campus_customs.db) and understanding the fields of each table.
>
> We are particularly interested in understanding "catalogue", "inventory" and "users." Start the file output/harness.md
>
> Write down each table and its fields, and one short line on why each filed matters for the shop or the chatbot (this is human input)
>
> We will be growing this harness file in later problems (models, tools, safety, specs.)
>
> For the data exploration, first give me the list of variables included and what type they are (it can be a tbale), then gimme a "head" (5 rows). Then tell me how they are distributed (if there's a lot of missing data or not, and if it's numeric, if there's measures of centrality and SD) etc. Feel free to add whatever else you think is relevant

### Follow-up prompts

> for this "filter UI: a category dropdown rendering 22 options, with "hoodie" and "pullover hoodie" as separate entries, is visibly broken to a shopper. That's a presentation problem, not a recall problem." would it be better to have two levels of categories? let's say "hoddie" is level one, and anything extra is on category 2 "pullover hoodie" so that people can search easier, or programs understand it better?

> ok I'm aligned with L1 categoriesd you proposed based on price. For level 2, think of how websites think about inventory. I think that creating all of those variables as independent levels might be too much --would it not create a ton of empty rows for level 2 if we make it as specific with each extra characteristic being a variable(column)?

> The 45 tier: can you give me what are those specific items so I can check them manually? ... Also, can you show me the data that I need to see to provide my value judgement on the variables that I asked you to focus on?

> For 9, I don't get why we have id and product_id, can we delete one if it's a surrogate? ... For 13 (id) is the field name the same as id for the first section? same with name on 14? if that is the case, that might be confusing for when we are calling on variables.

What was lacking after the first: the first pass produced the exploration but never surfaced it,
and stated conclusions about the data (notably that messy `garment_type` would break search) that
had not been tested against the data.

### What we worked out before building

- **`output/harness.md` is back.** In Problem 1 it was dropped as an unnecessary second log;
  Problem 2 calls for it explicitly, so it returns — now as a graded deliverable that later
  problems extend with models, tools, safety and specs.
- **Split generated from curated.** `explore_db.py` writes the machine profiling to
  `output/data_exploration.md`; `harness.md` holds only the human read of why each field
  matters. This keeps the harness readable as it grows over later problems, and lets a TA
  re-run the profiling rather than trust pasted numbers.
- **The "why it matters" lines are drafted by the assistant and edited by the user**, since the
  problem flags them as human input.
- **`chat_messages` was added** beyond the three named tables: its `products_json` column stores
  the products an assistant turn surfaced, which reveals the intended chat-to-product design.
- **Claims got tested instead of asserted.** "Messy `garment_type` will make the bot deny stock we
  carry" turned out to be false — `search_tags`+`description` is a strict superset as a retrieval
  path (0 products findable only via the label). The mess hurts the filter UI, not recall.
- **Two-level taxonomy, L1 derived from price tier**, not substring matching: `hood` labels span
  $45/$68/$88, so a `LIKE '%hood%'` rule would merge three different products.
- **Level 2 rejected as columns.** Measured fill rates would be 64%/75%/44%/94%/**99%** empty — a
  `weight` column for one product. Facets are computed at query time, scoped to the selected
  category, and the long tail stays in `search_tags`. One new derived column, not six.
- **The $45 tier is an accepted exception** — inspecting the five products showed two hoodies, two
  performance shirts and a mockneck, so price is not a perfect category key.
- **Collisions handled at the application boundary**, not in the schema: `name` exists in both
  `catalogue` and `users`, and `SELECT *` across a join silently drops duplicate columns.

---

## Problem 3: Build the Campus Customs Website

### Initial prompt

> ok cool, onto problem 3: Build the Campus Customs website
>
> Scaffold a React + Vite + TypeScript front end for Campus Customs. We are putting a navigation bar at the top that links to the main pages:
>
> * home
> * products
> * about us
> * log in
> * create account
>
> Pull campus customs-style wording from yalebulldogblue.com for home and about us, but we are rewording so it sounds more like uis and less liek plagarism
>
> ON the product page, we will show product images from the catalogue (using the image paths we have in the database) with basic product information (e.g., name, price, short description)
>
> We are making each product open a single-item page (large image on one side, full product text on the other -- description, price, sizes/stock when we have them), and clikcing a card on products should take the shopper there
>
> We also want to add a chat interface in the bottom right of the site (a floating chat panel is also fine). It DOES not need to talk to an agent yet --a stub that will call the backend later is enough for this problem.
>
> You will soon need a small API to read the database, it is fine to start a simple FastAIP app in backend/main.py just to serve products and images, and then grwo it into the agent backend in problem 5

### What we worked out before building

- **Auth is pages only.** Log in / create account are forms with validation but no backend
  wiring; real authentication belongs with the agent backend rather than being built twice.
- **No category filter yet.** The L1 taxonomy from Problem 2 stays parked until a problem asks
  for it, consistent with the other deferred cleanup.
- **Site copy is original, built from researched facts.** `yalebulldogblue.com` supplied facts
  (official licensing, the 57 Broadway storefront, the college/athletics/graduate ranges);
  the sentences are ours, which is a cleaner answer to the plagiarism concern than rewording
  theirs.
- **Ports moved to 8010/5183** because other course folders already hold 8000 and 5173.
- **Images served at `/media/`**, the convention inferred in Problem 2 from a field that appears
  in the seeded chat data but in no table.
- **The chat stub returns no products.** Inventing plausible matches would make the stub look
  more finished than it is.

### Follow-up prompt

> Anything else we should change about this step before we go to problem 4: create account and login?

What was lacking after the first: building the storefront exposed a problem that had been parked
as invisible — 46 of 102 product names render with slug artifacts ("Benjamin Franklin 1 4 Zip"),
which is a visible defect once there is a page to see it on.

- **Display names fixed in the API, not the database** (`backend/display.py`), so the agent can
  still match the stored text verbatim later. 0 of 102 names retain an artifact.
- **`garment_type` casing normalized for the card subtitle** — casing only, not the taxonomy.
- **Git initialized now rather than at submission**, so the first commit was small enough to
  inspect by eye and confirm the database and images were excluded.

---

## Problem 4: Create Account and Login

### Initial prompt

> Ok problem 4: create account and login
>
> We'll build a common "create-account / log in" flow
>
> * Create account: first name, last name, email, password (confirm password as well) password has to follow a format (e.g., minimum characters, inclusion of symbols, etc.)
> * Log in: email and password
>
> Also add something about "forgot password" so they get sent a reboot password link to their email address if that's the case. If there's no account with that email, let them know
>
> New accounts log into the "users" table. Make so to store passwords securely (use hashing, i guess) so no hackers (human or AI) cannot access them. Also, think of a limit of password attempts so people or AI don't try infinite amoutns of passwords to hack it. In that case, ask to reboot password to the user.
>
> The seed database already has a test user you can use while building:
> * email: test@campuscustoms.yale.edu
> * Password: password
>
> Claude, please confirm that you can log in as that user, and that a brand-new account you create (another test) also works.
>
> Update output/harness.md with how the authorization works (e..g, what we store for a user and how passwords are protected). Do some online search on what is the best way to do this. Also let me know if you need more info in case you don't agree or have gaps with this prompts

### What we worked out before building

- **Only app-created accounts can log in.** The seed users' hash format (3-segment, no iteration
  count) is not reproducible; the user confirmed legacy users like Tauhid were just tests. The
  test account is re-seeded into our format via `seed_dev_user.py` so its login is demonstrable.
- **PBKDF2-SHA256 at 600k iterations**, chosen over Argon2id (OWASP's first pick) to avoid a native
  dependency and because the seed data already used PBKDF2. Researched against the OWASP Password
  Storage Cheat Sheet, as asked.
- **Forgot-password is simulated**, not mocked: a real signed, expiring token and a working reset
  page, with the link shown in the UI and logged instead of emailed (no mail server in this build).
- **Lockout clears on a time window or a password reset**, matching the "ask to reset" instruction
  rather than permanently bricking an account.
- **Unknown email on forgot-password returns an explicit 404**, as the prompt asked — a deliberate
  departure from the usual privacy-preserving "we sent a link if it exists".

### Note on process

While detecting the test fixture's hash parameters, a safety classifier and the auto-mode
classifier flagged the hash-construction checks as resembling password cracking. The approach was
changed: rather than reverse the legacy hash, the test account is re-registered into this app's
format using the password the assignment provided.

---

## Problem 5: PydanticAI Agent Backend

### Initial prompt

> Problem 5: Pydantic AI agen backend
>
> Build the shop chatbot as a PydanticAI agent behind FastAPI plugged into your front-end chat widget. Put the API app in backend/main.py --that is the file you run with Uvicorn. Keep the agent as these four files next to is (the same idea as homework 3):
>
> * Backend/prompts/prompt.md --system prompt (grwo this same file later)
> * Backend/agent.py - agent entry/wiring
> * backend/tools.py --tools the agent can call
> * backend/models.py --pydantic / ;ydanticAI structured types
>
> In main.py, expose a chat route so a message from the website returns a reply form the agent (and whatever else we need for product/auth). You will need you AI model API key for the agent.
>
> Put Campus Customs voice and safety basics into prompts/prompt.md (we will expand on tools and and safety later). Start or uopdate types in models.py for chat replies/product cards as needed
>
> In output/harness.md, note how the front end talks to FastAPI and how the agent is loaded (prompt file + model)
>
> Make sure the backend runs from the backend/ folder like this:
> uvicorn main:app --reload --port 8000
>
> Feel free to improve this prompt as needed

### What we worked out before building

- **Backend imports went flat** (`import security` not `from backend import security`) so the app
  runs as `uvicorn main:app` from `backend/`, exactly as asked.
- **Port 8000 is held by another course folder on this machine**, so the committed default is 8000
  (per the prompt, free on a TA's machine) and local testing uses a git-ignored `.env.local`
  override pointing the Vite proxy at 8010.
- **search vs show split.** Rather than carding every search hit, `search_products` returns
  candidates and a separate `show_products(ids)` displays only what the agent recommends — so the
  cards match the reply. This was added after seeing a one-item reply surface six cards.
- **Auth is wired into chat**: a session token greets the shopper by first name; guests are fine.
- **Model and prompt load from config**, never hard-coded: `gpt-5.6-luna` from `.env`, voice and
  safety from `prompts/prompt.md`, so the file can grow in later problems.
- **Chat persistence to the DB was deferred** — not required here and better placed with the
  "remember me" work later.

---

## Problem 6: Tools — Product Info and Stock

### Initial prompt

> ok perfect, so here you got problem 6: Tools: product info and stock
>
> The model needs some tools that look up real information from campus_customs.db:
>
> * product dexcription
> * price
> * how many are in stock (and including by size in case the customer asks)
>
> The model will be using the database, not inventing prices or quantities. If a size is out of stock please say that clearly
>
> Expand "prompt/prompt.md" so the agent knows to call these tools for price and stock questions. Add or update return types in models.py
>
> In output/harness.md list each tool and explain which model fiels were chosen for lookup results and why

### Context prompt (just before)

> Look at lecture notes and learn what are relevant tools that I could use for looking up real information from campus_customs.db https://zlisto.github.io/mgt_409_fa26/lectures.html

### What we worked out before building

- **Read the course lectures first** (Lec 3 Tools & Skills, Lec 4 Agents). They teach the
  custom-tool pattern and "never invent numbers — call tools for live data", but show no DB
  example (their tools use yfinance). So `campus_customs.db` tools are the "your data" edge the
  lectures say to build.
- **Tools were rebuilt around the three asks** (description / price / stock-by-size), each with a
  dedicated typed return in models.py (`ProductInfo`, `StockInfo`, `ProductMatch`,
  `SizeAvailability`) so field choices are explicit and documented.
- **Out-of-stock is a structured signal, not an inference**: `StockInfo` exposes
  `out_of_stock_sizes` / `in_stock_sizes` ready-made, so the agent states it plainly.
- **Lookup vs display stay separate**: price/description/stock tools return facts; `show_products`
  handles the cards, so stock is never quoted from a possibly-stale detail object.
- **Adopted one Lecture-4 harness piece now**: `UsageLimits(request_limit=8)` as a stopping rule.

---

## Problem 7: Chat Search That Updates the Page

### Initial prompt

> Problem 7: Chat search that updates the page
>
> Now we will add a neat feature to the site. Whena customer asks about a type of item, e.g., "what hoodies do you have?" the agent should search the catalogue and the website should DYNAMICALLY show those matching items as product cards (imgae, name, price, short description).
>
> This is the API contract: the agent returns structured product matches and then the front end renders them on the website. It has to be visually appealling.
>
> After the dynamic product cards are loaded by the new feature, make sure the same single-item page behavior we built in problem 3 still works:(each product card, including the ones the chat just put on the page, should still open that detail view (large image + full info) when clicked.
>
> Update "prompts/prompt.md and output/harness.md so it is clear how search results reach the page, please

### What we worked out before building

- **The API contract already existed** from Problems 5–6 (`ChatResponse.products` is structured).
  Problem 7 is the front-end half: render those matches on the website.
- **The page is the product surface.** When the agent surfaces products, a shared context drives
  the Products grid and the app navigates there, so the *website* shows the matches (not just the
  chat bubble). The in-bubble cards were replaced by a compact "N items shown on the page →" link
  to avoid displaying the same products twice.
- **One card component everywhere** (`ProductGridCard`), so catalogue and chat-placed cards look
  identical and both open the Problem 3 detail page by `product_id`.
- **A "Show all products" clear** returns the grid to the full catalogue.

### Follow-up prompt

> the products in the chat show as some weird text that's not appealing, with symbols and stuff

What was lacking after the first: the chat bubble rendered the agent's reply as plain text, so its
markdown (`**bold**`, `-` bullets) showed as literal asterisks and dashes, and the agent still
re-listed every product with prices even though the cards are now on the page.

- **Added a small safe markdown renderer** (`Markdown.tsx`) for assistant bubbles — bold, bullet
  lists and line breaks become real elements (built as React nodes, no `dangerouslySetInnerHTML`).
- **Tightened the prompt**: when products are shown on the page, the chat reply is one or two
  short sentences that point to the page and do not repeat the list or prices; markdown is used
  sparingly.

---

## Problem 9: Customer Memory

### Initial prompt

> Problem 9: Customer memory
>
> When a shopper is logged in, I want you to save their chat history in the database in an appropriate table and reload it when they return (kinda like cookies, but keep them safe, and put a mechanism so you CAN'T sell them, even if this is hypothetical). The model should know who is chatting (i..e, username/name, email) I want you to put that in agent deps (or an equivalent clear pattern) and/or tools the agent can call.
>
> Also pass enough page context that if someone is on a product page and asks :do you have this in pink?" the agent knows which item they mean. Also, you can put code into the model ocntext.
>
> guess can still chat (put guardrails, tho, it has to be sales related), but history only needs to persist for logged-in users.
>
> Document in output/harness.md how user chat hisotry is stored, what cusomer fields the model sees, and how page context is passed

### What we worked out before building

- **Reused the `chat_messages` table** (the one the seed data revealed in Problem 2) rather than
  inventing a new one — it already has user_id, role, content, products_json, created_at.
- **"Can't sell them" was made a concrete code mechanism**, not a promise: all history access is in
  one module, every function is scoped to one owner id taken from the verified token (never client
  input), there is no cross-user/bulk/export path, the shopper can delete their own data
  ("Forget my chat"), and a DATA_USE_POLICY + prompt rule forbid disclosing or selling data.
- **Identity in agent deps** (first/last name, email) injected via a dynamic system prompt; the
  model sees only the current shopper's fields, never another customer's, never password hashes.
- **Page context via `ChatRequest.page_context`**: the front end sends the current product_id from
  the URL; a dynamic system prompt resolves "this"/"it" to that product.
- **Guests chat but are never persisted** (chat_messages.user_id is NOT NULL; the route only writes
  for a resolved user), with the sales-only guardrail retained.
