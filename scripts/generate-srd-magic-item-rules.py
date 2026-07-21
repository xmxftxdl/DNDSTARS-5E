"""Generate the Chinese SRD 5.1 magic-item rule-text catalog.

The checked-in magic-item catalog is the allow-list. English rule text is loaded
from the structured 2014 SRD API mirror and every heading is verified against the
official Wizards SRD 5.1 CC BY 4.0 PDF before output is emitted.

Usage:
  python scripts/generate-srd-magic-item-rules.py <official-srd-5.1.pdf>
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
CACHE_PATH = ROOT / "tmp/srd-magic-item-rules-cache.json"
PAGE_CACHE_PATH = ROOT / "tmp/srd-magic-item-source-pages.json"
API_ROOT = "https://www.dnd5eapi.co/api/2014/magic-items"
LINGVA_URL = "https://lingva.ml/api/v1/en/zh"
EXPECTED_COUNT = 240

MANUAL_TRANSLATIONS = {
    "amulet-of-health": "着装这枚护符期间，你的体质值变为 19。如果你的体质值已经达到 19 或更高，则该护符对你不起作用。",
    "belt-of-giant-strength": "佩戴此腰带时，你的力量属性值变为腰带所对应的数值。如果你的力量已经等于或高于该数值，腰带对你没有效果。\n\n山丘巨人：力量 21，稀有。\n石巨人／冰霜巨人：力量 23，极稀有。\n火巨人：力量 25，极稀有。\n云巨人：力量 27，传奇。\n风暴巨人：力量 29，传奇。\n\n石巨人腰带与冰霜巨人腰带外观不同，但规则效果相同。",
    "ring-of-feather-falling": "着装这枚戒指期间，你在坠落时每轮下降 60 尺，并且不会受到坠落伤害。",
    "ring-of-mind-shielding": "佩戴这枚戒指时，你免疫允许其他生物以魔法读取你的思想、判定你是否说谎，或获知你的阵营与生物类型的效果。只有在你允许时，其他生物才能与你进行心灵感应通讯。\n\n你可以使用一个动作令戒指隐形；再次使用一个动作、取下戒指或死亡时，戒指恢复可见。\n\n如果你佩戴戒指时死亡，且戒指内尚无灵魂，你的灵魂会进入戒指。你可以留在其中，也可以前往来世。灵魂留在戒指中时，可与任何佩戴者进行心灵感应通讯，佩戴者无法阻止该通讯。",
    "ring-of-resistance": "佩戴此戒指时，你对一种伤害类型具有抗性。戒指上的宝石表明对应类型，由 DM 选择或随机决定：\n1 酸蚀—珍珠\n2 冰冷—碧玺\n3 火焰—石榴石\n4 力场—蓝宝石\n5 闪电—黄水晶\n6 坏死—黑玉\n7 毒素—紫水晶\n8 心灵—翡翠\n9 光耀—黄玉\n10 雷鸣—尖晶石。",
    "shield": "持用该盾牌期间，你的 AC 获得由盾牌稀有度决定的加值。此加值叠加在盾牌通常提供的 AC 加值之上。",
    "wand-of-web": "这根魔杖有 7 点充能。持用它时，你可以使用一个动作并消耗 1 点充能，从魔杖中施放蛛网术（法术豁免 DC 15）。\n\n魔杖每日黎明恢复 1d6 + 1 点已消耗的充能。当你消耗最后 1 点充能时，投掷 d20；若结果为 1，魔杖碎成灰烬并被摧毁。",
}

MANUAL_ENGLISH_RULES = {
    "shield": "While holding this shield, you have a bonus to AC determined by the shield's rarity. This bonus is in addition to the shield's normal bonus to AC.",
}

TERM_REPLACEMENTS = (
    ("英尺", "尺"),
    ("脚半径", "尺半径"),
    ("调谐", "同调"),
    ("协调", "同调"),
    ("奖励动作", "附赠动作"),
    ("奖励行动", "附赠动作"),
    ("反应动作", "反应"),
    ("生命点数", "生命值"),
    ("生命点", "生命值"),
    ("命中点", "生命值"),
    ("豁免检定", "豁免"),
    ("能力检查", "属性检定"),
    ("游戏管理员", "DM"),
    ("总经理", "DM"),
)


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
        page = next((page for page, text in pages.items() if heading in text), None)
        if page is None:
            raise RuntimeError(f"official SRD heading not found: {item['englishName']}")
        result[item["id"]] = page
    PAGE_CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    PAGE_CACHE_PATH.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    return result


def request_json(
    url: str,
    data: dict[str, str] | None = None,
    json_data: dict[str, object] | None = None,
    retry_429: bool = False,
) -> object:
    encoded = (
        json.dumps(json_data).encode("utf-8")
        if json_data is not None
        else urllib.parse.urlencode(data).encode("utf-8") if data else None
    )
    headers = {"User-Agent": "DNDSTARS-5E SRD importer"}
    if json_data is not None:
        headers["Content-Type"] = "application/json"
    request = urllib.request.Request(url, data=encoded, headers=headers)
    last_error: Exception | None = None
    for attempt in range(10 if retry_429 else 5):
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                return json.loads(response.read().decode("utf-8"))
        except (urllib.error.URLError, TimeoutError) as error:
            last_error = error
            is_rate_limit = isinstance(error, urllib.error.HTTPError) and error.code == 429
            if isinstance(error, urllib.error.HTTPError) and 400 <= error.code < 500 and not is_rate_limit:
                break
            time.sleep((15 if retry_429 and is_rate_limit else 1.5) * (attempt + 1))
    raise RuntimeError(f"request failed: {url}") from last_error


def split_translation_chunks(text: str, maximum: int = 1400) -> list[str]:
    if len(text) <= maximum:
        return [text]
    chunks: list[str] = []
    current = ""
    for paragraph in text.split("\n\n"):
        pieces = [paragraph]
        if len(paragraph) > maximum:
            pieces = re.split(r"(?<=[.!?])\s+", paragraph)
        for piece in pieces:
            candidate = f"{current}\n\n{piece}" if current else piece
            if current and len(candidate) > maximum:
                chunks.append(current)
                current = piece
            else:
                current = candidate
    if current:
        chunks.append(current)
    return chunks


def translate_chunk(text: str) -> str:
    payload = request_json(
        f"{LINGVA_URL.rsplit('/api/', 1)[0]}/api/graphql",
        json_data={
            "query": "query Translate($query: String!) { translation(source: \"en\", target: \"zh\", query: $query) { target { text } } }",
            "variables": {"query": text},
        },
        retry_429=True,
    )
    if isinstance(payload, dict):
        translated = payload.get("data", {})
        if isinstance(translated, dict):
            translated = translated.get("translation", {})
        if isinstance(translated, dict):
            translated = translated.get("target", {})
        if isinstance(translated, dict) and isinstance(translated.get("text"), str):
            return str(translated["text"])
    raise RuntimeError("unexpected translation response")


def normalize_translation(value: str) -> str:
    result = value.strip()
    for before, after in TERM_REPLACEMENTS:
        result = result.replace(before, after)
    # Lingva occasionally translates the SRD resource term "charge" as a fee,
    # electric charge, or generic energy. Keep monetary/material costs intact by
    # only rewriting the forms that appear in magic-item resource sentences.
    result = result.replace("GM", "DM")
    result = result.replace("工作人员", "法杖")
    result = result.replace("项指控", "点充能")
    result = result.replace("次指控", "点充能")
    result = result.replace("以下物业", "以下属性")
    result = result.replace("电荷", "充能")
    result = re.sub(r"(有|拥有)\s*(\d+(?:d\d+)?)\s*个费用", r"\1 \2 点充能", result)
    result = re.sub(r"(\d+(?:d\d+)?(?:\s*(?:到|至|-|～)\s*\d+)?)\s*(?:个|点|次|枚)费用", r"\1 点充能", result)
    result = re.sub(r"消耗(?:其|它的|戒指的|法杖的)?\s*(\d+(?:d\d+)?(?:\s*(?:到|至|-|～)\s*\d+)?)\s*(?:个|点|枚)?能量", r"消耗 \1 点充能", result)
    result = re.sub(r"消耗\s*(\d+(?:d\d+)?)\s*点电量", r"消耗 \1 点充能", result)
    result = re.sub(r"恢复\s*(\d+(?:d\d+)?(?:\s*[+＋]\s*\d+)?)\s*(?:点)?消耗的(?:能量|费用|充能)", r"恢复 \1 点已消耗的充能", result)
    result = re.sub(r"恢复\s*(\d+(?:d\d+)?(?:\s*[+＋]\s*\d+)?)\s*\n+\s*每天黎明时消耗费用", r"每天黎明时恢复 \1 点已消耗的充能", result)
    result = re.sub(r"每天黎明时恢复\s*(\d+(?:d\d+)?(?:\s*[+＋]\s*\d+)?)\s*消耗费用", r"每天黎明时恢复 \1 点已消耗的充能", result)
    result = result.replace("最后一次能量", "最后 1 点充能")
    result = result.replace("最后一个充能", "最后 1 点充能")
    result = result.replace("最后一次费用", "最后 1 点充能")
    result = result.replace("所有费用", "所有充能")
    result = result.replace("必要的费用", "必要的充能")
    result = result.replace("每次消耗的费用", "每消耗 1 点充能")
    result = result.replace("法杖费用", "法杖充能")
    result = result.replace("部分能量", "部分充能")
    result = result.replace("不消耗费用", "不消耗充能")
    result = result.replace("无需使用任何费用", "不消耗充能")
    result = result.replace("不使用任何费用", "不消耗充能")
    result = result.replace("每花费额外的费用", "每额外消耗 1 点充能")
    result = result.replace("每花费一笔额外费用", "每额外消耗 1 点充能")
    result = result.replace("消耗的充能", "已消耗的充能")
    result = result.replace("已已消耗的充能", "已消耗的充能")
    # The inventory UI renders plain text, so strip Markdown-only decoration
    # while retaining paragraph and table content in a readable form.
    result = re.sub(r"\*{1,3}([^*\n]+?)\*{1,3}", r"\1", result)
    result = re.sub(r"^\s*\|?(?:\s*:?-{3,}:?\s*\|)+\s*$", "", result, flags=re.M)
    result = re.sub(r"^\s*\|\s*(.*?)\s*\|\s*$", lambda match: " ｜ ".join(
        cell.strip() for cell in match.group(1).split("|")
    ), result, flags=re.M)
    result = re.sub(r"(?<=\d)\s*英里", " 里", result)
    result = re.sub(r"(\d+)\s*岁(?=或更高|或以上|以上)", r"\1", result)
    result = re.sub(r"[ \t]+\n", "\n", result)
    result = re.sub(r"\n{3,}", "\n\n", result)
    return result


def translate_rule(item_id: str, english: str) -> str:
    if item_id in MANUAL_TRANSLATIONS:
        return MANUAL_TRANSLATIONS[item_id]
    translated = "\n\n".join(translate_chunk(chunk) for chunk in split_translation_chunks(english))
    return normalize_translation(translated)


def load_cache() -> dict[str, dict[str, object]]:
    if not CACHE_PATH.exists():
        return {}
    parsed = json.loads(CACHE_PATH.read_text(encoding="utf-8"))
    return parsed if isinstance(parsed, dict) else {}


def save_cache(cache: dict[str, dict[str, object]]) -> None:
    CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    CACHE_PATH.write_text(json.dumps(cache, ensure_ascii=False, indent=2), encoding="utf-8")


def render(catalog: list[dict[str, str]], records: dict[str, dict[str, object]], pdf_sha256: str) -> None:
    lines = [
        "// Generated by scripts/generate-srd-magic-item-rules.py.",
        "// Source: Wizards of the Coast SRD 5.1, CC BY 4.0. Do not hand-edit.",
        "",
        "export interface Dnd5eSrdMagicItemRuleTextZh {",
        "  rulesText: string",
        "  sourcePage: number",
        "}",
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


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: generate-srd-magic-item-rules.py <official-srd-5.1.pdf>")
    pdf_path = Path(sys.argv[1]).resolve()
    if not pdf_path.exists():
        raise SystemExit(f"PDF not found: {pdf_path}")
    catalog = read_catalog()
    pages = official_heading_pages(pdf_path, catalog)
    cache = load_cache()
    for index, item in enumerate(catalog, start=1):
        cached = cache.get(item["id"])
        if cached and cached.get("englishName") == item["englishName"] and cached.get("rulesText"):
            cached["sourcePage"] = pages[item["id"]]
            cached["rulesText"] = (
                MANUAL_TRANSLATIONS[item["id"]]
                if item["id"] in MANUAL_TRANSLATIONS
                else normalize_translation(str(cached["rulesText"]))
            )
            continue
        english = MANUAL_ENGLISH_RULES.get(item["id"])
        if english is None:
            payload = request_json(f"{API_ROOT}/{urllib.parse.quote(item['id'])}")
            if not isinstance(payload, dict) or payload.get("name") != item["englishName"]:
                raise RuntimeError(f"SRD mirror mismatch: {item['id']}")
            description = payload.get("desc")
            if not isinstance(description, list) or len(description) < 2:
                raise RuntimeError(f"missing SRD body: {item['id']}")
            english = "\n\n".join(str(line).strip() for line in description[1:] if str(line).strip())
        cache[item["id"]] = {
            "englishName": item["englishName"],
            "sourceEnglishText": english,
            "rulesText": translate_rule(item["id"], english),
            "sourcePage": pages[item["id"]],
        }
        save_cache(cache)
        print(f"[{index}/{EXPECTED_COUNT}] {item['englishName']}", flush=True)
        time.sleep(0.75)
    missing = [item["id"] for item in catalog if item["id"] not in cache]
    if missing:
        raise RuntimeError(f"missing generated records: {missing}")
    pdf_sha256 = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    render(catalog, cache, pdf_sha256)
    print(f"wrote {OUTPUT_PATH} ({EXPECTED_COUNT} entries)")


if __name__ == "__main__":
    main()
