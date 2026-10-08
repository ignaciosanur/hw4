# Design — styling the storefront (Problem 10)

Goal: make the site feel like a real, premium Campus Customs shop. Reference patterns were
taken from a collegiate store (**The Harvard Shop**) — a top announcement/trust strip, a
"shop by category" tile row, editorial pacing, product cards with image motion — and rendered
in the **Yale navy palette** (navy `#00356b`, deep navy `#002147`, with a collegiate **gold**
`#c7a24a` for fine detailing and a **cream** `#f7f3ea` for heritage warmth).

## What changed

**Type system.** A collegiate display serif (**Fraunces**) for headlines and a clean sans
(**Inter**) for UI/body, with stronger size/weight hierarchy. Falls back to system stacks offline.
*Helps:* type carries the "premium, official" feeling that collegiate shoppers trust.

**Announcement bar.** A thin navy strip above the nav: officially licensed · free New Haven
pickup · heritage line, gold-separated. *Helps:* leads with trust and authenticity (the #1 thing
licensed-merch buyers look for), the way real collegiate stores do.

**Hero.** Deep navy gradient, a giant faded "Y" motif, a gold "Officially licensed · New Haven"
eyebrow, big serif headline, gold bottom rule. *Helps:* an on-brand first impression that says
"the real thing," not a generic template.

**Shop by category.** A tile row built live from the catalogue — one image and the "from $X"
price per L1 category — linking straight into the filtered Products page. *Helps:* gives shoppers
an immediate, low-effort way in; fewer dead ends, more products seen.

**Product cards.** Hover image-zoom, colour swatches, and a "Low stock" / "Sold out" ribbon.
*Helps:* more shoppable and scannable; swatches answer "does it come in my colour?" at a glance,
and scarcity nudges a decision — all honest, read from the database.

**Motion.** Gentle reveal-on-scroll for sections and tiles, card lift and image zoom, a pulsing
"online" dot on the chat. All respect `prefers-reduced-motion`. *Helps:* a polished, alive feel
that keeps people scrolling, without being distracting or hurting accessibility.

**Chat feel.** A branded header with the "CC" crest and a live status dot, on the existing
navy panel. *Helps:* the assistant reads as part of the shop, so people trust and use it.

**Palette cohesion.** Gold accents on the nav mark, active link, footer rule, and dividers tie
every page together. *Helps:* a consistent, considered look that signals a real brand.

## Why it should help customers buy
Trust up front + an easy way in + shoppable, honest cards + a storefront that feels alive and
on-brand. Shoppers stay longer, see more, and reach a product (and its real price and stock)
in fewer clicks.
