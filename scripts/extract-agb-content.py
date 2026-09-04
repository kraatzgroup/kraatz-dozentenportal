#!/usr/bin/env python3
"""Extrahiert den AGB-Text aus dem PDF nach public/agb-content.json.

Erzeugt strukturierte Blöcke (Überschriften, Absätze, Listenpunkte, Tabellen),
die von src/components/AGBPage.tsx gerendert werden.

Aufruf:  python3 scripts/extract-agb-content.py "<pfad/zur/AGB.pdf>"
Benötigt: pip install pymupdf
"""
import json
import re
import sys
from pathlib import Path

import pymupdf

OUT = Path(__file__).resolve().parent.parent / "public" / "agb-content.json"

RE_SECTION = re.compile(r"^§\s*\d+")
RE_NUM = re.compile(r"^\(\d+\)\s")
RE_ALPHA = re.compile(r"^[a-z][.)]\s")
RE_BULLET = re.compile(r"^[•\-\u2022\uf0b7]\s")


def clean(s: str) -> str:
    return re.sub(r"\s+", " ", s).strip()


def join_lines(lines):
    """Zeilenumbrüche eines Absatzes zusammenführen (inkl. Trennstrich-Wörter)."""
    out = ""
    for line in lines:
        line = line.strip()
        if not out:
            out = line
        elif out.endswith("-") and not out.endswith(" -"):
            out += line
        else:
            out += " " + line
    return clean(out)


def is_real_table(rows):
    """Fließtext-Absätze aussortieren, die der Tabellenerkennung ins Netz gehen."""
    if len(rows) < 2 or len(rows[0]) < 2:
        return False
    cols = len(rows[0])
    filled = [sum(1 for r in rows if len(r) > c and r[c]) for c in range(cols)]
    if any(f < len(rows) * 0.5 for f in filled):
        return False
    return max((len(c) for r in rows for c in r), default=0) <= 120


def page_elements(page):
    """Zeilen und Tabellen der Seite in Lesereihenfolge."""
    tables = []
    # nur echte, umrandete Tabellen ("lines") – sonst werden Fließtextabsätze
    # fälschlich als Tabellen erkannt
    for t in page.find_tables(strategy="lines").tables:
        rows = [[clean(c or "") for c in row] for row in t.extract()]
        rows = [r for r in rows if any(r)]
        if is_real_table(rows):
            tables.append((pymupdf.Rect(t.bbox), rows))

    items = [(rect.y0, "table", rows) for rect, rows in tables]
    for block in page.get_text("dict")["blocks"]:
        for line in block.get("lines", []):
            text = "".join(s["text"] for s in line["spans"])
            bbox = pymupdf.Rect(line["bbox"])
            if any(r.intersects(bbox) for r, _ in tables):
                continue
            if not text.strip():
                # Leerzeile aus Word = Absatzende
                items.append((bbox.y0, "break", None))
                continue
            bold = any("Bold" in s["font"] for s in line["spans"])
            items.append((bbox.y0, "line", (text, bold)))
    items.sort(key=lambda i: i[0])
    return items


def build(doc):
    blocks = []
    buffer = []  # gesammelte Zeilen des aktuellen Absatzes
    buffer_kind = None
    buffer_bold = True

    def flush():
        nonlocal buffer, buffer_kind, buffer_bold
        if buffer:
            blocks.append({"type": buffer_kind, "text": join_lines(buffer)})
            if buffer_kind == "paragraph" and buffer_bold:
                blocks[-1]["type"] = "subheading"
        buffer, buffer_kind, buffer_bold = [], None, True

    for page in doc:
        for _, kind, payload in page_elements(page):
            if kind == "break":
                flush()
                continue
            if kind == "table":
                flush()
                blocks.append({"type": "table", "rows": payload})
                continue
            text, bold = payload
            stripped = text.strip()
            if RE_SECTION.match(stripped):
                flush()
                buffer_kind = "heading"
            elif RE_NUM.match(stripped):
                flush()
                buffer_kind = "item"
            elif RE_ALPHA.match(stripped) or RE_BULLET.match(stripped):
                flush()
                buffer_kind = "subitem"
            elif buffer_kind is None:
                buffer_kind = "paragraph"
            buffer.append(stripped)
            buffer_bold = buffer_bold and bold
            if buffer_kind == "heading":
                flush()  # §-Überschriften sind immer einzeilig
        # kein flush() am Seitenende: Absätze laufen über Seitenumbrüche weiter
    flush()

    # Erster Block ist der Dokumenttitel
    for b in blocks:
        if b["type"] in ("paragraph", "subheading"):
            b["type"] = "title"
            break
    return blocks


def main():
    src = sys.argv[1] if len(sys.argv) > 1 else None
    if not src:
        sys.exit("Usage: extract-agb-content.py <pfad/zur/AGB.pdf>")
    doc = pymupdf.open(src)
    blocks = build(doc)
    OUT.write_text(
        json.dumps({"source": Path(src).name, "blocks": blocks}, ensure_ascii=False, indent=1),
        encoding="utf-8",
    )
    print(f"{len(blocks)} Blöcke -> {OUT}")


main()
