"""Profile campus_customs.db for Homework 4, Problem 2.

Writes a markdown report to output/data_exploration.md. Re-runnable: the report is
generated entirely from the database, so a TA can reproduce every number here with
    .venv/bin/python explore_db.py

Covers, per table: declared schema and types, a 5-row head, missingness, and
distributions (centrality + spread for numerics, value counts for categoricals).
"""

from __future__ import annotations

import json
import sqlite3
import statistics
from pathlib import Path

DB = Path("data/campus_customs.db")
OUT = Path("output/data_exploration.md")
TABLES = ["catalogue", "inventory", "users", "chat_messages"]
# Columns whose raw values are secrets or long prose; shown truncated or masked.
MASK = {"password_hash"}
TRUNCATE = 60


def fmt(value: object, column: str) -> str:
    """Render a cell for markdown: mask secrets, truncate prose, escape pipes."""
    if column in MASK:
        return "`<redacted>`"
    if value is None:
        return "_NULL_"
    text = str(value).replace("|", "\\|").replace("\n", " ")
    return text if len(text) <= TRUNCATE else text[:TRUNCATE] + "…"


def schema(conn: sqlite3.Connection, table: str) -> list[sqlite3.Row]:
    return list(conn.execute(f"PRAGMA table_info('{table}')"))


def describe_numeric(values: list[float]) -> str:
    """Centrality and spread. SD needs two points; report n/a rather than crashing."""
    sd = f"{statistics.stdev(values):.2f}" if len(values) > 1 else "n/a"
    return (
        f"min {min(values):.2f} · max {max(values):.2f} · "
        f"mean {statistics.mean(values):.2f} · median {statistics.median(values):.2f} · SD {sd}"
    )


def profile_column(conn: sqlite3.Connection, table: str, col: str, decl: str, total: int) -> dict:
    """Missingness, cardinality, and a type-appropriate distribution summary."""
    nulls, blanks = conn.execute(
        f"SELECT SUM(\"{col}\" IS NULL), SUM(TRIM(COALESCE(CAST(\"{col}\" AS TEXT),''))='') FROM '{table}'"
    ).fetchone()
    nulls, blanks = nulls or 0, blanks or 0
    distinct = conn.execute(f"SELECT COUNT(DISTINCT \"{col}\") FROM '{table}'").fetchone()[0]

    if col in MASK:
        summary = "redacted (password hashes)"
    elif decl.upper() in {"REAL", "INTEGER"} and distinct > 1:
        values = [r[0] for r in conn.execute(f"SELECT \"{col}\" FROM '{table}' WHERE \"{col}\" IS NOT NULL")]
        numeric = [float(v) for v in values if isinstance(v, (int, float))]
        summary = describe_numeric(numeric) if numeric else "no numeric values"
    elif distinct == total and total > 1:
        summary = "unique per row (identifier)"
    else:
        top = conn.execute(
            f"SELECT \"{col}\", COUNT(*) c FROM '{table}' GROUP BY 1 ORDER BY c DESC LIMIT 3"
        ).fetchall()
        summary = "; ".join(f"`{fmt(v, col)}` ×{c}" for v, c in top)

    return {
        "missing": f"{nulls} null / {blanks} blank" if (nulls or blanks) else "none",
        "distinct": distinct,
        "summary": summary,
    }


def render_table(conn: sqlite3.Connection, table: str, lines: list[str]) -> None:
    cols = schema(conn, table)
    total = conn.execute(f"SELECT COUNT(*) FROM '{table}'").fetchone()[0]
    lines += [f"\n## `{table}` — {total} rows\n", "### Variables and types\n"]
    lines.append("| # | column | declared type | not null | PK | distinct | missing |")
    lines.append("|---|---|---|---|---|---|---|")

    profiles = {}
    for c in cols:
        p = profile_column(conn, table, c["name"], c["type"], total)
        profiles[c["name"]] = p
        lines.append(
            f"| {c['cid']} | `{c['name']}` | {c['type'] or '_none_'} | "
            f"{'yes' if c['notnull'] else 'no'} | {'yes' if c['pk'] else ''} | "
            f"{p['distinct']} | {p['missing']} |"
        )

    lines.append("\n### Head (first 5 rows)\n")
    names = [c["name"] for c in cols]
    rows = conn.execute(f"SELECT * FROM '{table}' LIMIT 5").fetchall()
    lines.append("| " + " | ".join(f"`{n}`" for n in names) + " |")
    lines.append("|" + "---|" * len(names))
    for r in rows:
        lines.append("| " + " | ".join(fmt(r[n], n) for n in names) + " |")

    lines.append("\n### Distribution\n")
    lines.append("| column | summary |")
    lines.append("|---|---|")
    for n in names:
        lines.append(f"| `{n}` | {profiles[n]['summary']} |")


def extras(conn: sqlite3.Connection, lines: list[str]) -> None:
    """Cross-table checks that matter for the shop and the chatbot."""
    lines.append("\n## Cross-table checks\n")

    orphans = conn.execute(
        "SELECT COUNT(*) FROM inventory i LEFT JOIN catalogue c USING(product_id) WHERE c.product_id IS NULL"
    ).fetchone()[0]
    no_inv = conn.execute(
        "SELECT COUNT(*) FROM catalogue c LEFT JOIN inventory i USING(product_id) WHERE i.product_id IS NULL"
    ).fetchone()[0]
    lines.append(f"- Inventory rows with no matching catalogue product: **{orphans}**")
    lines.append(f"- Catalogue products with no inventory rows: **{no_inv}**")

    sizes = [r[0] for r in conn.execute("SELECT DISTINCT size FROM inventory")]
    per = conn.execute(
        "SELECT MIN(n), MAX(n) FROM (SELECT COUNT(*) n FROM inventory GROUP BY product_id)"
    ).fetchone()
    lines.append(f"- Sizes in use: {', '.join(f'`{s}`' for s in sizes)} ({per[0]}–{per[1]} rows per product)")

    oos, zero_tot = conn.execute(
        "SELECT SUM(quantity=0), COUNT(*) FROM inventory"
    ).fetchone()
    lines.append(f"- **Out-of-stock rows: {oos} of {zero_tot} ({oos/zero_tot:.0%})** — stock answers must be real.")

    fully_oos = conn.execute(
        "SELECT COUNT(*) FROM (SELECT product_id FROM inventory GROUP BY 1 HAVING SUM(quantity)=0)"
    ).fetchone()[0]
    lines.append(f"- Products out of stock in *every* size: **{fully_oos}**")

    # Image files referenced by the catalogue must actually exist on disk.
    missing_img = sum(
        1 for (p,) in conn.execute("SELECT image_file_path FROM catalogue") if not (Path("data") / p).exists()
    )
    lines.append(f"- Catalogue image paths with no file on disk: **{missing_img}**")

    # colors / search_tags are JSON-encoded strings, not native columns.
    bad = 0
    colors, tags = set(), set()
    for col_json, tag_json in conn.execute("SELECT colors, search_tags FROM catalogue"):
        try:
            colors.update(json.loads(col_json))
            tags.update(json.loads(tag_json))
        except (json.JSONDecodeError, TypeError):
            bad += 1
    lines.append(f"- `colors` / `search_tags` parse as JSON arrays: **{len(colors)}** distinct colors, "
                 f"**{len(tags)}** distinct tags, **{bad}** unparseable rows")

    gt = conn.execute("SELECT COUNT(DISTINCT garment_type), COUNT(DISTINCT LOWER(garment_type)) FROM catalogue").fetchone()
    lines.append(f"- `garment_type` has **{gt[0]}** distinct values (**{gt[1]}** case-insensitive) for ~6 real "
                 "categories — unnormalized, needs mapping before use as a filter.")

    lines.append("\n### Price by garment type\n")
    lines.append("| garment_type | n | price |")
    lines.append("|---|---|---|")
    for g, n, lo, hi in conn.execute(
        "SELECT garment_type, COUNT(*), MIN(price), MAX(price) FROM catalogue GROUP BY 1 ORDER BY 2 DESC, 1"
    ):
        price = f"${lo:.0f}" if lo == hi else f"${lo:.0f}–${hi:.0f}"
        lines.append(f"| {g} | {n} | {price} |")


def main() -> None:
    if not DB.exists():
        raise SystemExit(f"{DB} not found — the database is git-ignored; restore it from the course data.zip.")
    OUT.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row

    lines = [
        "# Data exploration — `campus_customs.db`",
        "",
        "Generated by `explore_db.py`. Do not edit by hand; re-run to refresh.",
        "Password hashes are redacted and long text is truncated.",
    ]
    for t in TABLES:
        render_table(conn, t, lines)
    extras(conn, lines)

    OUT.write_text("\n".join(lines) + "\n")
    print(f"wrote {OUT} ({len(lines)} lines)")


if __name__ == "__main__":
    main()
