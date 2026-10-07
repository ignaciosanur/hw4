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
