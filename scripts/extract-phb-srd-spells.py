"""Extract only SRD 5.1 spell entries from the user's Chinese PHB reference.

Usage:
  python scripts/extract-phb-srd-spells.py <input.pdf> [output.ts]

The checked-in catalog remains the allow-list. A PDF entry is emitted only
when its normalized English heading maps to one of those 319 IDs and its spell
level agrees with the SRD catalog.
"""

from __future__ import annotations

import hashlib
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
CATALOG_PATH = ROOT / "src/rulesets/dnd5e/spellCatalog.ts"
DEFAULT_OUTPUT = ROOT / "src/rulesets/dnd5e/spellDescriptionsZh.generated.ts"
FIRST_SPELL_PAGE = 211
LAST_SPELL_PAGE = 289
SCHOOLS = ("防护", "咒法", "预言", "附魔", "塑能", "幻术", "死灵", "变化")
FIELD_LABELS = ("施法时间", "施法距离", "法术成分", "持续时间")
SRD_TO_PHB_ALIASES = {
    "acidarrow": "melfsacidarrow",
    "arcanehand": "bigbyshand",
    "arcanistsmagicaura": "nystulsmagicaura",
    "arcanesword": "mordenkainenssword",
    "heroesfeast": "herosfeast",
}


def normalized_english(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", value.lower().replace("’", "'"))


def read_catalog() -> list[dict[str, object]]:
    source = CATALOG_PATH.read_text(encoding="utf-8")
    match = re.search(r"RAW_SRD_5_1_SPELL_CATALOG = `\n(.*?)\n`", source, re.S)
    if not match:
        raise RuntimeError("cannot find RAW_SRD_5_1_SPELL_CATALOG")
    result: list[dict[str, object]] = []
    for row in match.group(1).splitlines():
        if not row.strip():
            continue
        spell_id, english_name, level, classes = row.split("|")
        result.append({
            "id": spell_id,
            "englishName": english_name,
            "level": int(level),
            "classes": classes.split(","),
        })
    if len(result) != 319:
        raise RuntimeError(f"expected 319 SRD spells, got {len(result)}")
    return result


def flattened_pdf_lines(pdf_path: Path) -> list[dict[str, object]]:
    reader = PdfReader(str(pdf_path))
    if len(reader.pages) < LAST_SPELL_PAGE:
        raise RuntimeError(f"PDF has only {len(reader.pages)} pages")
    result: list[dict[str, object]] = []
    for page_number in range(FIRST_SPELL_PAGE, LAST_SPELL_PAGE + 1):
        text = reader.pages[page_number - 1].extract_text() or ""
        for raw in text.splitlines():
            if raw.strip() == str(page_number):
                continue
            result.append({
                "raw": raw.rstrip(),
                "text": " ".join(raw.strip().split()),
                "page": page_number,
            })
    return result


def detected_headings(lines: list[dict[str, object]]) -> list[dict[str, object]]:
    schools = "|".join(SCHOOLS)
    metadata = re.compile(
        rf"^(?:(?P<level>[0-9]+)\s*[环级]\s+(?P<school>{schools})|"
        rf"(?P<school2>{schools})\s+(?P<cantrip>戏法))(?:（仪式）)?$"
    )
    headings: list[dict[str, object]] = []
    for index, line in enumerate(lines):
        text = str(line["text"])
        match = metadata.match(text)
        if not match:
            continue
        title_index = index - 1
        while title_index >= 0 and not lines[title_index]["text"]:
            title_index -= 1
        title = str(lines[title_index]["text"])
        title_match = re.match(r"^(.+?[\u3400-\u9fff术斩）])\s+([A-Za-z].+)$", title)
        if not title_match:
            raise RuntimeError(f"cannot parse spell title on PDF page {line['page']}: {title!r}")
        headings.append({
            "titleIndex": title_index,
            "metadataIndex": index,
            "sourceName": title_match.group(1),
            "sourceEnglishName": title_match.group(2),
            "sourcePage": int(line["page"]),
            "level": 0 if match.group("cantrip") else int(match.group("level")),
            "school": match.group("school") or match.group("school2"),
            "ritual": "（仪式）" in text,
        })
    return headings


def field_index(block: list[dict[str, object]], label: str) -> int | None:
    return next((
        index for index, line in enumerate(block)
        if str(line["text"]).startswith(f"{label}：") or str(line["text"]).startswith(f"{label}；")
    ), None)


def field_value(block: list[dict[str, object]], start: int, end: int) -> str:
    first = re.split(r"[：；]", str(block[start]["text"]), maxsplit=1)[1]
    continuation = [str(line["text"]) for line in block[start + 1:end] if line["text"]]
    return "".join([first, *continuation]).strip()


def join_description(lines: list[dict[str, object]]) -> str:
    paragraphs: list[str] = []
    current = ""
    for line in lines:
        text = str(line["text"])
        if not text:
            continue
        raw = str(line["raw"])
        starts_paragraph = bool(raw[:1].isspace()) or text.startswith("•")
        if starts_paragraph and current:
            paragraphs.append(current.strip())
            current = ""
        if current:
            previous = current[-1:]
            following = text[:1]
            separator = " " if (
                re.match(r"[A-Za-z0-9%)]", previous)
                and re.match(r"[A-Za-z0-9(]", following)
            ) else ""
            current += separator + text
        else:
            current = text
    if current:
        paragraphs.append(current.strip())
    return "\n\n".join(paragraphs)


def split_higher_levels(description: str) -> tuple[str, str | None]:
    marker = description.find("升环施法")
    if marker < 0:
        return description, None
    return description[:marker].rstrip(), description[marker:].strip()


def extract(pdf_path: Path) -> dict[str, dict[str, object]]:
    catalog = read_catalog()
    lines = flattened_pdf_lines(pdf_path)
    headings = detected_headings(lines)
    by_english = {normalized_english(str(item["sourceEnglishName"])): item for item in headings}
    ordered_headings = sorted(headings, key=lambda item: int(item["titleIndex"]))
    next_title = {
        int(item["titleIndex"]): (
            int(ordered_headings[index + 1]["titleIndex"])
            if index + 1 < len(ordered_headings)
            else len(lines)
        )
        for index, item in enumerate(ordered_headings)
    }

    records: dict[str, dict[str, object]] = {}
    for spell in catalog:
        english_key = normalized_english(str(spell["englishName"]))
        source_key = english_key if english_key in by_english else SRD_TO_PHB_ALIASES.get(english_key, english_key)
        if source_key not in by_english:
            suffixes = [key for key in by_english if key.endswith(english_key)]
            if len(suffixes) == 1:
                source_key = suffixes[0]
        heading = by_english.get(source_key)
        if not heading:
            raise RuntimeError(f"missing PHB entry for {spell['id']} ({spell['englishName']})")
        if int(heading["level"]) != int(spell["level"]):
            raise RuntimeError(
                f"level mismatch for {spell['id']}: SRD {spell['level']} vs PDF {heading['level']}"
            )

        block = lines[int(heading["metadataIndex"]) + 1:next_title[int(heading["titleIndex"])]]
        indexes = {label: field_index(block, label) for label in FIELD_LABELS}
        if any(index is None for index in indexes.values()):
            raise RuntimeError(f"missing metadata for {spell['id']}: {indexes}")
        typed_indexes = {label: int(indexes[label]) for label in FIELD_LABELS}
        description_start = next((
            index for index in range(typed_indexes["持续时间"] + 1, len(block))
            if block[index]["text"]
        ), None)
        if description_start is None:
            raise RuntimeError(f"missing description for {spell['id']}")

        values: dict[str, str] = {}
        for index, label in enumerate(FIELD_LABELS):
            end = (
                typed_indexes[FIELD_LABELS[index + 1]]
                if index + 1 < len(FIELD_LABELS)
                else description_start
            )
            values[label] = field_value(block, typed_indexes[label], end)
        full_description = join_description(block[description_start:])
        description, higher_levels = split_higher_levels(full_description)
        if not description:
            raise RuntimeError(f"empty description for {spell['id']}")

        records[str(spell["id"])] = {
            "level": int(spell["level"]),
            "school": heading["school"],
            "ritual": bool(heading["ritual"]),
            "castingTime": values["施法时间"],
            "range": values["施法距离"],
            "components": values["法术成分"],
            "duration": values["持续时间"],
            "description": description,
            **({"higherLevels": higher_levels} if higher_levels else {}),
            "sourceName": heading["sourceName"],
            "sourceEnglishName": heading["sourceEnglishName"],
            "sourcePage": heading["sourcePage"],
        }

    if len(records) != 319:
        raise RuntimeError(f"expected 319 matched descriptions, got {len(records)}")
    return records


def generated_source(records: dict[str, dict[str, object]], pdf_path: Path) -> str:
    serialized = json.dumps(records, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    digest = hashlib.sha256(serialized.encode("utf-8")).hexdigest()
    pretty = json.dumps(records, ensure_ascii=False, indent=2)
    return f"""// Generated by scripts/extract-phb-srd-spells.py from {pdf_path.name}.
// Do not hand-edit. The SRD catalog is the allow-list; exactly 319 entries are emitted.

export type Dnd5eSpellSchoolZh = {' | '.join(json.dumps(value, ensure_ascii=False) for value in SCHOOLS)}

export interface Dnd5eSrdSpellDescriptionZh {{
  level: number
  school: Dnd5eSpellSchoolZh
  ritual: boolean
  castingTime: string
  range: string
  components: string
  duration: string
  description: string
  higherLevels?: string
  sourceName: string
  sourceEnglishName: string
  sourcePage: number
}}

export const DND5E_SRD_SPELL_DESCRIPTIONS_ZH_SHA256 = {json.dumps(digest)}

export const DND5E_SRD_SPELL_DESCRIPTIONS_ZH: Readonly<Record<string, Dnd5eSrdSpellDescriptionZh>> = {pretty}
"""


def main() -> None:
    if len(sys.argv) < 2:
        raise SystemExit("usage: extract-phb-srd-spells.py <input.pdf> [output.ts]")
    pdf_path = Path(sys.argv[1]).expanduser().resolve()
    output_path = Path(sys.argv[2]).expanduser().resolve() if len(sys.argv) > 2 else DEFAULT_OUTPUT
    records = extract(pdf_path)
    output_path.write_text(generated_source(records, pdf_path), encoding="utf-8", newline="\n")
    print(f"generated {len(records)} SRD spell descriptions -> {output_path}")


if __name__ == "__main__":
    main()
