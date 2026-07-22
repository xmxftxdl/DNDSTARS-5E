"""Audit and generate the context-reviewed Chinese SRD 5.1 magic-item catalog.

No translation service is used. The script extracts the official English source
and page provenance into a review workbook. TypeScript output is emitted only
after every allow-listed item has a non-empty, explicitly reviewed Chinese body.

Usage:
  python scripts/generate-srd-magic-item-rules.py <official-srd-5.1.pdf>
  python scripts/generate-srd-magic-item-rules.py <official-srd-5.1.pdf> --emit
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
import time
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path

try:
    import pymupdf
except ImportError:  # pragma: no cover - bundled fallback
    pymupdf = None
from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "src/rulesets/dnd5e/magicItems.ts"
OUTPUT_PATH = ROOT / "src/rulesets/dnd5e/magicItemRulesZh.generated.ts"
REVIEWED_OUTPUT_PATH = ROOT / "src/rulesets/dnd5e/magicItemRulesZh.reviewed.generated.ts"
REVIEWED_PATH = ROOT / "content/srd51/magic-items.zh.reviewed.json"
WORKBOOK_PATH = ROOT / "tmp/srd51-magic-items.zh.workbook.json"
SOURCE_CACHE_PATH = ROOT / "tmp/srd51-magic-items.en.cache.json"
PAGE_CACHE_PATH = ROOT / "tmp/srd-magic-item-source-pages.json"
API_ROOT = "https://www.dnd5eapi.co/api/2014/magic-items"
EXPECTED_COUNT = 240
MANUAL_ENGLISH_RULES = {
    # The common API mirror omits the base shield family even though the
    # heading and rule are present in the official SRD 5.1 PDF.
    "shield": "While holding this shield, you have a bonus to AC determined by the shield's rarity. This bonus is in addition to the shield's normal bonus to AC.",
}


def read_catalog() -> list[dict[str, str]]:
    source = CATALOG_PATH.read_text(encoding="utf-8")
    rows = re.findall(
        r"^\s*\['([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)',\s*'([^']+)'\],?$",
        source,
        re.M,
    )
    result = [
        {"id": item_id, "name": name, "englishName": english_name}
        for item_id, name, english_name, _kind, _rarity in rows
    ]
    if len(result) != EXPECTED_COUNT:
        raise RuntimeError(f"expected {EXPECTED_COUNT} SRD magic items, got {len(result)}")
    return result


def normalized_words(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower().replace("’", "'"))


def official_heading_pages(pdf_path: Path, catalog: list[dict[str, str]]) -> dict[str, int]:
    if PAGE_CACHE_PATH.exists():
        cached = json.loads(PAGE_CACHE_PATH.read_text(encoding="utf-8"))
        if isinstance(cached, dict) and all(item["id"] in cached for item in catalog):
            return {item["id"]: int(cached[item["id"]]) for item in catalog}
    if pymupdf is not None:
        document = pymupdf.open(pdf_path)
        pages = {
            page_number: normalized_words(document[page_number - 1].get_text())
            for page_number in range(205, 254)
        }
        document.close()
    else:
        reader = PdfReader(str(pdf_path))
        pages = {
            page_number: normalized_words(page.extract_text() or "")
            for page_number, page in enumerate(reader.pages, start=1)
            if 205 <= page_number <= 253
        }
    result: dict[str, int] = {}
    for item in catalog:
        heading = normalized_words(item["englishName"])
        page = next((number for number, text in pages.items() if heading in text), None)
        if page is None:
            raise RuntimeError(f"official SRD heading not found: {item['englishName']}")
        result[item["id"]] = page
    PAGE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PAGE_CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def request_json(url: str) -> object:
    request = urllib.request.Request(url, headers={"User-Agent": "DNDSTARS-5E SRD source auditor"})
    last_error: Exception | None = None
    for attempt in range(5):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            time.sleep(1.5 * (attempt + 1))
    raise RuntimeError(f"request failed: {url}") from last_error


def load_source_cache(catalog: list[dict[str, str]]) -> dict[str, str]:
    cache: dict[str, str] = {}
    if SOURCE_CACHE_PATH.exists():
        parsed = json.loads(SOURCE_CACHE_PATH.read_text(encoding="utf-8"))
        if isinstance(parsed, dict):
            cache = {str(key): str(value) for key, value in parsed.items() if isinstance(value, str)}
    for index, item in enumerate(catalog, start=1):
        if cache.get(item["id"]):
            continue
        if item["id"] in MANUAL_ENGLISH_RULES:
            cache[item["id"]] = MANUAL_ENGLISH_RULES[item["id"]]
            SOURCE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
            SOURCE_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
            print(f"source [{index}/{EXPECTED_COUNT}] {item['englishName']} (official PDF)", flush=True)
            continue
        payload = request_json(f"{API_ROOT}/{urllib.parse.quote(item['id'])}")
        if not isinstance(payload, dict) or payload.get("name") != item["englishName"]:
            raise RuntimeError(f"SRD mirror mismatch: {item['id']}")
        description = payload.get("desc")
        if not isinstance(description, list) or len(description) < 2:
            raise RuntimeError(f"missing SRD body: {item['id']}")
        cache[item["id"]] = "\n\n".join(str(line).strip() for line in description[1:] if str(line).strip())
        SOURCE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        SOURCE_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"source [{index}/{EXPECTED_COUNT}] {item['englishName']}", flush=True)
        time.sleep(0.25)
    return cache


def read_reviewed() -> dict[str, dict[str, str]]:
    if not REVIEWED_PATH.exists():
        return {}
    parsed = json.loads(REVIEWED_PATH.read_text(encoding="utf-8"))
    if not isinstance(parsed, dict):
        raise RuntimeError(f"reviewed translation file must be an object: {REVIEWED_PATH}")
    result: dict[str, dict[str, str]] = {}
    for item_id, value in parsed.items():
        if not isinstance(value, dict):
            raise RuntimeError(f"reviewed entry must be an object: {item_id}")
        result[str(item_id)] = {str(key): str(field) for key, field in value.items() if isinstance(field, str)}
    return result


def write_workbook(
    catalog: list[dict[str, str]],
    sources: dict[str, str],
    pages: dict[str, int],
    reviewed: dict[str, dict[str, str]],
) -> None:
    rows = []
    for item in catalog:
        existing = reviewed.get(item["id"], {})
        rows.append({
            **item,
            "sourceBook": "SRD 5.1",
            "sourcePage": pages[item["id"]],
            "sourceEnglishText": sources[item["id"]],
            "rulesText": existing.get("rulesText", ""),
            "reviewedBy": existing.get("reviewedBy", ""),
            "reviewedAt": existing.get("reviewedAt", ""),
        })
    WORKBOOK_PATH.parent.mkdir(parents=True, exist_ok=True)
    WORKBOOK_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def checked_records(
    catalog: list[dict[str, str]],
    pages: dict[str, int],
    reviewed: dict[str, dict[str, str]],
    *,
    require_complete: bool,
) -> dict[str, dict[str, object]]:
    catalog_ids = {item["id"] for item in catalog}
    unknown = sorted(set(reviewed) - catalog_ids)
    if unknown:
        raise RuntimeError(f"reviewed translations contain unknown IDs: {unknown}")
    incomplete = [
        item["id"] for item in catalog if item["id"] in reviewed and (
            not reviewed[item["id"]].get("rulesText", "").strip()
            or not reviewed[item["id"]].get("reviewedBy", "").strip()
            or not reviewed[item["id"]].get("reviewedAt", "").strip()
        )
    ]
    if incomplete:
        raise RuntimeError(f"reviewed magic-item translations have incomplete fields: {incomplete}")
    missing = [item["id"] for item in catalog if item["id"] not in reviewed]
    if require_complete and missing:
        raise RuntimeError(
            f"{len(missing)} magic-item translations still need contextual review; "
            f"complete {REVIEWED_PATH} using {WORKBOOK_PATH} before --emit"
        )
    return {
        item["id"]: {
            "rulesText": reviewed[item["id"]]["rulesText"].strip(),
            "sourcePage": pages[item["id"]],
        }
        for item in catalog if item["id"] in reviewed
    }


def render(catalog: list[dict[str, str]], records: dict[str, dict[str, object]], pdf_sha256: str) -> None:
    lines = [
        "// Generated by scripts/generate-srd-magic-item-rules.py from context-reviewed translations.",
        "// Source: Wizards of the Coast SRD 5.1, CC BY 4.0. Do not hand-edit.",
        "",
        "import type { Dnd5eSrdMagicItemRuleTextZh } from './magicItemRuleTypes'",
        "",
        f"export const DND5E_SRD_MAGIC_ITEM_RULES_PDF_SHA256 = {json.dumps(pdf_sha256)}",
        "",
        "export const DND5E_SRD_MAGIC_ITEM_RULES_ZH: Readonly<Record<string, Dnd5eSrdMagicItemRuleTextZh>> = {",
    ]
    for item in catalog:
        record = records[item["id"]]
        lines.append(f"  {json.dumps(item['id'], ensure_ascii=False)}: {{")
        lines.append(f"    rulesText: {json.dumps(record['rulesText'], ensure_ascii=False)},")
        lines.append(f"    sourcePage: {record['sourcePage']},")
        lines.append("  },")
    lines.extend(["}", ""])
    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")


def render_reviewed(records: dict[str, dict[str, object]]) -> None:
    lines = [
        "// Generated by scripts/generate-srd-magic-item-rules.py from context-reviewed translations.",
        "// Source: Wizards of the Coast SRD 5.1, CC BY 4.0. Do not hand-edit.", "",
        "import type { Dnd5eSrdMagicItemRuleTextZh } from './magicItemRuleTypes'", "",
        "export const DND5E_SRD_MAGIC_ITEM_RULES_ZH_REVIEWED:",
        "  Readonly<Partial<Record<string, Dnd5eSrdMagicItemRuleTextZh>>> = "
        + json.dumps(records, ensure_ascii=False, indent=2), "",
    ]
    REVIEWED_OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] not in ("--emit", "--emit-reviewed")):
        raise SystemExit("usage: generate-srd-magic-item-rules.py <official-srd-5.1.pdf> [--emit|--emit-reviewed]")
    pdf_path = Path(sys.argv[1]).resolve()
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")
    catalog = read_catalog()
    pages = official_heading_pages(pdf_path, catalog)
    sources = load_source_cache(catalog)
    reviewed = read_reviewed()
    write_workbook(catalog, sources, pages, reviewed)
    print(f"wrote review workbook: {WORKBOOK_PATH}")
    if len(sys.argv) == 3 and sys.argv[2] == "--emit":
        records = checked_records(catalog, pages, reviewed, require_complete=True)
        render(catalog, records, hashlib.sha256(pdf_path.read_bytes()).hexdigest())
        print(f"wrote {OUTPUT_PATH} ({EXPECTED_COUNT} context-reviewed entries)")
    elif len(sys.argv) == 3:
        records = checked_records(catalog, pages, reviewed, require_complete=False)
        render_reviewed(records)
        print(f"wrote {REVIEWED_OUTPUT_PATH} ({len(records)} context-reviewed entries)")


if __name__ == "__main__":
    main()
