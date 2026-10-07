# Homework 04 — AI for Managers

## Environment
- `.venv` uses Python 3.14 (`/usr/local/bin/python3.14`). Always use `.venv/bin/python` and `.venv/bin/pip`. Never the system Anaconda `python3`, which is 3.8.
- Dependencies are in `requirements.txt`. Install with `.venv/bin/pip install -r requirements.txt`. Add anything the assignment needs (dash, fastapi, pillow, imageio-ffmpeg...) to that file rather than installing ad hoc.

## Secrets
- `.env` holds `PORTKEY_API_KEY`, `PORTKEY_BASE_URL`, `OPENAI_BASE_URL`, `OPENAI_MODEL`, `PYDANTIC_AI_NO_BANNER`, `OUTLOOK_CLIENT_ID`, `OUTLOOK_TENANT_ID` and `BACKEND_PORT`. Copied from `../Lecture 11/.env`.
- Never print, commit or share these values. `.env.example` lists key names only.

## LLM access (Portkey)
```python
client = AsyncOpenAI(api_key=key, base_url="https://api.portkey.ai/v1",
                     default_headers={"x-portkey-api-key": key})
model = OpenAIChatModel(os.getenv("OPENAI_MODEL"), provider=OpenAIProvider(openai_client=client))
```
- Course models: `gpt-5.6-luna`, `gpt-5.6-terra`, `gpt-5.6-sol`, `gpt-6-astra`. The course budget assumes luna; use a bigger model only if the user asks. Read the model name from `.env`, never hard-code it.
- Claude is the coding assistant only, never the agent's model.
- Portkey caches identical requests. Send `x-portkey-cache-force-refresh: true` when a fresh answer matters.

## Session start check
`.venv/bin/python smoke_test.py` should print `OK: <rating>`. It rates `joke.txt`.
- Verified 2026-10-07: `OK: I'd rate it 7/10...`.

## Running servers
Add servers to `.claude/launch.json` (pattern in `../Lecture 07`) and start them with the preview tools.

## Workflow (graded homework)
- The user supplies the assignment prompts. Before implementing, discuss questions, missing inputs and suggestions, and wait for their go-ahead.
- A TA will review this work. Keep a `README.md` with setup/run steps and a map from each prompt to its deliverable. Keep `requirements.txt` accurate and never commit secrets.
- Two running logs, both graded evidence, updated as each problem is worked:
  - `AI_prompts.md` — the user's verbatim prompts, one `## Problem N` section each (see the `ai-prompts-log` skill).
  - `output/harness.md` — engineering decisions per problem (speed-ups, schema choices).
- Work can span sessions. Re-read both logs and `ls` the folder before starting a new problem.

## Assignment — Campus Customs Shop + Chatbot
Build a real customer website with a helpful chatbot:
- **Front end**: React + Vite + TypeScript.
- **Backend**: Python FastAPI whose brain is a **PydanticAI** agent.
- Shoppers browse products, create an account, chat about merch, see matching items appear on the page, and get honest price/stock answers from the local DB.
- Style/voice reference: research `yalebulldogblue.com` for the Campus Customs look and for agent-prompt content.
- Model rule: all agent AI calls go through `PORTKEY_API_KEY`. Any OpenAI model in the **5.6 or 6 series** (`gpt-5.6-luna/terra/sol`, `gpt-6-astra`). A smarter model is allowed for harder agent steps. Claude is the coding assistant only, never the agent's model.

### Data (`data/` — GIT-IGNORED, see below)
- `data/campus_customs.db` — SQLite, 172 KB.
- `data/products/` — 102 product images; filenames match `catalogue.image_file_path` (`products/<slug>.jpg`).

Schema as of 2026-10-07:
| table | rows | columns |
|---|---|---|
| `catalogue` | 102 | `product_id` (TEXT PK, slug), `name`, `garment_type`, `description`, `colors` (JSON array string), `search_tags` (JSON array string), `image_file_path`, `price` (REAL) |
| `inventory` | 612 | `id` PK, `product_id` FK, `size`, `quantity`; UNIQUE(product_id, size) |
| `users` | 3 | `id` PK, `name`, `email` UNIQUE, `password_hash` (pbkdf2), `created_at`, `first_name`, `last_name` |
| `chat_messages` | 22 | `id` PK, `user_id` FK, `role`, `content`, `products_json`, `created_at` |

Data notes:
- `colors` and `search_tags` are **JSON strings**, not native arrays — parse them.
- Every product has all 6 sizes (XS, S, M, L, XL, XXL). **145 of 612 rows are quantity 0**, so out-of-stock is real and the agent must report it honestly.
- `garment_type` is **messy and unnormalized**: 22 distinct values for what is really ~6 categories, with case variants (`short-sleeve T-shirt` vs `short-sleeve t-shirt`) and near-duplicates (`hoodie` / `pullover hoodie` / `hooded sweatshirt`). Normalize before using it for filters or facets.
- Price is flat per category: t-shirt 32, performance/mock/some hooded 45, crewneck 58, hoodie 68, quarter-zip 72, full-zip hoodie 88, jacket 98.
- `chat_messages` already has 22 rows and `users` has 3 (incl. `test@campuscustoms.yale.edu`) — the DB arrived with prior-session data, so don't assume empty tables.

## Submission / git rules
- **DO NOT COMMIT `data/campus_customs.db` OR `data/products/`.** This is an explicit instruction from the user. `.gitignore` already blocks `data/`, `*.db`, `*.sqlite*`, `node_modules/`, `dist/`, `.env`, `.venv/`.
- Final deliverable is a **public GitHub repo**; the repo URL is submitted on Canvas. The last problem shows the expected file tree.
- Before any `git add`, run `git status` and confirm no DB or images are staged.
- Since the DB is not committed, the repo needs a documented way for a TA to obtain/recreate it (note the data source in `README.md`).

## Pace
- The user feeds the assignment **one problem at a time** (~8 pages of prompts). Do not run ahead and build later problems.

## Parking lot — deferred data cleaning
Do NOT clean these unilaterally. Wait to see whether a later problem asks for it. If the
assignment never does, **remind the user before submission** and do it together.
- `garment_type`: 22 values for ~6 real categories. Verified 2026-10-07: this does NOT hurt search
  (`search_tags`+`description` is a strict superset; 0 products findable only via the label).
  Normalize for the category FILTER UI and for counts, not for retrieval.
- `colors` / `search_tags`: JSON strings needing parse + normalization (casing, synonyms).
- `catalogue.name`: title-cased from slugs, e.g. "2025 Yale Vs Harvard T Shirt" ("Vs", "T Shirt").

## The prompts are the user's own
The user writes each problem in their own words, with their own thinking mixed in.
- `AI_prompts.md` logs their messages as written. No disclaimers, no hedging about paraphrase,
  no substituting handout text — the prompts are the prompts.
- Internal working note only: where something is graded on exact compliance (required filenames,
  the expected file tree, submission format), ask to see that bit of the handout rather than
  inferring. Never put this caveat in the log itself.
