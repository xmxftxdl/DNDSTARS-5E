import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import CharacterExcelImportDialog from './CharacterExcelImportDialog'

describe('CharacterExcelImportDialog', () => {
  it('shows a review gate before writing imported character data', () => {
    const html = renderToStaticMarkup(createElement(CharacterExcelImportDialog, {
      workbook: { fileName: 'hero.xlsx', sheets: [], images: [] },
      initialDraft: {
        schemaVersion: 1,
        sourceFileName: 'hero.xlsx',
        character: {
          name: '霍霍菲尔',
          player: '心心',
          charClass: '法师',
          race: '半精灵',
          level: 5,
          background: '流浪儿',
          experience: 6500,
          abilities: { str: 19, dex: 16, con: 12, int: 20, wis: 17, cha: 16 },
          currentHp: 35,
          maxHp: 35,
          speed: 35,
          saveDC: 14,
          skills: ['stealth'],
        },
        fieldSources: [{ field: 'name', label: '角色名', value: '霍霍菲尔', sheet: '主要', cell: 'D3', confidence: 'high' }],
        detectedSpellNames: ['火球术'],
        importedSpellNames: ['火球术'],
        unrecognizedSpellNames: [],
        detectedFeatureNames: ['预兆'],
        warnings: [],
        workbookSummary: { sheetNames: ['主要', '背景', '法术书'], populatedCellCount: 719, imageCount: 1 },
      },
      existingNames: ['霍霍菲尔'],
      onCancel: () => undefined,
      onImport: () => undefined,
    }))

    expect(html).toContain('Excel / AI 填卡预览')
    expect(html).toContain('确认创建角色')
    expect(html).toContain('已有同名角色')
    expect(html).toContain('查看 1 项来源单元格')
    expect(html).toContain('火球术')
    expect(html).toContain('隐匿')
  })
})
