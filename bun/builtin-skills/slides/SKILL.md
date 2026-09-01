---
name: slides
description: "Generate good-looking presentations fast from Markdown via Marp CLI — export to PDF, PPTX or HTML. Best default for new decks; use the pptx skill instead when editing an existing branded .pptx."
metadata:
  short-description: "Markdown → styled deck (pdf/pptx/html) with Marp CLI."
---
# slides — Markdown → presentation (Marp)

Run via `bunx @marp-team/marp-cli` (or `npx @marp-team/marp-cli`). Needs bunx/npx, network on
first run (package download), and a Chromium/Chrome for PDF/PPTX/image export (Marp finds an
installed browser automatically; if none, only HTML export works).

## Workflow

1. Write `deck.md` — slides separated by `---`, frontmatter picks theme:

```markdown
---
marp: true
theme: default
paginate: true
size: 16:9
style: |
  :root { --color-background: #ffffff; --color-foreground: #1a1a2e; }
  section { font-family: 'Inter', 'Helvetica Neue', sans-serif; padding: 60px; }
  h1 { color: #16213e; }
  section.lead h1 { font-size: 2.2em; }
  section.invert { background: #16213e; color: #fff; }
---

<!-- _class: lead -->
# Deck Title
Subtitle · Author · Date

---

## Agenda
- Point one
- Point two

---

<!-- _class: invert -->
# Section divider

---

## Slide with image
![bg right:40%](assets/photo.png)
- Text sits left, image fills right 40%
```

2. Export:
```bash
bunx @marp-team/marp-cli deck.md --pdf --allow-local-files -o deck.pdf
bunx @marp-team/marp-cli deck.md --pptx --allow-local-files -o deck.pptx
bunx @marp-team/marp-cli deck.md -o deck.html
bunx @marp-team/marp-cli deck.md --images png -o thumbs/s.png  # → thumbs/s.001.png … verify visually
```

3. **Look at the PNGs** before delivering. Fix overflow (too much text = split the slide), then re-export.

## Quality rules

- One idea per slide; max 5 bullets; headline states the takeaway ("Revenue doubled in Q3", not "Q3 results").
- Use `<!-- _class: lead -->` for title, `invert` for section dividers — rhythm makes a deck feel designed.
- Backgrounds/split layouts: `![bg]`, `![bg right:40%]`, `![bg fit]`. Charts: generate a PNG (matplotlib) and embed it.
- Custom brand: put colors/fonts in the frontmatter `style:` block; keep to 2 colors + 1 accent.
- Note: `--pptx` export produces slides-as-images (not editable text). If the user needs editable PowerPoint, use the `pptx` skill.
