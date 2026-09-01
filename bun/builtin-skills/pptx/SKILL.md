---
name: pptx
description: "Create new PowerPoint decks and edit existing .pptx files while preserving their template/branding. Uses python-pptx for creation and OOXML unpack/edit/repack for surgical edits. Also applies to .docx/.xlsx via the same OOXML approach."
metadata:
  short-description: "Create and edit .pptx (and other Office files) — python-pptx + OOXML XML editing."
---
# pptx — create & edit PowerPoint files

Scripts live next to this file in `scripts/` (call them with `python3`/`bash` from the skill dir).
Dependencies (install once per machine, before first use): `python3 -m pip install python-pptx`
(fall back to `pip3 install` / a venv if pip is externally managed), and `libreoffice` + `pdftoppm`
(poppler-utils) for visual rendering. If rendering tools are missing, still deliver the file but say it wasn't visually verified.

## Decision tree

- **New deck, quick & clean** → write a python-pptx script (below).
- **New deck, needs to look designed** → prefer the `slides` skill (Marp → pptx/pdf) unless the user needs native editable PowerPoint shapes.
- **Modify an EXISTING deck** (client template, branded file) → NEVER regenerate from scratch. Use OOXML editing to keep theme/masters/layouts intact.

## Editing an existing deck (the important case)

1. **Inventory first** — see what's on each slide and which XML file holds it:
   ```bash
   python3 scripts/inventory.py deck.pptx            # shapes, positions, text per slide
   python3 scripts/inventory.py deck.pptx --text-only
   ```
2. **Unpack** to raw XML:
   ```bash
   python3 scripts/ooxml.py unpack deck.pptx work/
   ```
   Key parts: `ppt/slides/slideN.xml` (content), `ppt/slideLayouts/`, `ppt/slideMasters/`, `ppt/theme/theme1.xml` (colors/fonts), `ppt/presentation.xml` (slide order), `docProps/`.
3. **Edit the XML** with your normal file-edit tools. Text lives in `<a:t>…</a:t>` runs. Keep runs' formatting (`<a:rPr>`) intact — replace only the text inside `<a:t>`. To restyle, edit `<a:rPr>`/`<a:solidFill>` attributes. Don't touch relationship IDs (`r:id`) unless you also update `ppt/slides/_rels/slideN.xml.rels`.
4. **Repack & verify**:
   ```bash
   python3 scripts/ooxml.py pack work/ deck-edited.pptx
   bash scripts/render.sh deck-edited.pptx   # PNG thumbnails — LOOK at them before delivering
   ```

For simple text/data swaps you can skip XML and use python-pptx directly on the existing file (open `Presentation("deck.pptx")`, walk `slide.shapes`, set `run.text`, save-as) — but python-pptx cannot delete slides or edit masters; use OOXML for those. To duplicate/reorder/remove slides, edit `<p:sldIdLst>` in `ppt/presentation.xml` (and add/remove the slide part + its `.rels` + `[Content_Types].xml` override when adding/removing).

The same unpack/edit/pack workflow applies to `.docx` (`word/document.xml`) and `.xlsx` (`xl/worksheets/sheetN.xml`, prefer `openpyxl` for xlsx).

## Creating a new deck (python-pptx)

Write one script per deck. Rules that keep output professional:
- Set slide size 16:9: `prs.slide_width = Inches(13.333); prs.slide_height = Inches(7.5)`.
- Use a blank layout (`prs.slide_layouts[6]`) and place textboxes explicitly — placeholder layouts look generic.
- Define a palette (2 colors + 1 accent) and 2 font sizes (title ~36pt, body ~18pt) as constants; use them everywhere.
- Max ~5 bullets/slide, ~8 words/bullet. Prefer a chart/table (`chart` via `pptx.chart`, or matplotlib PNG inserted with `add_picture`) over text.
- Full-bleed section dividers (colored rectangle covering slide) between chapters.

Minimal skeleton:
```python
from pptx import Presentation
from pptx.util import Inches, Pt
from pptx.dml.color import RGBColor

prs = Presentation(); prs.slide_width, prs.slide_height = Inches(13.333), Inches(7.5)
s = prs.slides.add_slide(prs.slide_layouts[6])
tb = s.shapes.add_textbox(Inches(0.6), Inches(0.5), Inches(12), Inches(1.2))
r = tb.text_frame.paragraphs[0].add_run(); r.text = "Title"
r.font.size, r.font.bold, r.font.color.rgb = Pt(36), True, RGBColor(0x1A,0x1A,0x2E)
prs.save("out.pptx")
```

## Always verify visually

After ANY create/edit: `bash scripts/render.sh file.pptx` and read the PNGs. Check for overflowing text, overlaps, broken charts. Fix and re-render until clean.
