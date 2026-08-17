import { describe, expect, it } from 'vitest'
import { strToU8, zipSync } from 'fflate'
import {
  buildCharacterExcelImportDraft,
  parseCharacterExcelFile,
} from './characterExcelImport'

function inlineCell(ref: string, value: string): string {
  return `<c r="${ref}" t="inlineStr"><is><t>${value}</t></is></c>`
}

function numericCell(ref: string, value: number): string {
  return `<c r="${ref}"><v>${value}</v></c>`
}

function sheetXml(cells: string): string {
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1">${cells}</row></sheetData></worksheet>`
}

function workbookFile(): File {
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
      <sheets><sheet name="主要" sheetId="1" r:id="rId1"/><sheet name="背景" sheetId="2" r:id="rId2"/><sheet name="法术书" sheetId="3" r:id="rId3"/></sheets>
    </workbook>`
  const relations = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
    <Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
      <Relationship Id="rId1" Type="worksheet" Target="worksheets/sheet1.xml"/>
      <Relationship Id="rId2" Type="worksheet" Target="worksheets/sheet2.xml"/>
      <Relationship Id="rId3" Type="worksheet" Target="worksheets/sheet3.xml"/>
      <Relationship Id="external" Type="hyperlink" Target="https://example.invalid/private" TargetMode="External"/>
    </Relationships>`
  const mainCells = [
    inlineCell('O1', 'DND 5E 人物卡'), inlineCell('D3', '霍霍菲尔'), inlineCell('D4', '心心'),
    numericCell('R3', 6500), inlineCell('R4', '法师'), inlineCell('V4', '预言学派'), numericCell('Y4', 5),
    inlineCell('D6', '半精灵'), inlineCell('L9', '混乱中立'),
    numericCell('F14', 19), numericCell('F15', 16), numericCell('F16', 12), numericCell('F17', 20), numericCell('F18', 17), numericCell('F19', 16),
    numericCell('I14', 13), numericCell('I15', 16), numericCell('I16', 12), numericCell('I17', 18), numericCell('I18', 16), numericCell('I19', 14),
    numericCell('M23', 35), numericCell('Q23', 35), numericCell('X23', 0), numericCell('D29', 14), numericCell('R32', 35), numericCell('F34', 16),
    inlineCell('C66', '火焰箭'), inlineCell('C72', '魔法飞弹'), inlineCell('C80', '火球术'),
  ].join('')
  const backgroundCells = [inlineCell('E5', '流浪儿'), inlineCell('V24', '来自 Excel 的背景故事。')].join('')
  const spellbookCells = [inlineCell('U7', '火焰箭'), inlineCell('U15', '魔法飞弹'), inlineCell('U24', '火球术')].join('')
  const bytes = zipSync({
    'xl/workbook.xml': strToU8(workbook),
    'xl/_rels/workbook.xml.rels': strToU8(relations),
    'xl/worksheets/sheet1.xml': strToU8(sheetXml(mainCells)),
    'xl/worksheets/sheet2.xml': strToU8(sheetXml(backgroundCells)),
    'xl/worksheets/sheet3.xml': strToU8(sheetXml(spellbookCells)),
    'xl/media/image1.png': new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10]),
    'xl/vbaProject.bin': new Uint8Array([1, 2, 3, 4]),
  })
  return new File([bytes], '霍霍菲尔.法师.xlsm', {
    type: 'application/vnd.ms-excel.sheet.macroEnabled.12',
  })
}

describe('character Excel import', () => {
  it('reads cells and raster images without executing macros or external links', async () => {
    const workbook = await parseCharacterExcelFile(workbookFile())

    expect(workbook.sheets.map((sheet) => sheet.name)).toEqual(['主要', '背景', '法术书'])
    expect(workbook.images).toHaveLength(1)
    expect(workbook.images[0].mimeType).toBe('image/png')
    expect(workbook.sheets[0].cells.D3.value).toBe('霍霍菲尔')
  })

  it('maps stable class and spell ids before creating the character', async () => {
    const draft = buildCharacterExcelImportDraft(await parseCharacterExcelFile(workbookFile()))

    expect(draft.character).toMatchObject({
      name: '霍霍菲尔',
      player: '心心',
      charClass: '法师',
      dnd5eClassLevels: { wizard: 5 },
      race: '半精灵',
      level: 5,
      maxHp: 35,
      currentHp: 35,
      abilities: { str: 19, dex: 16, con: 12, int: 20, wis: 17, cha: 16 },
      backstory: '来自 Excel 的背景故事。',
    })
    expect(draft.character.dnd5eClassChoices?.classes?.wizard?.selections?.['wizard-spellbook'])
      .toEqual(expect.arrayContaining(['fire-bolt', 'magic-missile', 'fireball']))
    expect(draft.character.dnd5eClassChoices?.classes?.wizard?.selections?.['spell-prepared'])
      .toEqual(expect.arrayContaining(['fire-bolt', 'magic-missile', 'fireball']))
    expect(draft.importedSpellNames).toEqual(expect.arrayContaining(['火焰箭', '魔法飞弹', '火球术']))
    expect(draft.warnings).toContain('识别到子职“预言学派”，但当前房间没有对应规则定义；已保留在备注中，未伪造 Headless ID。')
  })

  it('rejects legacy binary xls instead of attempting unsafe parsing', async () => {
    await expect(parseCharacterExcelFile(new File([new Uint8Array([1, 2, 3])], 'legacy.xls')))
      .rejects.toThrow('当前支持 .xlsx 与 .xlsm')
  })

  it('falls back to adjacent label values for an unfamiliar workbook layout', () => {
    const cells = Object.fromEntries(([
      ['A1', '角色名'], ['B1', '通用模板法师'], ['A2', '职业'], ['B2', '法师'], ['A3', '等级'], ['B3', 3],
      ['A4', '种族'], ['B4', '人类'], ['A5', '最大生命值'], ['B5', 18], ['A6', '当前生命值'], ['B6', 12],
      ['A8', '力量'], ['B8', 8], ['A9', '敏捷'], ['B9', 14], ['A10', '体质'], ['B10', 12],
      ['A11', '智力'], ['B11', 17], ['A12', '感知'], ['B12', 13], ['A13', '魅力'], ['B13', 10],
      ['A15', '法术'], ['B15', '火球术'],
    ] satisfies Array<[string, string | number]>).map(([ref, value]) => [ref, {
      ref,
      row: Number(ref.match(/\d+$/)?.[0]),
      column: ref.charCodeAt(0) - 64,
      value,
    }]))
    const draft = buildCharacterExcelImportDraft({
      fileName: 'generic.xlsx',
      sheets: [{ name: 'Character Sheet', cells }],
      images: [],
    })

    expect(draft.character).toMatchObject({
      name: '通用模板法师', charClass: '法师', level: 3, race: '人类', maxHp: 18, currentHp: 12,
      abilities: { str: 8, dex: 14, con: 12, int: 17, wis: 13, cha: 10 },
    })
    expect(draft.character.dnd5eClassChoices?.classes?.wizard?.selections?.['spell-prepared']).toContain('fireball')
    expect(draft.warnings).toContain('没有识别到内置人物卡模板；已按字段标签进行通用解析，请在创建前核对。')
  })
})
