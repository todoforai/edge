#!/usr/bin/env python3
"""Unpack/pack OOXML files (.pptx/.docx/.xlsx) so their XML can be edited directly.

Usage:
  ooxml.py unpack <file.pptx> <dir>   # extract all parts into <dir>
  ooxml.py pack <dir> <file.pptx>     # zip <dir> back into a valid OOXML file

Editing the unpacked XML (e.g. ppt/slides/slide1.xml) and repacking preserves
the original theme, masters, layouts and branding untouched.
"""
import sys
import zipfile
from pathlib import Path


def unpack(src: str, dst: str) -> None:
    out = Path(dst)
    if out.exists() and any(out.iterdir()):
        sys.exit(f"error: {out} is not empty — unpack into a fresh dir so stale parts can't leak into a later pack")
    out.mkdir(parents=True, exist_ok=True)
    with zipfile.ZipFile(src) as z:
        z.extractall(out)
    print(f"unpacked {len(list(out.rglob('*')))} entries -> {out}")


def pack(src: str, dst: str) -> None:
    root = Path(src)
    if not (root / "[Content_Types].xml").is_file() or not (root / "_rels" / ".rels").is_file():
        sys.exit(f"error: {root} doesn't look like an unpacked OOXML tree ([Content_Types].xml / _rels/.rels missing)")
    if Path(dst).resolve().is_relative_to(root.resolve()):
        sys.exit("error: output file must be outside the source tree")
    files = sorted(p for p in root.rglob("*") if p.is_file())
    # [Content_Types].xml should be the first entry
    files.sort(key=lambda p: (p.name != "[Content_Types].xml", str(p)))
    with zipfile.ZipFile(dst, "w", zipfile.ZIP_DEFLATED) as z:
        for p in files:
            z.write(p, p.relative_to(root).as_posix())
    print(f"packed {len(files)} parts -> {dst}")


if __name__ == "__main__":
    if len(sys.argv) != 4 or sys.argv[1] not in ("unpack", "pack"):
        print(__doc__)
        sys.exit(1)
    (unpack if sys.argv[1] == "unpack" else pack)(sys.argv[2], sys.argv[3])
