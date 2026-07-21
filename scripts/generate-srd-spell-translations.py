"""Create and validate the context-reviewed Chinese SRD 5.1 spell catalog.

The official English SRD PDF supplies the allow-list/page provenance. The 2014
SRD API transcription is used only to prepare a structured English review
worksheet. No translation service is called and no PHB text is accepted.

Usage:
  python scripts/generate-srd-spell-translations.py <official-srd-5.1.pdf>
  python scripts/generate-srd-spell-translations.py <official-srd-5.1.pdf> --emit
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
CATALOG_PATH = ROOT / "src/rulesets/dnd5e/spellCatalog.ts"
OUTPUT_PATH = ROOT / "src/rulesets/dnd5e/spellDescriptionsZh.generated.ts"
REVIEWED_OUTPUT_PATH = ROOT / "src/rulesets/dnd5e/spellDescriptionsZh.reviewed.generated.ts"
REVIEWED_PATH = ROOT / "content/srd51/spells.zh.reviewed.json"
WORKBOOK_PATH = ROOT / "tmp/srd51-spells.zh.workbook.json"
SOURCE_CACHE_PATH = ROOT / "tmp/srd51-spells.en.cache.json"
PAGE_CACHE_PATH = ROOT / "tmp/srd51-spell-source-pages.json"
API_ROOT = "https://www.dnd5eapi.co/api/2014/spells"
EXPECTED_COUNT = 319
SCHOOLS_ZH = {
    "Abjuration": "防护", "Conjuration": "咒法", "Divination": "预言", "Enchantment": "附魔",
    "Evocation": "塑能", "Illusion": "幻术", "Necromancy": "死灵", "Transmutation": "变化",
}
SOURCE_PAGE_SENTINELS = {
    "shield": 179,
    "wish": 193,
    "invisibility": 157,
    "magic-missile": 161,
}


def read_catalog() -> list[dict[str, object]]:
    source = CATALOG_PATH.read_text(encoding="utf-8")
    rows = re.findall(r"^([a-z0-9-]+)\|([^|]+)\|(\d)\|([^\n]+)$", source, re.M)
    result = [
        {"id": spell_id, "englishName": english_name, "level": int(level)}
        for spell_id, english_name, level, _classes in rows
    ]
    if len(result) != EXPECTED_COUNT:
        raise RuntimeError(f"expected {EXPECTED_COUNT} SRD spells, got {len(result)}")
    return result


def clean_text(value: str) -> str:
    value = value.replace("\u00a0", " ").replace("\xad", "").replace("‐", "-").replace("‑", "-").replace("’", "'")
    return re.sub(r"\s+", " ", value).strip()


def heading_name_pages(page_lines: dict[int, list[str]]) -> dict[str, list[int]]:
    schools = {school.casefold().replace(" ", "") for school in SCHOOLS_ZH}
    headings: dict[str, list[int]] = {}
    for page_number, raw_lines in page_lines.items():
        lines = [clean_text(line) for line in raw_lines if clean_text(line)]
        for index, line in enumerate(lines):
            following = lines[index + 1:index + 3]
            is_cantrip = (
                len(following) == 2
                and following[0].casefold().replace(" ", "") in schools
                and following[1].casefold() == "cantrip"
            )
            is_leveled_spell = (
                len(following) == 2
                and re.fullmatch(r"\d+(?:st|nd|rd|th)-+level", following[0].casefold()) is not None
                and following[1].casefold().replace(" ", "") in schools
            )
            if is_cantrip or is_leveled_spell:
                headings.setdefault(line, []).append(page_number)
    return headings


def validate_source_pages(pages: dict[str, int]) -> dict[str, int]:
    mismatches = {
        spell_id: (pages.get(spell_id), expected)
        for spell_id, expected in SOURCE_PAGE_SENTINELS.items()
        if pages.get(spell_id) != expected
    }
    if mismatches:
        raise RuntimeError(f"official SRD spell heading sentinel mismatch: {mismatches}")
    return pages


def official_heading_pages(pdf_path: Path, catalog: list[dict[str, object]]) -> dict[str, int]:
    if PAGE_CACHE_PATH.exists():
        cached = json.loads(PAGE_CACHE_PATH.read_text(encoding="utf-8"))
        if isinstance(cached, dict) and all(str(spell["id"]) in cached for spell in catalog):
            return validate_source_pages({str(spell["id"]): int(cached[str(spell["id"])]) for spell in catalog})
    if pymupdf is not None:
        document = pymupdf.open(pdf_path)
        page_lines = {
            page_number: document[page_number - 1].get_text().splitlines()
            for page_number in range(114, 205)
        }
        document.close()
    else:
        reader = PdfReader(str(pdf_path))
        page_lines = {
            page_number: (reader.pages[page_number - 1].extract_text() or "").splitlines()
            for page_number in range(114, 205)
        }
    headings = heading_name_pages(page_lines)
    result: dict[str, int] = {}
    for spell in catalog:
        pages = headings.get(clean_text(str(spell["englishName"])), [])
        if not pages:
            raise RuntimeError(f"official SRD heading not found: {spell['englishName']}")
        result[str(spell["id"])] = min(pages)
    PAGE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PAGE_CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return validate_source_pages(result)


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


def load_sources(catalog: list[dict[str, object]]) -> dict[str, dict[str, object]]:
    cache: dict[str, dict[str, object]] = {}
    if SOURCE_CACHE_PATH.exists():
        parsed = json.loads(SOURCE_CACHE_PATH.read_text(encoding="utf-8"))
        if isinstance(parsed, dict):
            cache = {str(key): value for key, value in parsed.items() if isinstance(value, dict)}
    for index, spell in enumerate(catalog, start=1):
        spell_id = str(spell["id"])
        if cache.get(spell_id):
            continue
        payload = request_json(f"{API_ROOT}/{urllib.parse.quote(spell_id)}")
        if not isinstance(payload, dict) or clean_text(str(payload.get("name", ""))).casefold() != clean_text(str(spell["englishName"])).casefold():
            raise RuntimeError(f"SRD mirror mismatch: {spell_id}")
        if int(payload.get("level", -1)) != spell["level"]:
            raise RuntimeError(f"SRD level mismatch: {spell_id}")
        school = payload.get("school")
        school_name = school.get("name") if isinstance(school, dict) else None
        if school_name not in SCHOOLS_ZH:
            raise RuntimeError(f"unknown spell school: {spell_id}")
        cache[spell_id] = {
            "level": spell["level"],
            "schoolEnglish": school_name,
            "ritual": bool(payload.get("ritual")),
            "castingTimeEnglish": str(payload.get("casting_time", "")),
            "rangeEnglish": str(payload.get("range", "")),
            "componentsEnglish": list(payload.get("components", [])),
            "materialEnglish": str(payload.get("material", "")),
            "durationEnglish": str(payload.get("duration", "")),
            "concentration": bool(payload.get("concentration")),
            "descriptionEnglish": "\n\n".join(str(value).strip() for value in payload.get("desc", []) if str(value).strip()),
            "higherLevelsEnglish": "\n\n".join(str(value).strip() for value in payload.get("higher_level", []) if str(value).strip()),
        }
        SOURCE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
        SOURCE_CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")
        print(f"source [{index}/{EXPECTED_COUNT}] {spell['englishName']}", flush=True)
        time.sleep(0.2)
    return cache


def read_reviewed() -> dict[str, dict[str, object]]:
    if not REVIEWED_PATH.exists():
        return {}
    parsed = json.loads(REVIEWED_PATH.read_text(encoding="utf-8"))
    if not isinstance(parsed, dict):
        raise RuntimeError(f"reviewed translation file must be an object: {REVIEWED_PATH}")
    return {str(key): value for key, value in parsed.items() if isinstance(value, dict)}


def write_workbook(catalog, sources, pages, reviewed) -> None:
    rows = []
    for spell in catalog:
        spell_id = str(spell["id"])
        existing = reviewed.get(spell_id, {})
        rows.append({
            **spell,
            "sourceBook": "SRD 5.1",
            "sourcePage": pages[spell_id],
            **sources[spell_id],
            "name": existing.get("name", ""),
            "school": existing.get("school", ""),
            "castingTime": existing.get("castingTime", ""),
            "range": existing.get("range", ""),
            "components": existing.get("components", ""),
            "duration": existing.get("duration", ""),
            "description": existing.get("description", ""),
            "higherLevels": existing.get("higherLevels", ""),
            "reviewedBy": existing.get("reviewedBy", ""),
            "reviewedAt": existing.get("reviewedAt", ""),
        })
    WORKBOOK_PATH.parent.mkdir(parents=True, exist_ok=True)
    WORKBOOK_PATH.write_text(json.dumps(rows, ensure_ascii=False, indent=2), encoding="utf-8")


def checked_records(catalog, sources, pages, reviewed, *, require_complete: bool) -> dict[str, dict[str, object]]:
    required = ("name", "school", "castingTime", "range", "components", "duration", "description", "reviewedBy", "reviewedAt")
    catalog_ids = {str(spell["id"]) for spell in catalog}
    unknown = sorted(set(reviewed) - catalog_ids)
    if unknown:
        raise RuntimeError(f"reviewed translations contain unknown IDs: {unknown}")
    incomplete = [
        str(spell["id"]) for spell in catalog if str(spell["id"]) in reviewed
        and any(not str(reviewed[str(spell["id"])].get(field, "")).strip() for field in required)
    ]
    if incomplete:
        raise RuntimeError(f"reviewed spell translations have incomplete fields: {incomplete}")
    missing = [str(spell["id"]) for spell in catalog if str(spell["id"]) not in reviewed]
    if require_complete and missing:
        raise RuntimeError(
            f"{len(missing)} spell translations still need contextual review; complete {REVIEWED_PATH} "
            f"using {WORKBOOK_PATH} before --emit"
        )
    records = {}
    for spell in catalog:
        spell_id = str(spell["id"])
        if spell_id not in reviewed:
            continue
        translation = reviewed[spell_id]
        source = sources[spell_id]
        records[spell_id] = {
            "level": spell["level"], "school": translation["school"], "ritual": source["ritual"],
            "castingTime": translation["castingTime"], "range": translation["range"],
            "components": translation["components"], "duration": translation["duration"],
            "description": translation["description"],
            **({"higherLevels": translation["higherLevels"]} if str(translation.get("higherLevels", "")).strip() else {}),
            "sourceName": translation["name"], "sourceEnglishName": spell["englishName"], "sourcePage": pages[spell_id],
        }
    return records


def render(records: dict[str, dict[str, object]], pdf_sha256: str) -> None:
    lines = [
        "// Generated by scripts/generate-srd-spell-translations.py from context-reviewed translations.",
        "// Source: Wizards of the Coast SRD 5.1, CC BY 4.0. Do not hand-edit.", "",
        'export type Dnd5eSpellSchoolZh = "防护" | "咒法" | "预言" | "附魔" | "塑能" | "幻术" | "死灵" | "变化"', "",
        "export interface Dnd5eSrdSpellDescriptionZh {", "  level: number", "  school: Dnd5eSpellSchoolZh",
        "  ritual: boolean", "  castingTime: string", "  range: string", "  components: string", "  duration: string",
        "  description: string", "  higherLevels?: string", "  sourceName: string", "  sourceEnglishName: string",
        "  sourcePage: number", "}", "", f"export const DND5E_SRD_SPELL_DESCRIPTIONS_ZH_SHA256 = {json.dumps(pdf_sha256)}", "",
        "export const DND5E_SRD_SPELL_DESCRIPTIONS_ZH: Readonly<Record<string, Dnd5eSrdSpellDescriptionZh>> = "
        + json.dumps(records, ensure_ascii=False, indent=2), "",
    ]
    OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")


def render_reviewed(records: dict[str, dict[str, object]]) -> None:
    lines = [
        "// Generated by scripts/generate-srd-spell-translations.py from context-reviewed translations.",
        "// Source: Wizards of the Coast SRD 5.1, CC BY 4.0. Do not hand-edit.", "",
        "import type { Dnd5eSrdSpellDescriptionZh } from './spellDescriptionsZh.generated'", "",
        "export const DND5E_SRD_SPELL_DESCRIPTIONS_ZH_REVIEWED:",
        "  Readonly<Partial<Record<string, Dnd5eSrdSpellDescriptionZh>>> = "
        + json.dumps(records, ensure_ascii=False, indent=2), "",
    ]
    REVIEWED_OUTPUT_PATH.write_text("\n".join(lines), encoding="utf-8")


def main() -> None:
    if len(sys.argv) not in (2, 3) or (len(sys.argv) == 3 and sys.argv[2] not in ("--emit", "--emit-reviewed")):
        raise SystemExit("usage: generate-srd-spell-translations.py <official-srd-5.1.pdf> [--emit|--emit-reviewed]")
    pdf_path = Path(sys.argv[1]).resolve()
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")
    catalog = read_catalog()
    pages = official_heading_pages(pdf_path, catalog)
    sources = load_sources(catalog)
    reviewed = read_reviewed()
    write_workbook(catalog, sources, pages, reviewed)
    print(f"wrote review workbook: {WORKBOOK_PATH}")
    if len(sys.argv) == 3 and sys.argv[2] == "--emit":
        render(checked_records(catalog, sources, pages, reviewed, require_complete=True), hashlib.sha256(pdf_path.read_bytes()).hexdigest())
        print(f"wrote {OUTPUT_PATH} ({EXPECTED_COUNT} context-reviewed entries)")
    elif len(sys.argv) == 3:
        records = checked_records(catalog, sources, pages, reviewed, require_complete=False)
        render_reviewed(records)
        print(f"wrote {REVIEWED_OUTPUT_PATH} ({len(records)} context-reviewed entries)")


if __name__ == "__main__":
    main()
