from __future__ import annotations

import json
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
DATA = json.loads((ROOT / "tools/srs_rewrite/evidence.json").read_text(encoding="utf-8"))


def show_docx() -> None:
    print("DOCX counts", DATA["docx"]["paragraph_count"], DATA["docx"]["table_count"])
    print("\nFIRST PARAGRAPHS")
    for item in DATA["docx"]["first_paragraphs"][:160]:
        print(f"{item['index']:03} [{item['style']}] {item['text'][:220]}")
    print("\nHEADING-LIKE")
    for item in DATA["docx"]["heading_like"][:220]:
        print(f"{item['index']:03} [{item['style']}] {item['text'][:220]}")


def show_tables() -> None:
    for table in DATA["docx"]["tables"][:20]:
        print(f"\nTABLE {table['index']}")
        for row in table["rows"][:30]:
            print(" | ".join(row)[:260])


def show_pdf() -> None:
    for page in DATA["pdf"]["pages"][:12]:
        print(f"\nPDF PAGE {page['page']}")
        for line in page["lines"][:60]:
            print(line[:220])


def show_repo() -> None:
    print("\nFRONTEND PAGES")
    for page in DATA["repo"]["frontend_pages"]:
        print(page)
    print("\nROUTES")
    for rel, routes in DATA["repo"]["routes"].items():
        print(f"\n{rel}")
        for route in routes:
            print(route)


if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "all"
    if mode in {"all", "docx"}:
        show_docx()
    if mode in {"all", "tables"}:
        show_tables()
    if mode in {"all", "pdf"}:
        show_pdf()
    if mode in {"all", "repo"}:
        show_repo()
