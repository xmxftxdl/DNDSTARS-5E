import { describe, expect, it } from 'vitest'
import type { ExtractedPdfDocumentV1 } from '../../lib/pdfCampaignAnalysis'
import { AiProviderRegistryV1, type AiProviderRuntimeV1 } from '../../lib/aiProvider'
import { extractPdfSpellWindow, pdfSpellWindows, parsePdfExcludedPages, validatePdfSpellEvidence, pdfSpellClassReference, pdfSpellConversionText, pdfSpellClassAssignments, pdfSpellMetadataEvidence } from './pdfSpellImport'

it('reads flat component prices and exact durations without guessing conditional costs',()=>{
 const source={id:'test',name:'Synthetic',documentName:'test',startPage:1,endPage:1,text:'示例\n9\n环防护系\n法术成分：言语，材料（一块价值至少\n500GP的金属，消耗）\n持续时间：专注，至多10分钟\n正文'}
 expect(pdfSpellMetadataEvidence(source)).toEqual({level:9,concentration:true,durationRounds:100,materialCostGp:500,components:{verbal:true,somatic:false,material:true}})
 expect(pdfSpellMetadataEvidence({...source,text:source.text.replace('500GP','1,000金币')})).toMatchObject({materialCostGp:1000})
 expect(pdfSpellMetadataEvidence({...source,text:source.text.replace('500GP','每个目标500GP')})).not.toHaveProperty('materialCostGp')
 expect(pdfSpellMetadataEvidence({...source,text:source.text.replace('10分钟','1小时')})).toMatchObject({durationRounds:600})
 expect(pdfSpellMetadataEvidence({...source,text:source.text.replace('10分钟','特殊')})).not.toHaveProperty('durationRounds')
})

it('carries explicit invocation section rules without copying adjacent feature bodies',()=>{
  const source={id:'feature',kind:'feature' as const,name:'示例',documentName:'test',startPage:5,endPage:5,text:'示例 TEST\n先决条件：第7级\n示例规则'}
  const text=pdfSpellConversionText(source,'',[{page:4,text:'魔能祈唤 E LDRITCH I NVOCATION\n等级要求是邪术师职业等级。\n其他条目 OTHER\n先决条件：第2级\n无关的效果'}])
  expect(text).toContain('等级要求是邪术师职业等级')
  expect(text).not.toContain('无关的效果')
  expect(pdfSpellConversionText(source,'',[{page:4,text:'别的法师子职章节'}])).not.toContain('别的法师子职')
})
import { resolvePdfExtractionAnchors, pdfSpellHeaderCandidates, validatePdfInventoryCompleteness, pdfSpellAdjacentStatBlocks, finalizePdfExtractionOutput } from './pdfSpellImport'

describe('adjacent PDF creature evidence', () => {
  const source = {id: 'source', name: '木偶术', documentName: 'sample.pdf', startPage: 4, endPage: 4, text: '木偶术\n参考以下属性块。'}
  const block = '木偶术 PUPPET\n微型构装体，无阵营\n护甲等级 12\n生命值 8\n速度 20 英尺\n动作\n挥击。伤害 2。'
  it('attaches a same-name adjacent block once and stops before the next spell', () => {
    const page = {page: 5, text: `前面的无关正文\n${block}\n星光术 STAR\n1环塑能系\n施法时间：动作\n不要加入此正文`}
    const evidence = pdfSpellAdjacentStatBlocks(source, [page, page])
    expect(evidence).toBe(`[PDF 第 5 页；同名生物属性块]\n${block}`)
    expect(pdfSpellConversionText(source, '', [page])).toContain(evidence)
  })
  it('does not invent missing blocks, match similar names, or search beyond adjacent pages', () => {
    expect(pdfSpellAdjacentStatBlocks(source, [{page: 5, text: block.replace('木偶术 PUPPET', '木偶术大师 PUPPET MASTER')}])).toBe('')
    expect(pdfSpellAdjacentStatBlocks(source, [{page: 7, text: block}])).toBe('')
    expect(pdfSpellAdjacentStatBlocks(source, [{page: 5, text: source.text}])).toBe('')
  })
})

function document(): ExtractedPdfDocumentV1 {
  return {
    id: 'test-document', name: 'test.pdf', pageCount: 5, extractedCharacters: 100, scannedPages: [],
    chunks: [], pages: ['目录', '星光术\n施法时间：动作。', '造成一点伤害。', '其他资料', '结尾'].map((text, index) => ({
      documentId: 'test-document', documentSha256: 'hash', documentName: 'test.pdf', page: index + 1,
      text, normalizedText: text, textSha256: `${index}`, extractionMethod: 'pdf-text',
    })),
  }
}

describe('PDF spell source boundaries', () => {
  it('bounds subclass spans from primary headings and merges only evidenced child duplicates', () => {
    const first = '星光学院 STARS\n星光学院特性\n诗人等级 特性\n3rd 星光馈赠\n星光馈赠 GIFT\n获得能力。'
    const second = '月光学院 MOON\n月光学院特性\n诗人等级 特性\n3rd 月光馈赠\n月光馈赠 GIFT\n获得另一能力。'
    const window = { id: 'test', documentName: 'test.pdf', startPage: 1, ownedEndPage: 1,
      pages: [{ page: 1, text: first }, { page: 2, text: second }] }
    const raw = { spells: [
      { name: '星光学院', kind: 'subclass', startPage: 1, endPage: 2, startLine: 1, endLine: 6 },
      { name: '星光馈赠', kind: 'feature', startPage: 1, endPage: 1, startLine: 5, endLine: 6 },
    ], warnings: [] }
    const result = finalizePdfExtractionOutput(window, raw, true)
    expect(result.spells).toEqual([expect.objectContaining({ name: '星光学院', endPage: 1, text: first })])
    expect(result.warnings).toEqual(expect.arrayContaining([expect.stringContaining('校正'), expect.stringContaining('已合并')]))
    expect(() => finalizePdfExtractionOutput(window, { ...raw, spells: [...raw.spells, {
      name: '不存在的特性', kind: 'feature', startPage: 1, endPage: 1, startLine: 5, endLine: 6,
    }] }, true)).toThrow('无法在 PDF 原文核对')
  })
  it('revalidates cached text before applying the same subclass boundary as fresh anchors', () => {
    const first = '星光学院 STARS\n星光学院特性\n诗人等级 特性\n3rd 星光馈赠\n星光馈赠 GIFT\n获得能力。'
    const second = '月光学院 MOON\n月光学院特性\n诗人等级 特性\n3rd 月光馈赠\n月光馈赠 GIFT\n获得另一能力。'
    const window = { id: 'cached', documentName: 'test.pdf', startPage: 1, ownedEndPage: 1,
      pages: [{page: 1, text: first}, {page: 2, text: second}] }
    const cached = { spells: [{name: '星光学院', kind: 'subclass' as const, startPage: 1, endPage: 2, text: first + '\n' + second}], warnings: [] }
    const original = structuredClone(cached)
    const result = finalizePdfExtractionOutput(window, cached, true)
    expect(result.spells).toEqual([expect.objectContaining({name: '星光学院', endPage: 1, text: first})])
    expect(result.warnings.some(warning => warning.includes('校正'))).toBe(true)
    expect(cached).toEqual(original)
    expect(finalizePdfExtractionOutput(window, result, true).spells).toEqual(result.spells)
    expect(() => finalizePdfExtractionOutput(window, { ...cached, spells: [{ ...cached.spells[0], text: cached.spells[0].text + '\n虚构能力。' }] }, true)).toThrow('无法在 PDF 原文核对')
  })
  it('recovers table-only cached subclasses from complete original bodies and a proven next heading', () => {
    const prefix = '星光学院 STARS\n星光学院特性\n诗人等级 特性\n3rd 星光馈赠\n6th 月光馈赠'
    const body = '星光馈赠 STAR GIFT\n获得能力。\n月光馈赠 MOON GIFT\n获得进阶能力。'
    const next = '日光学院 SUN\n日光学院特性\n诗人等级 特性\n3rd 日光馈赠\n日光馈赠 SUN GIFT\n另一能力。'
    const window = {id: 'recovery', documentName: 'test.pdf', startPage: 1, ownedEndPage: 1,
      pages: [{page: 1, text: prefix}, {page: 2, text: body + '\n' + next}]}
    const cached = {spells: [{name: '星光学院', kind: 'subclass' as const, startPage: 1, endPage: 1, text: prefix}], warnings: []}
    const original = structuredClone(cached)
    const result = finalizePdfExtractionOutput(window, cached, true)
    expect(result.spells[0]).toMatchObject({endPage: 2, text: prefix + '\n' + body})
    expect(result.warnings.some(warning => warning.includes('恢复'))).toBe(true)
    expect(cached).toEqual(original)
    expect(finalizePdfExtractionOutput(window, result, true).spells).toEqual(result.spells)
    const openEnded = {...window, pages: [{page: 1, text: prefix}, {page: 2, text: body}]}
    expect(() => finalizePdfExtractionOutput(openEnded, cached, true)).toThrow('遗漏能力正文')
    const incomplete = {...window, pages: [{page: 1, text: prefix}, {page: 2, text: '星光馈赠 STAR GIFT\n获得能力。\n' + next}]}
    expect(() => finalizePdfExtractionOutput(incomplete, cached, true)).toThrow('遗漏能力正文')
  })
  it('rejects subclass slices that include another subclass, while allowing ordinary feature headings', () => {
    const window = pdfSpellWindows([document()])[0]
    const first = '星光学院 COLLEGE OF STARS\n说明。\n星光学院特性\n诗人等级 特性\n3rd 星光馈赠\n星光馈赠 STAR GIFT\n获得能力。'
    const second = '月光学院 COLLEGE OF MOON\n说明。\n月光学院特性\n诗人等级 特性\n3rd 月光馈赠\n月光馈赠 MOON GIFT\n获得能力。'
    window.pages[1].text = first
    window.pages[2].text = second
    const source = { id: 'one', kind: 'subclass' as const, name: '星光学院', documentName: 'test.pdf', startPage: 2, endPage: 3, text: first }
    const other = { ...source, id: 'two', name: '月光学院', startPage: 3, text: second }
    expect(() => validatePdfInventoryCompleteness(window, [source, other])).not.toThrow()
    expect(() => validatePdfInventoryCompleteness(window, [{ ...source, text: `${first}\n${second}` }, other])).toThrow('混入其他子职')
  })
  it('slices original cross-page text from unique normalized anchors and refuses invented or ambiguous anchors', () => {
    const window = pdfSpellWindows([document()])[0]
    window.pages[1].text = '前言\n星光术 ＳＴＡＲ\n施法时间：动作。'
    const anchored = { spells: [{ name: '星光术', startPage: 2, endPage: 3, startQuote: '星光术 STAR', endQuote: '造成一点伤害。' }], warnings: [] }
    const resolved = resolvePdfExtractionAnchors(window, anchored)
    expect(resolved.spells[0].text).toBe('星光术 ＳＴＡＲ\n施法时间：动作。\n造成一点伤害。')
    expect(validatePdfSpellEvidence(window, resolved)).toHaveLength(1)
    expect(() => resolvePdfExtractionAnchors(window, { ...anchored, spells: [{ ...anchored.spells[0], endQuote: '造成十点伤害。' }] })).toThrow('边界不存在')
    window.pages[2].text += '\n造成一点伤害。'
    expect(() => resolvePdfExtractionAnchors(window, anchored)).toThrow('不唯一')
  })
  it('rejects empty spell inventories and cut-off bodies using independent printed metadata', () => {
    const window = pdfSpellWindows([document()])[0]
    window.pages[1].text = '星光术 S TAR\n1\n环塑能系\n施法时间：动作。\n造成一点伤害。'
    expect(pdfSpellHeaderCandidates(window)).toEqual([{ name: '星光术', page: 2 }])
    expect(() => validatePdfInventoryCompleteness(window, [])).toThrow('漏项')
    const source = { id: 'one', name: '星光术', documentName: 'test.pdf', startPage: 2, endPage: 2, text: window.pages[1].text }
    expect(() => validatePdfInventoryCompleteness(window, [source])).not.toThrow()
    expect(() => validatePdfInventoryCompleteness(window, [{ ...source, text: '星光术\n造成一点' }])).toThrow('截断')
    window.pages[1].text = '星光学院 C OLLEGE OF S TARS\n说明。\n星光学院特性\n诗人等级 特性\n3rd 星光'
    expect(() => validatePdfInventoryCompleteness(window, [])).toThrow('子职')
    window.pages[1].text = '星光馈赠 S TAR G IFT 先决条件：\n精灵\n获得一个增益。'
    expect(() => validatePdfInventoryCompleteness(window, [])).toThrow('先决条件')
    expect(() => validatePdfInventoryCompleteness(window, [], false)).not.toThrow()
  })
  it('uses explicit line coordinates without asking the model to rewrite duplicate prose', () => {
    const window = pdfSpellWindows([document()])[0]
    const output = { spells: [{ name: '星光术', startPage: 2, startLine: 1, endPage: 3, endLine: 1 }], warnings: [] }
    expect(validatePdfSpellEvidence(window, resolvePdfExtractionAnchors(window, output))[0].text).toBe('星光术\n施法时间：动作。\n造成一点伤害。')
    expect(() => resolvePdfExtractionAnchors(window, { ...output, spells: [{ ...output.spells[0], endLine: 99 }] })).toThrow('行号')
    expect(() => resolvePdfExtractionAnchors(window, { ...output, spells: [{ ...output.spells[0], startLine: 0 }] })).toThrow('行号')
  })
  it('permits a complete displaced subclass table but rejects a spell span that swallows another spell', () => {
    const window = pdfSpellWindows([document()])[0]
    const source = { id: 'one', name: '星光术', documentName: 'test.pdf', startPage: 2, endPage: 2, text: '' }
    const body = '能力甲 F IRST\n造成一点伤害。\n能力乙 S ECOND\n获得一点生命。'
    window.pages[2].text = body
    expect(() => validatePdfInventoryCompleteness(window, [{ ...source, kind: 'subclass', text: `${body}\n战士等级 特性\n3rd 能力甲\n7th 能力乙` }])).not.toThrow()
    expect(() => validatePdfInventoryCompleteness(window, [{ ...source, kind: 'subclass', text: '介绍。\n战士等级 特性\n3rd 能力甲\n7th 能力乙' }])).toThrow('遗漏能力正文')
    expect(() => validatePdfInventoryCompleteness(window, [{ ...source, kind: 'spell', text: '星光术 S TAR\n1环塑能系\n施法时间：动作\n规则。\n月光术 M OON\n1环塑能系\n施法时间：动作\n规则。' }])).toThrow('混入')
  })
  it('requires explicit exclusions, preserves page ownership and rejects text spanning an excluded page', () => {
    expect(parsePdfExcludedPages('1, 3-4,3')).toEqual([1, 3, 4])
    expect(() => parsePdfExcludedPages('3-1')).toThrow()
    const doc = { ...document(), unresolvedPages: [1] }
    expect(() => pdfSpellWindows([doc])).toThrow()
    const windows = pdfSpellWindows([doc], [1, 3])
    expect(windows[0].pages.map(page => page.page)).toEqual([2, 4])
    expect(() => validatePdfSpellEvidence(windows[0], { spells: [{ name: '星光术', startPage: 2, endPage: 4, text: '星光术\n施法时间：动作。其他资料' }], warnings: [] })).toThrow('排除')
    expect(() => pdfSpellWindows([doc], [6])).toThrow('范围')
    expect(() => pdfSpellWindows([doc], [1, 2, 3, 4, 5])).toThrow('剩余')
  })
  it('reads explicit level and concentration evidence without guessing missing headers', () => {
    const source = { id: 'test', name: 'Test', documentName: 'test.pdf', startPage: 1, endPage: 1, text: '' }
    expect(pdfSpellMetadataEvidence({ ...source, text: '测试法术\n3 环塑能\n持续时间：专注，至多1分钟' })).toEqual({ level: 3, concentration: true, durationRounds: 10 })
    expect(pdfSpellMetadataEvidence({ ...source, text: '测试法术\n塑能戏法\n持续时间：立即' })).toEqual({ level: 0, concentration: false })
    expect(pdfSpellMetadataEvidence({ ...source, text: '描述包含专注一词，但缺少元数据。' })).toEqual({})
  })
  it('reads exact class-list evidence across pages without confusing sorcerer and warlock', () => {
    const reference = '诗人法术\n星光（塑能）\n术士法术\n星光（塑能）\n[PDF 第 2 页]\n云朵（变化，仪式）\n邪术师法术\n云朵（变化）'
    expect(pdfSpellClassAssignments(reference)).toEqual({ 星光: ['bard', 'sorcerer'], 云朵: ['sorcerer', 'warlock'] })
    expect(pdfSpellClassReference([{ page: 1, text: '诗人法术\n星光（塑能）' }])).toContain('星光')
  })
  it('retains character option types and rejects unknown types while checking the same source evidence', () => {
    const window = pdfSpellWindows([document()])[0]
    const output = { spells: [{ kind: 'feat', name: '星光术', startPage: 2, endPage: 3, text: '星光术\n施法时间：动作。\n造成一点伤害。' }], warnings: [] }
    const source = validatePdfSpellEvidence(window, output)[0]
    expect(source.kind).toBe('feat')
    expect(pdfSpellConversionText(source, '法师法术列表')).toContain('先决条件')
    expect(pdfSpellConversionText(source, '法师法术列表')).not.toContain('法师法术列表')
    output.spells[0].kind = 'unknown'
    expect(() => validatePdfSpellEvidence(window, output)).toThrow()
  })
  it('retains class-list continuation as context without adding unrelated chapters', () => {
    const reference = pdfSpellClassReference([
      { page: 1, text: '背景故事' }, { page: 2, text: '法师法术\n星光术' },
      { page: 3, text: '清单续页' }, { page: 4, text: '附录' },
    ])
    expect(reference).toContain('清单续页')
    expect(reference).not.toContain('背景故事')
    expect(reference).not.toContain('附录')
    const text = pdfSpellConversionText({ id: 'one', name: '星光术', documentName: 'sample', startPage: 5, endPage: 5, text: '原文' }, reference)
    expect(text).toContain('禁止将清单中的其他法术生成条目')
    expect(text).toContain('原文')
  })
  it('owns each page exactly once and retains look-ahead for cross-page spells', () => {
    const windows = pdfSpellWindows([document()])
    expect(windows.map((entry) => [entry.startPage, entry.ownedEndPage])).toEqual([[1, 2], [3, 4], [5, 5]])
    expect(windows[0].pages.map((page) => page.page)).toEqual([1, 2, 3, 4])
    expect(validatePdfSpellEvidence(windows[0], {
      spells: [{ name: '星光术', startPage: 2, endPage: 3, text: '星光术 施法时间：动作。造成一点伤害。' }], warnings: [],
    })[0].startPage).toBe(2)
  })
  it('rejects fabricated text and invalid ownership instead of producing an importable spell', () => {
    const window = pdfSpellWindows([document()])[0]
    for (const spell of [
      { name: '星光术', startPage: 2, endPage: 3, text: '造成十点伤害。' },
      { name: '其他资料', startPage: 4, endPage: 4, text: '其他资料' },
      { name: '星光术', startPage: 2, endPage: 6, text: '星光术' },
      { name: '不存在的法术', startPage: 2, endPage: 2, text: '星光术' },
    ]) expect(() => validatePdfSpellEvidence(window, { spells: [spell], warnings: [] })).toThrow()
  })
  it('does not treat missing or unresolved OCR pages as a complete book', () => {
    expect(() => pdfSpellWindows([{ ...document(), unresolvedPages: [2] }])).toThrow()
    expect(() => pdfSpellWindows([{ ...document(), pages: document().pages!.slice(1) }])).toThrow()
    expect(() => pdfSpellWindows([{ ...document(), pages: document().pages!.map((page) => ({ ...page, page: 1 })) }])).toThrow()
  })

  it('permits omitted page folios at a page break without omitting unrelated numeric rules', () => {
    const window = pdfSpellWindows([document()])[0]
    window.pages[2].text = '  \n2\n造成一点伤害。'
    const output = { spells: [{ name: '星光术', startPage: 2, endPage: 3, text: '星光术\n施法时间：动作。\n造成一点伤害。' }], warnings: [] }
    expect(validatePdfSpellEvidence(window, output)).toHaveLength(1)
    window.pages[2].text = '20\n造成一点伤害。'
    expect(() => validatePdfSpellEvidence(window, output)).toThrow()
  })
  it('permits an explicitly empty page inventory but rejects malformed model output', () => {
    const window = pdfSpellWindows([document()])[0]
    expect(validatePdfSpellEvidence(window, { spells: [], warnings: [] })).toEqual([])
    expect(() => validatePdfSpellEvidence(window, { spells: [], warnings: 'bad' })).toThrow()
  })

  it('extracts through the provider contract and preserves warnings without a paid request', async () => {
    const runtime: AiProviderRuntimeV1 = {
      descriptor: {
        schemaVersion: 1, id: 'local-test', displayName: 'Test', description: 'Synthetic test',
        transport: 'local-bridge', status: 'ready', dataBoundary: 'local-only',
        capabilities: ['text-generation', 'structured-output'], supportedTasks: ['resource-structuring'],
        pricing: { mode: 'free-local', creditsPerMillionInput: 0, creditsPerMillionOutput: 0, minimumCredits: 0 },
      },
      listModels: async () => [{ schemaVersion: 1, id: 'test-model', providerId: 'local-test', displayName: 'Test', contextWindowTokens: 32_768, capabilities: ['text-generation', 'structured-output'], supportedTasks: ['resource-structuring'] }],
      generateStructured: async (request) => {
        expect(request.documents).toHaveLength(4)
        expect(request.systemPrompt).toContain('不从记忆补写')
        return {
          schemaVersion: 1, jobId: request.jobId, providerId: 'local-test', modelId: 'test-model',
          output: {
            spells: [{ name: '星光术', startPage: 2, endPage: 3, text: '星光术\n施法时间：动作。\n造成一点伤害。' }, { name: '其他资料', startPage: 4, endPage: 4, text: '其他资料' }],
            warnings: ['需要核对版式'],
          },
        }
      },
    }
    const registry = new AiProviderRegistryV1()
    registry.register(runtime)
    const result = await extractPdfSpellWindow({ window: pdfSpellWindows([document()])[0], registry, selection: { schemaVersion: 1, providerId: 'local-test', modelId: 'test-model', allowPaidFallback: false, maxCreditsPerTask: 0 } })
    expect(result.spells).toHaveLength(1)
    expect(result.warnings).toEqual(['需要核对版式', '后续窗口处理：其他资料（第 4 页）；本窗口未计入。'])
  })
})

// Deliberately synthetic evidence; no remote conversion is involved.
describe('explicit source component evidence', () => {
  const evidence = (header: string) => pdfSpellMetadataEvidence({ id: 'fixture', name: 'Fixture', documentName: 'fixture', startPage: 1, endPage: 1, text: `法术成分：${header}\n持续时间：立即` })
  it.each(['姿势，材料（一滴水）', 'S, M (water)', '姿\n势、材料（言语不会增加成分）'])('reads absent verbal component from %s', header => {
    expect(evidence(header).components).toEqual({ verbal: false, somatic: true, material: true })
  })
  it.each(['', '言语或姿势', '姿势，未知', '材料（损坏的括号', '参见正文'])('does not guess incomplete/conditional evidence %s', header => {
    expect(evidence(header).components).toBeUndefined()
  })
})
