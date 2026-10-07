# Campus Customs — Shop + Chatbot

Yale SOM, *AI for Managers*, Homework 4. A React + Vite + TypeScript storefront with a
Python FastAPI backend whose brain becomes a PydanticAI agent in Problem 5.

## The data is not in this repository

`data/` is deliberately git-ignored — it holds the course-supplied database and 102 product
images, which are not ours to publish. **The app will not run without it.**

```
data/
├── campus_customs.db     # SQLite: catalogue, inventory, users, chat_messages
└── products/             # 102 .jpg files, names matching catalogue.image_file_path
```

Unzip the course `data.zip` into `data/` so the paths above line up. The API returns a clear
503 explaining this if the database is missing, rather than failing obscurely.

## Setup

```bash
# Backend — Python 3.14
python3.14 -m venv .venv
.venv/bin/pip install -r requirements.txt

# Frontend — Node 24
npm --prefix frontend install
```

Copy `.env.example` to `.env` and fill in `PORTKEY_API_KEY` (needed from Problem 5 onward;
Problem 3 does not make AI calls).

## Running

Two terminals:

```bash
cd backend && uvicorn main:app --reload --port 8000
```
(On a machine where port 8000 is busy, use another port and set `VITE_API_TARGET`
in a git-ignored `.env.local` so the front end's proxy follows.)

```bash
npm --prefix frontend run dev
```

Then open **http://127.0.0.1:5183**.

Ports 8010/5183 are used rather than the defaults 8000/5173, which other folders in this
course occupy. Vite proxies `/api` and `/media` to the backend, so the browser sees one origin.

## Problem → deliverable

| Problem | Deliverable |
|---|---|
| 1 — Vibe coder prompts | [`AI_prompts.md`](AI_prompts.md) |
| 2 — Analyse the database | [`explore_db.py`](explore_db.py), [`field_evidence.py`](field_evidence.py) → [`output/data_exploration.md`](output/data_exploration.md), [`output/field_evidence.md`](output/field_evidence.md), [`output/harness.md`](output/harness.md) |
| 3 — Build the website | [`frontend/`](frontend), [`backend/main.py`](backend/main.py) |
| 4 — Accounts & login | [`backend/auth.py`](backend/auth.py), [`backend/security.py`](backend/security.py), [`frontend/src/pages/Auth.tsx`](frontend/src/pages/Auth.tsx) |
| 5 — PydanticAI agent | [`backend/agent.py`](backend/agent.py), [`backend/tools.py`](backend/tools.py), [`backend/models.py`](backend/models.py), [`backend/prompts/prompt.md`](backend/prompts/prompt.md) |

## Layout

```
backend/main.py          FastAPI: /api/products, /api/products/{id}, /api/chat (stub), /media/*
frontend/src/
├── api.ts               typed fetch client
├── types.ts             mirrors the Pydantic models
├── components/          NavBar, Footer, ChatPanel (floating, bottom-right)
│   └── auth.tsx         client auth state (session token)
└── pages/               Home, Products, ProductDetail, About, Auth
explore_db.py            regenerates output/data_exploration.md
field_evidence.py        regenerates output/field_evidence.md
output/harness.md        the running build harness (data dictionary, decisions)
```

## Notes on this build

- **Images are served at `/media/products/<slug>.jpg`.** That convention was reverse-engineered
  from the `image_url` field in the seeded `chat_messages.products_json`, where it appears
  despite not existing in any table.
- **The chat is a real PydanticAI agent** (Problem 5) behind `POST /api/chat`. It answers from the
  catalogue and live stock via read-only DB tools, shows matching product cards, and greets a
  signed-in shopper by name. Model and prompt load from `.env` and `backend/prompts/prompt.md`.
- **Log in / create account are forms only.** No authentication is wired up yet.
- **Site copy is original.** Facts about Campus Customs (official licensing, the 57 Broadway
  storefront, the breadth of the range) were researched from yalebulldogblue.com; the wording
  is not taken from it.
