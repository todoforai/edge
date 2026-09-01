#!/usr/bin/env python3
"""Inventory a .pptx: per-slide shapes, text, positions — so edits can be targeted.

Usage: inventory.py <file.pptx> [--text-only]
Requires: pip install python-pptx
"""
import sys
from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE
from pptx.util import Emu


def fmt_len(v):
    return f"{Emu(v).inches:.2f}in" if v is not None else "?"


def iter_shapes(shapes):
    for shape in shapes:
        yield shape
        if shape.shape_type == MSO_SHAPE_TYPE.GROUP:  # recurse so grouped text isn't missed
            yield from iter_shapes(shape.shapes)


def shape_text(shape):
    if shape.has_text_frame:
        return shape.text_frame.text.replace("\n", " | ")
    if getattr(shape, "has_table", False) and shape.has_table:
        return " | ".join(c.text for row in shape.table.rows for c in row.cells if c.text)
    return ""


def main(path: str, text_only: bool) -> None:
    prs = Presentation(path)
    print(f"{path}: {len(prs.slides)} slides, {prs.slide_width.inches:.2f}x{prs.slide_height.inches:.2f}in")
    for i, slide in enumerate(prs.slides, 1):
        part = str(slide.part.partname).lstrip("/")  # real XML part — slides can be reordered
        print(f"\n--- slide {i} (layout: {slide.slide_layout.name}) [{part}]")
        for shape in iter_shapes(slide.shapes):
            text = shape_text(shape)
            if text_only:
                if text:
                    print(f"  {text}")
                continue
            pos = f"@({fmt_len(shape.left)},{fmt_len(shape.top)}) {fmt_len(shape.width)}x{fmt_len(shape.height)}"
            kind = str(shape.shape_type).split(" ")[0]
            print(f"  id={shape.shape_id} {kind} '{shape.name}' {pos}" + (f" text: {text[:120]}" if text else ""))
        if slide.has_notes_slide and slide.notes_slide.notes_text_frame.text.strip():
            print(f"  [notes] {slide.notes_slide.notes_text_frame.text.strip()[:200]}")


if __name__ == "__main__":
    if len(sys.argv) < 2:
        print(__doc__)
        sys.exit(1)
    main(sys.argv[1], "--text-only" in sys.argv)
