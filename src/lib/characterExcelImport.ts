import { Unzip, UnzipInflate } from 'fflate'
import { SKILLS, type AbilityKey } from './dnd'
import { dnd5eClassDefinition } from '../rulesets/dnd5e/classes'
import { dnd5eSpellbookEntries } from '../rulesets/dnd5e/spellbook'
import {
  dnd5ePluginBackgroundDefinition,
  dnd5ePluginRaceDefinition,
  registeredDnd5ePluginSubclasses,
} from '../rulesets/dnd5e/pluginApi'
import type { Abilities, Character } from '../types/character'

export const CHARACTER_EXCEL_MAX_SOURCE_BYTES = 20 * 1024 * 1024
const CHARACTER_EXCEL_MAX_UNCOMPRESSED_BYTES = 64 * 1024 * 1024
const CHARACTER_EXCEL_MAX_ENTRY_BYTES = 16 * 1024 * 1024
const CHARACTER_EXCEL_MAX_ENTRIES = 2_000
const CHARACTER_EXCEL_MAX_SHEETS = 64
const CHARACTER_EXCEL_MAX_CELLS = 120_000
const CHARACTER_EXCEL_MAX_IMAGES = 8

export type CharacterExcelCellValue = string | number | boolean

export interface CharacterExcelCell {
  ref: string
  row: number
  column: number
  value: CharacterExcelCellValue
  formula?: string
}

export interface CharacterExcelSheet {
  name: string
  cells: Record<string, CharacterExcelCell>
}

export interface CharacterExcelImage {
  id: string
  fileName: string
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp'
  bytes: Uint8Array
}

export interface CharacterExcelWorkbook {
  fileName: string
  sheets: CharacterExcelSheet[]
  images: CharacterExcelImage[]
}

export type CharacterExcelConfidence = 'high' | 'medium' | 'low'

export interface CharacterExcelImportFieldSource {
  field: string
  label: string
  value: string
  sheet: string
  cell: string
  confidence: CharacterExcelConfidence
}

export interface CharacterExcelImportDraft {
  schemaVersion: 1
  sourceFileName: string
  character: Partial<Character>
  fieldSources: CharacterExcelImportFieldSource[]
  detectedSpellNames: string[]
  importedSpellNames: string[]
  unrecognizedSpellNames: string[]
  detectedFeatureNames: string[]
  warnings: string[]
  workbookSummary: {
    sheetNames: string[]
    populatedCellCount: number
    imageCount: number
    recognizedTemplate?: string
  }
}

export class CharacterExcelImportError extends Error {
  readonly code: string

  constructor(code: string, message: string) {
    super(message)
    this.name = 'CharacterExcelImportError'
    this.code = code
  }
}

function normalizeZipPath(path: string): string {
  const result: string[] = []
  for (const segment of path.replaceAll('\\', '/').split('/')) {
    if (!segment || segment === '.') continue
    if (segment === '..') result.pop()
    else result.push(segment)
  }
  return result.join('/')
}

function retainedWorkbookEntry(name: string): boolean {
  const normalized = normalizeZipPath(name)
  return normalized === 'xl/workbook.xml' ||
    normalized === 'xl/_rels/workbook.xml.rels' ||
    normalized === 'xl/sharedStrings.xml' ||
    /^xl\/worksheets\/[^/]+\.xml$/i.test(normalized) ||
    /^xl\/media\/[^/]+\.(png|jpe?g|webp)$/i.test(normalized)
}

async function unzipWorkbook(bytes: Uint8Array): Promise<Map<string, Uint8Array>> {
  return await new Promise((resolve, reject) => {
    const entries = new Map<string, Uint8Array>()
    let archiveFinished = false
    let pending = 0
    let entryCount = 0
    let declaredBytes = 0
    let actualBytes = 0
    let settled = false

    const fail = (error: unknown) => {
      if (settled) return
      settled = true
      reject(error instanceof Error ? error : new Error(String(error)))
    }
    const finish = () => {
      if (!settled && archiveFinished && pending === 0) {
        settled = true
        resolve(entries)
      }
    }

    const unzip = new Unzip((file) => {
      if (settled) return
      entryCount += 1
      if (entryCount > CHARACTER_EXCEL_MAX_ENTRIES) {
        fail(new CharacterExcelImportError('archive-entry-limit', 'Excel 文件包含过多内部条目。'))
        return
      }
      const originalSize = Math.max(0, Number(file.originalSize ?? 0) || 0)
      declaredBytes += originalSize
      if (originalSize > CHARACTER_EXCEL_MAX_ENTRY_BYTES || declaredBytes > CHARACTER_EXCEL_MAX_UNCOMPRESSED_BYTES) {
        fail(new CharacterExcelImportError('archive-size-limit', 'Excel 解压后的内容过大，已停止读取。'))
        return
      }
      const entryName = normalizeZipPath(file.name)
      if (!retainedWorkbookEntry(entryName)) return

      pending += 1
      const chunks: Uint8Array[] = []
      let entryBytes = 0
      file.ondata = (error, chunk, final) => {
        if (settled) return
        if (error) {
          fail(error)
          return
        }
        entryBytes += chunk.length
        actualBytes += chunk.length
        if (entryBytes > CHARACTER_EXCEL_MAX_ENTRY_BYTES || actualBytes > CHARACTER_EXCEL_MAX_UNCOMPRESSED_BYTES) {
          file.terminate()
          fail(new CharacterExcelImportError('archive-size-limit', 'Excel 解压后的内容过大，已停止读取。'))
          return
        }
        if (chunk.length) chunks.push(chunk)
        if (!final) return
        const joined = new Uint8Array(entryBytes)
        let offset = 0
        for (const part of chunks) {
          joined.set(part, offset)
          offset += part.length
        }
        entries.set(entryName, joined)
        pending -= 1
        finish()
      }
      try {
        file.start()
      } catch (error) {
        fail(error)
      }
    })
    unzip.register(UnzipInflate)
    try {
      unzip.push(bytes, true)
      archiveFinished = true
      finish()
    } catch (error) {
      fail(error)
    }
  })
}

function decodeXmlText(value: string): string {
  return value
    .replaceAll('&lt;', '<')
    .replaceAll('&gt;', '>')
    .replaceAll('&quot;', '"')
    .replaceAll('&apos;', "'")
    .replace(/&#x([0-9a-f]+);/gi, (_match, hex: string) => String.fromCodePoint(Number.parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_match, decimal: string) => String.fromCodePoint(Number.parseInt(decimal, 10)))
    .replaceAll('&amp;', '&')
}

function xmlAttribute(tag: string, name: string): string | undefined {
  const escapedName = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const match = tag.match(new RegExp(`(?:^|\\s)${escapedName}="([^"]*)"`))
  return match ? decodeXmlText(match[1]) : undefined
}

function textEntry(entries: Map<string, Uint8Array>, path: string): string {
  const bytes = entries.get(path)
  if (!bytes) throw new CharacterExcelImportError('missing-workbook-part', `Excel 缺少必要内容：${path}`)
  return new TextDecoder().decode(bytes)
}

function parseSharedStrings(xml: string | undefined): string[] {
  if (!xml) return []
  return [...xml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>/gi)].map((match) =>
    [...match[1].matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
      .map((text) => decodeXmlText(text[1]))
      .join(''),
  )
}

function cellColumnIndex(ref: string): number {
  const letters = ref.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? 'A'
  let index = 0
  for (const letter of letters) index = index * 26 + letter.charCodeAt(0) - 64
  return index
}

function parseCellValue(cellTag: string, body: string, sharedStrings: readonly string[]): CharacterExcelCellValue | undefined {
  const type = xmlAttribute(cellTag, 't')
  if (type === 'inlineStr') {
    const value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/gi)]
      .map((match) => decodeXmlText(match[1]))
      .join('')
    return value || undefined
  }
  const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/i)?.[1]
  if (raw == null) return undefined
  const decoded = decodeXmlText(raw)
  if (type === 's') return sharedStrings[Number.parseInt(decoded, 10)] ?? ''
  if (type === 'b') return decoded === '1'
  if (type === 'str' || type === 'e') return decoded
  const numeric = Number(decoded)
  return Number.isFinite(numeric) ? numeric : decoded
}

function parseWorksheet(name: string, xml: string, sharedStrings: readonly string[]): CharacterExcelSheet {
  const cells: Record<string, CharacterExcelCell> = {}
  let cellCount = 0
  // Ignore style-only self-closing cells. Starting a block match at one of those
  // would otherwise consume the next valued cell and assign its value to the wrong address.
  for (const match of xml.matchAll(/<c\b(?![^>]*\/>)([^>]*)>([\s\S]*?)<\/c>/gi)) {
    const cellTag = `<c${match[1]}>`
    const ref = xmlAttribute(cellTag, 'r')?.toUpperCase()
    if (!ref || !/^[A-Z]+\d+$/.test(ref)) continue
    const value = parseCellValue(cellTag, match[2], sharedStrings)
    if (value == null || value === '') continue
    const row = Number.parseInt(ref.match(/\d+$/)?.[0] ?? '0', 10)
    if (!row || cellCount >= CHARACTER_EXCEL_MAX_CELLS) {
      if (cellCount >= CHARACTER_EXCEL_MAX_CELLS) {
        throw new CharacterExcelImportError('cell-limit', 'Excel 中的有效单元格过多。')
      }
      continue
    }
    const formula = match[2].match(/<f\b[^>]*>([\s\S]*?)<\/f>/i)?.[1]
    cells[ref] = {
      ref,
      row,
      column: cellColumnIndex(ref),
      value,
      ...(formula ? { formula: decodeXmlText(formula) } : {}),
    }
    cellCount += 1
  }
  return { name, cells }
}

function imageMimeType(path: string): CharacterExcelImage['mimeType'] | null {
  if (/\.png$/i.test(path)) return 'image/png'
  if (/\.jpe?g$/i.test(path)) return 'image/jpeg'
  if (/\.webp$/i.test(path)) return 'image/webp'
  return null
}

export async function parseCharacterExcelFile(file: File): Promise<CharacterExcelWorkbook> {
  if (!/\.(xlsx|xlsm)$/i.test(file.name)) {
    throw new CharacterExcelImportError('unsupported-extension', '当前支持 .xlsx 与 .xlsm；旧版 .xls 请先另存为 .xlsx。')
  }
  if (file.size <= 0) throw new CharacterExcelImportError('empty-file', 'Excel 文件为空。')
  if (file.size > CHARACTER_EXCEL_MAX_SOURCE_BYTES) {
    throw new CharacterExcelImportError('source-size-limit', 'Excel 文件不能超过 20 MB。')
  }

  const entries = await unzipWorkbook(new Uint8Array(await file.arrayBuffer()))
  const workbookXml = textEntry(entries, 'xl/workbook.xml')
  const relationsXml = textEntry(entries, 'xl/_rels/workbook.xml.rels')
  const sharedStringsBytes = entries.get('xl/sharedStrings.xml')
  const sharedStrings = parseSharedStrings(sharedStringsBytes ? new TextDecoder().decode(sharedStringsBytes) : undefined)
  const relations = new Map<string, string>()
  for (const match of relationsXml.matchAll(/<Relationship\b[^>]*\/>/gi)) {
    const id = xmlAttribute(match[0], 'Id')
    const target = xmlAttribute(match[0], 'Target')
    if (id && target) relations.set(id, normalizeZipPath(target.startsWith('/') ? target.slice(1) : `xl/${target}`))
  }

  const sheets: CharacterExcelSheet[] = []
  for (const match of workbookXml.matchAll(/<sheet\b[^>]*\/>/gi)) {
    if (sheets.length >= CHARACTER_EXCEL_MAX_SHEETS) {
      throw new CharacterExcelImportError('sheet-limit', 'Excel 工作表数量超过 64。')
    }
    const name = xmlAttribute(match[0], 'name')
    const relationId = xmlAttribute(match[0], 'r:id')
    const path = relationId ? relations.get(relationId) : undefined
    const sheetBytes = path ? entries.get(path) : undefined
    if (!name || !sheetBytes) continue
    sheets.push(parseWorksheet(name, new TextDecoder().decode(sheetBytes), sharedStrings))
  }
  if (!sheets.length) throw new CharacterExcelImportError('no-sheets', '没有读取到可用的 Excel 工作表。')

  const images = [...entries.entries()]
    .flatMap(([path, bytes]) => {
      const mimeType = imageMimeType(path)
      return mimeType ? [{ id: path, fileName: path.split('/').pop() ?? 'portrait', mimeType, bytes }] : []
    })
    .sort((left, right) => right.bytes.length - left.bytes.length)
    .slice(0, CHARACTER_EXCEL_MAX_IMAGES)

  return { fileName: file.name, sheets, images }
}

function cell(sheet: CharacterExcelSheet | undefined, ref: string): CharacterExcelCell | undefined {
  return sheet?.cells[ref.toUpperCase()]
}

function usableText(value: CharacterExcelCellValue | undefined): string | undefined {
  if (typeof value === 'boolean') return value ? '是' : '否'
  const text = String(value ?? '').trim()
  return text && !/^#(?:NAME\?|VALUE!|REF!|N\/A|DIV\/0!|NUM!|NULL!)$/i.test(text) ? text : undefined
}

function usableNumber(value: CharacterExcelCellValue | undefined, minimum: number, maximum: number): number | undefined {
  const parsed = typeof value === 'number' ? value : Number(String(value ?? '').replaceAll(',', '').trim())
  if (!Number.isFinite(parsed)) return undefined
  const rounded = Math.floor(parsed)
  return rounded >= minimum && rounded <= maximum ? rounded : undefined
}

interface LocatedExcelCell {
  sheet: CharacterExcelSheet
  cell: CharacterExcelCell
}

function locateCell(input: {
  workbook: CharacterExcelWorkbook
  preferredSheet?: CharacterExcelSheet
  directRef?: string
  labels: readonly string[]
  accepts: (value: CharacterExcelCellValue) => boolean
}): LocatedExcelCell | undefined {
  const direct = input.directRef ? cell(input.preferredSheet, input.directRef) : undefined
  if (input.preferredSheet && direct && input.accepts(direct.value)) return { sheet: input.preferredSheet, cell: direct }
  const labelNames = new Set(input.labels.map(normalizedName))
  const orderedSheets = [input.preferredSheet, ...input.workbook.sheets]
    .filter((sheet, index, sheets): sheet is CharacterExcelSheet => !!sheet && sheets.indexOf(sheet) === index)
  for (const sheet of orderedSheets) {
    const cells = Object.values(sheet.cells)
    for (const labelCell of cells) {
      const label = usableText(labelCell.value)
      if (!label || !labelNames.has(normalizedName(label))) continue
      const candidate = cells
        .filter((entry) => entry.row === labelCell.row && entry.column > labelCell.column && entry.column <= labelCell.column + 16)
        .sort((left, right) => left.column - right.column)
        .find((entry) => input.accepts(entry.value))
      if (candidate) return { sheet, cell: candidate }
    }
  }
  return undefined
}

function likelyCharacterSheet(sheets: readonly CharacterExcelSheet[]): CharacterExcelSheet {
  const preferred = sheets.find((sheet) => sheet.name.trim() === '主要')
  if (preferred) return preferred
  const identityLabels = new Set(['角色', '角色名', '姓名', '玩家', '职业', '种族', '等级'].map(normalizedName))
  return [...sheets].sort((left, right) => {
    const score = (sheet: CharacterExcelSheet) => Object.values(sheet.cells)
      .filter((entry) => {
        const text = usableText(entry.value)
        return !!text && identityLabels.has(normalizedName(text))
      }).length
    return score(right) - score(left)
  })[0]
}

function normalizedName(value: string): string {
  return value.trim().toLowerCase()
    .replace(/[\s·•・.。,:：;；'"“”‘’()（）【】_-]+/g, '')
    .replaceAll('[', '')
    .replaceAll(']', '')
}

function addSource(
  sources: CharacterExcelImportFieldSource[],
  field: string,
  label: string,
  sourceSheet: CharacterExcelSheet | undefined,
  sourceCell: CharacterExcelCell | undefined,
  confidence: CharacterExcelConfidence = 'high',
): void {
  const value = usableText(sourceCell?.value)
  if (!sourceSheet || !sourceCell || !value) return
  sources.push({ field, label, value, sheet: sourceSheet.name, cell: sourceCell.ref, confidence })
}

function valuesInRows(sheet: CharacterExcelSheet | undefined, minimumRow: number, maximumRow: number): string[] {
  if (!sheet) return []
  return Object.values(sheet.cells)
    .filter((entry) => entry.row >= minimumRow && entry.row <= maximumRow)
    .sort((left, right) => left.row - right.row || left.column - right.column)
    .flatMap((entry) => usableText(entry.value) ?? [])
}

function spellLookup(): Map<string, { id: string; name: string }> {
  const result = new Map<string, { id: string; name: string }>()
  for (const spell of dnd5eSpellbookEntries([])) {
    result.set(normalizedName(spell.name), { id: spell.id, name: spell.name })
    if (spell.englishName) result.set(normalizedName(spell.englishName), { id: spell.id, name: spell.name })
  }
  return result
}

function recognizedSpells(values: readonly string[]): Array<{ id: string; name: string }> {
  const lookup = spellLookup()
  const result = new Map<string, { id: string; name: string }>()
  for (const value of values) {
    const spell = lookup.get(normalizedName(value))
    if (spell) result.set(spell.id, spell)
  }
  return [...result.values()]
}

function skillIdsFromTexts(texts: readonly string[]): string[] {
  const selected = new Set<string>()
  for (const text of texts) {
    for (const skill of SKILLS) {
      if (text.includes(skill.label) && !/(选择|任选|自选|可选)/.test(text)) selected.add(skill.key)
    }
  }
  return [...selected]
}

function valuesBesideLabel(sheet: CharacterExcelSheet | undefined, label: string): string[] {
  if (!sheet) return []
  const labelRows = new Set(Object.values(sheet.cells)
    .filter((entry) => usableText(entry.value) === label)
    .map((entry) => entry.row))
  return Object.values(sheet.cells)
    .filter((entry) => labelRows.has(entry.row) && usableText(entry.value) !== label)
    .sort((left, right) => left.row - right.row || left.column - right.column)
    .flatMap((entry) => usableText(entry.value) ?? [])
}

function findFeatureNames(sheet: CharacterExcelSheet | undefined): string[] {
  if (!sheet) return []
  const names: string[] = []
  for (const entry of Object.values(sheet.cells)) {
    if (entry.row < 82 || entry.row > 130) continue
    const text = usableText(entry.value)
    if (!text || text.length > 40 || /^(次数|名称|描述|职业能力|种族特性|背景特性|特性)$/.test(text)) continue
    const next = Object.values(sheet.cells).find((candidate) =>
      candidate.row === entry.row && candidate.column > entry.column && candidate.column <= entry.column + 8 &&
      (usableText(candidate.value)?.length ?? 0) > 20)
    if (next) names.push(text)
  }
  return [...new Set(names)].slice(0, 80)
}

function inferSubclass(classId: string, name: string | undefined): string | undefined {
  if (!name) return undefined
  const normalized = normalizedName(name.replace(/学派$/, ''))
  const core = dnd5eClassDefinition(classId)?.subclass
  if (core && [core.id, core.name, core.name.replace(/学派$/, '')].some((value) => normalizedName(value) === normalized)) {
    return core.id
  }
  return registeredDnd5ePluginSubclasses(classId as Parameters<typeof registeredDnd5ePluginSubclasses>[0])
    .find((candidate) => [candidate.id, candidate.name, candidate.name.replace(/学派$/, '')]
      .some((value) => normalizedName(value) === normalized))?.id
}

function compactNotes(rows: Array<[string, string | undefined]>): string {
  return rows.flatMap(([label, value]) => value ? [`${label}：${value}`] : []).join('\n')
}

function importedAbilities(
  workbook: CharacterExcelWorkbook,
  sheet: CharacterExcelSheet | undefined,
): { abilities: Abilities; sources: Partial<Record<AbilityKey, LocatedExcelCell>> } {
  const refs: Record<AbilityKey, string> = { str: 'F14', dex: 'F15', con: 'F16', int: 'F17', wis: 'F18', cha: 'F19' }
  const labels: Record<AbilityKey, readonly string[]> = {
    str: ['力量', 'Strength', 'STR'], dex: ['敏捷', 'Dexterity', 'DEX'], con: ['体质', 'Constitution', 'CON'],
    int: ['智力', 'Intelligence', 'INT'], wis: ['感知', 'Wisdom', 'WIS'], cha: ['魅力', 'Charisma', 'CHA'],
  }
  const sources: Partial<Record<AbilityKey, LocatedExcelCell>> = {}
  const abilities = Object.fromEntries((Object.entries(refs) as Array<[AbilityKey, string]>).map(([key, ref]) => {
    const located = locateCell({
      workbook,
      preferredSheet: sheet,
      directRef: ref,
      labels: labels[key],
      accepts: (value) => usableNumber(value, 1, 30) != null,
    })
    if (located) sources[key] = located
    return [key, usableNumber(located?.cell.value, 1, 30) ?? 10]
  })) as Abilities
  return { abilities, sources }
}

export function buildCharacterExcelImportDraft(workbook: CharacterExcelWorkbook): CharacterExcelImportDraft {
  const main = likelyCharacterSheet(workbook.sheets)
  const backgroundSheet = workbook.sheets.find((sheet) => sheet.name.trim() === '背景')
  const spellbookSheet = workbook.sheets.find((sheet) => sheet.name.trim() === '法术书')
  const recognizedTemplate = main && Object.values(main.cells).some((entry) =>
    usableText(entry.value)?.includes('DND 5E 人物卡'))
    ? 'DND 5E 人物卡 New Edition'
    : undefined
  const fieldSources: CharacterExcelImportFieldSource[] = []
  const warnings: string[] = []
  const textValue = (value: CharacterExcelCellValue) => {
    const text = usableText(value)
    return !!text && text.length <= 200 && !/^[<>/=+-]+$/.test(text)
  }
  const nameSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'D3' : undefined, labels: ['角色', '角色名', '姓名', 'Character Name'], accepts: textValue })
  const playerSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'D4' : undefined, labels: ['玩家', '玩家名', 'Player Name'], accepts: textValue })
  const classSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'R4' : undefined, labels: ['职业', '主职', 'Class'], accepts: textValue })
  const subclassSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'V4' : undefined, labels: ['子职', '子职业', '学派', 'Subclass'], accepts: textValue })
  const levelSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'Y4' : undefined, labels: ['等级', '角色等级', 'Level'], accepts: (value) => usableNumber(value, 1, 20) != null })
  const raceSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'D6' : undefined, labels: ['种族', 'Race'], accepts: textValue })
  const alignmentSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'L9' : undefined, labels: ['阵营', 'Alignment'], accepts: textValue })
  const experienceSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'R3' : undefined, labels: ['经验', '经验值', 'XP', 'Experience'], accepts: (value) => usableNumber(value, 0, 99_999_999) != null })
  const name = usableText(nameSource?.cell.value) ?? 'Excel 导入角色'
  const player = usableText(playerSource?.cell.value) ?? ''
  const className = usableText(classSource?.cell.value) ?? '战士'
  const classDefinition = dnd5eClassDefinition(className)
  const charClass = classDefinition?.name ?? className
  const classId = classDefinition?.id
  const level = usableNumber(levelSource?.cell.value, 1, 20) ?? 1
  const raceName = usableText(raceSource?.cell.value) ?? '人类'
  const pluginRace = dnd5ePluginRaceDefinition(raceName)
  const backgroundSource = locateCell({ workbook, preferredSheet: backgroundSheet ?? main, directRef: recognizedTemplate ? 'E5' : undefined, labels: ['背景', '人物背景', 'Background'], accepts: textValue })
  const backgroundName = usableText(backgroundSource?.cell.value) ?? '自定义背景'
  const pluginBackground = dnd5ePluginBackgroundDefinition(backgroundName)
  const abilityImport = importedAbilities(workbook, main)
  const abilities = abilityImport.abilities
  const maxHpSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'Q23' : undefined, labels: ['最大生命值', '最大HP', 'Max HP', 'HP Max'], accepts: (value) => usableNumber(value, 1, 9_999) != null })
  const currentHpSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'M23' : undefined, labels: ['当前生命值', '当前HP', 'Current HP', 'HP'], accepts: (value) => usableNumber(value, 0, 9_999) != null })
  const tempHpSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'X23' : undefined, labels: ['临时生命值', '临时HP', 'Temp HP'], accepts: (value) => usableNumber(value, 0, 9_999) != null })
  const speedSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'R32' : undefined, labels: ['速度', 'Speed'], accepts: (value) => usableNumber(value, 0, 300) != null })
  const saveDcSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'D29' : undefined, labels: ['法术DC', 'DC', 'Spell Save DC'], accepts: (value) => usableNumber(value, 1, 40) != null })
  const passiveSource = locateCell({ workbook, preferredSheet: main, directRef: recognizedTemplate ? 'F34' : undefined, labels: ['被动察觉', '被动感知', 'Passive Perception'], accepts: (value) => usableNumber(value, 1, 50) != null })
  const maxHp = usableNumber(maxHpSource?.cell.value, 1, 9999) ?? 10
  const currentHp = usableNumber(currentHpSource?.cell.value, 0, 9999) ?? maxHp
  const tempHp = usableNumber(tempHpSource?.cell.value, 0, 9999) ?? 0
  const subclassName = usableText(subclassSource?.cell.value)
  const subclassId = classId ? inferSubclass(classId, subclassName) : undefined

  addSource(fieldSources, 'name', '角色名', nameSource?.sheet, nameSource?.cell, recognizedTemplate ? 'high' : 'medium')
  addSource(fieldSources, 'player', '玩家名', playerSource?.sheet, playerSource?.cell, recognizedTemplate ? 'high' : 'medium')
  addSource(fieldSources, 'experience', '经验值', experienceSource?.sheet, experienceSource?.cell, recognizedTemplate ? 'high' : 'medium')
  addSource(fieldSources, 'charClass', '职业', classSource?.sheet, classSource?.cell, recognizedTemplate ? 'high' : 'medium')
  addSource(fieldSources, 'subclass', '子职', subclassSource?.sheet, subclassSource?.cell, subclassId ? 'high' : 'medium')
  addSource(fieldSources, 'level', '等级', levelSource?.sheet, levelSource?.cell, recognizedTemplate ? 'high' : 'medium')
  addSource(fieldSources, 'race', '种族', raceSource?.sheet, raceSource?.cell, recognizedTemplate ? 'high' : 'medium')
  addSource(fieldSources, 'alignment', '阵营', alignmentSource?.sheet, alignmentSource?.cell, recognizedTemplate ? 'high' : 'medium')
  addSource(fieldSources, 'maxHp', '最大生命值', maxHpSource?.sheet, maxHpSource?.cell, recognizedTemplate ? 'high' : 'medium')
  addSource(fieldSources, 'currentHp', '当前生命值', currentHpSource?.sheet, currentHpSource?.cell, recognizedTemplate ? 'high' : 'medium')
  addSource(fieldSources, 'speed', '速度', speedSource?.sheet, speedSource?.cell, recognizedTemplate ? 'high' : 'medium')
  addSource(fieldSources, 'background', '背景', backgroundSource?.sheet, backgroundSource?.cell, recognizedTemplate ? 'high' : 'medium')
  for (const [key, label] of [['str', '力量'], ['dex', '敏捷'], ['con', '体质'], ['int', '智力'], ['wis', '感知'], ['cha', '魅力']] as const) {
    const source = abilityImport.sources[key]
    addSource(fieldSources, `abilities.${key}`, label, source?.sheet, source?.cell, recognizedTemplate ? 'high' : 'medium')
  }

  const spellbookValues = Object.values(spellbookSheet?.cells ?? {})
    .sort((left, right) => left.row - right.row || left.column - right.column)
    .flatMap((entry) => usableText(entry.value) ?? [])
  const preparedValues = recognizedTemplate
    ? valuesInRows(main, 64, 81)
    : Object.values(main.cells).flatMap((entry) => usableText(entry.value) ?? [])
  const spellbookSpells = recognizedSpells(spellbookValues)
  const preparedSpells = recognizedSpells(preparedValues)
  const detectedSpellNames = [...new Set([...spellbookValues, ...preparedValues]
    .filter((value) => value.length <= 40 && !value.startsWith('#')))]
    .filter((value) => spellLookup().has(normalizedName(value)))
  const importedSpellNames = [...new Set([...spellbookSpells, ...preparedSpells].map((spell) => spell.name))]
  const unrecognizedSpellNames = detectedSpellNames.filter((spellName) =>
    !importedSpellNames.some((imported) => normalizedName(imported) === normalizedName(spellName)))

  // Only treat explicit proficiency rows as selections. Background stories may
  // mention words such as “调查” or “察觉” without granting those skills.
  const skillTexts = valuesBesideLabel(main, '技能熟练项')
  const skills = skillIdsFromTexts(skillTexts)
  const backstorySource = locateCell({ workbook, preferredSheet: backgroundSheet ?? main, directRef: recognizedTemplate ? 'V24' : undefined, labels: ['背景故事', '人物背景', 'Backstory'], accepts: (value) => (usableText(value)?.length ?? 0) >= 10 })
  const backstory = usableText(backstorySource?.cell.value) ?? ''
  const backgroundSkillProficiencies = skills
  const detectedFeatureNames = findFeatureNames(main)
  const hitDieSides = classDefinition?.hitDie ?? 10
  const classSelections: Record<string, string[]> = {}
  if (spellbookSpells.length) classSelections['wizard-spellbook'] = spellbookSpells.map((spell) => spell.id)
  if (preparedSpells.length) classSelections['spell-prepared'] = preparedSpells.map((spell) => spell.id)
  const subclassWarning = subclassName && !subclassId
    ? `识别到子职“${subclassName}”，但当前房间没有对应规则定义；已保留在备注中，未伪造 Headless ID。`
    : undefined
  if (!classDefinition) warnings.push(`职业“${className}”没有匹配到当前规则集，导入后需要手动确认。`)
  if (subclassWarning) warnings.push(subclassWarning)
  if (!recognizedTemplate) warnings.push('没有识别到内置人物卡模板；已按字段标签进行通用解析，请在创建前核对。')
  if (!spellbookSheet) warnings.push('没有找到“法术书”工作表，只导入了人物卡页可见的法术。')
  if (!workbook.images.length) warnings.push('Excel 内没有可用的 PNG、JPG 或 WebP 立绘。')
  if (unrecognizedSpellNames.length) warnings.push(`有 ${unrecognizedSpellNames.length} 个法术名称未匹配到当前法术目录。`)

  const notes = compactNotes([
    ['Excel 子职', subclassName && !subclassId ? subclassName : undefined],
    ['性别', usableText(cell(main, 'L6')?.value)],
    ['年龄', usableText(cell(main, 'L7')?.value)],
    ['身高', usableText(cell(main, 'D9')?.value)],
    ['体重', usableText(cell(main, 'D10')?.value)],
    ['未结构化特性', detectedFeatureNames.length ? detectedFeatureNames.join('、') : undefined],
  ])
  const character: Partial<Character> = {
    name,
    player,
    race: pluginRace?.name ?? raceName,
    ...(pluginRace ? { dnd5eRaceId: pluginRace.id } : {}),
    charClass,
    ...(classId ? { dnd5eClassLevels: { [classId]: level } } : {}),
    level,
    background: pluginBackground?.name ?? backgroundName,
    ...(pluginBackground ? { dnd5eBackgroundId: pluginBackground.id } : {}),
    ...(backgroundSkillProficiencies.length ? { dnd5eBackgroundSkillProficiencies: backgroundSkillProficiencies } : {}),
    alignment: usableText(alignmentSource?.cell.value),
    experience: usableNumber(experienceSource?.cell.value, 0, 99_999_999) ?? 0,
    reputation: 0,
    abilities,
    savingThrows: classDefinition ? [...classDefinition.savingThrows] : [],
    skills,
    maxHp,
    currentHp: Math.min(maxHp, currentHp),
    tempHp,
    hitDice: `${level}d${hitDieSides}`,
    hitPointMaximumMode: 'manual',
    hitPointDice: [{ sides: hitDieSides, current: usableNumber(cell(main, 'L26')?.value, 0, level) ?? level, max: level }],
    ac: usableNumber(cell(main, 'D26')?.value, 1, 40) ?? 10,
    speed: usableNumber(speedSource?.cell.value, 0, 300) ?? 30,
    initiativeBonus: Math.floor((abilities.dex - 10) / 2),
    saveDC: usableNumber(saveDcSource?.cell.value, 1, 40) ?? 8,
    passivePerception: usableNumber(passiveSource?.cell.value, 1, 50) ?? 10,
    inspiration: 0,
    conditions: [],
    backstory,
    notes,
    dmNotes: `来源：${workbook.fileName}`,
    visibleToPlayers: true,
    ...(classId ? {
      dnd5eClassChoices: {
        classes: {
          [classId]: {
            ...(subclassId ? { subclass: subclassId } : {}),
            selections: classSelections,
          },
        },
      },
    } : {}),
  }

  return {
    schemaVersion: 1,
    sourceFileName: workbook.fileName,
    character,
    fieldSources,
    detectedSpellNames,
    importedSpellNames,
    unrecognizedSpellNames,
    detectedFeatureNames,
    warnings,
    workbookSummary: {
      sheetNames: workbook.sheets.map((sheet) => sheet.name),
      populatedCellCount: workbook.sheets.reduce((sum, sheet) => sum + Object.keys(sheet.cells).length, 0),
      imageCount: workbook.images.length,
      ...(recognizedTemplate ? { recognizedTemplate } : {}),
    },
  }
}

export function characterExcelImageFile(image: CharacterExcelImage): File {
  return new File([image.bytes.slice().buffer], image.fileName, { type: image.mimeType })
}

export function compactCharacterExcelWorkbookText(workbook: CharacterExcelWorkbook): string {
  const preferred = new Set(['主要', '背景', '背包', '法术书'])
  const sheets = workbook.sheets.filter((sheet) => preferred.has(sheet.name.trim()))
  return sheets.map((sheet) => {
    const rows = new Map<number, string[]>()
    for (const entry of Object.values(sheet.cells).sort((left, right) => left.row - right.row || left.column - right.column)) {
      const text = usableText(entry.value)
      if (!text) continue
      const values = rows.get(entry.row) ?? []
      values.push(`${entry.ref}=${text.slice(0, 1_000)}`)
      rows.set(entry.row, values)
    }
    return [`## ${sheet.name}`, ...[...rows.entries()].map(([row, values]) => `R${row}: ${values.join(' | ')}`)].join('\n')
  }).join('\n\n').slice(0, 100_000)
}
