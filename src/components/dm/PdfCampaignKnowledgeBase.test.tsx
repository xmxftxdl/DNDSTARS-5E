import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { PdfCampaignAnalysisV1 } from '../../lib/pdfCampaignAnalysis'
import PdfCampaignKnowledgeBase from './PdfCampaignKnowledgeBase'

const analysis: PdfCampaignAnalysisV1 = {
  schemaVersion: 1,
  overview: '测试战役',
  people: [], relationships: [], locations: [], factions: [], clues: [], scenes: [], encounters: [], prepTips: [], warnings: [],
  importCandidates: [],
  documents: [],
  analyzedChunks: 0,
}

describe('PdfCampaignKnowledgeBase', () => {
  it('把分析结果组织为独立页签、搜索模式、地图、怪物图鉴和关系图入口', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PdfCampaignKnowledgeBase
          analysis={analysis}
          mapHref="/campaign/test/maps"
          onEdit={vi.fn()}
          onPortraitChange={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(html).toContain('战役知识库')
    expect(html).toContain('全库搜索模式')
    expect(html).toContain('怪物图鉴')
    expect(html).toContain('人物关系图')
    expect(html).toContain('地图')
    expect(html).toContain('编辑知识库')
  })

  it('把 NPC 待导入草稿渲染为可打开详情的按钮，并提示战斗单位可能误分类', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PdfCampaignKnowledgeBase
          analysis={{
            ...analysis,
            importCandidates: [{
              name: '伊利法军兵',
              description: '守序邪恶，作为召唤单位参与战斗。',
              kind: 'npc',
              automation: 'full',
              citations: [{ documentName: '模组.pdf', page: 10 }],
            }],
          }}
          mapHref="/campaign/test/maps"
          initialTab="imports"
          onEdit={vi.fn()}
          onPortraitChange={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(html).toContain('查看详情')
    expect(html).toContain('可能应归类为怪物')
    expect(html).toContain('<button')
  })

  it('把简称与完整姓名安全归并为一行，并在详情面板展示完整人物档案', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PdfCampaignKnowledgeBase
          analysis={{
            ...analysis,
            people: [{
              name: '费兰迪尔',
              description: '负责核查送回的信件。',
              role: '文书官',
              appearance: '',
              personality: '谨慎',
              motivation: '维护文书程序与家族法律底线。',
              secret: '',
              voice: '措辞正式。',
              citations: [{ documentName: '模组.pdf', page: 3 }],
            }, {
              name: '费兰迪尔·银翼',
              description: '森都四大家族内阁文书官。',
              role: '银翼家族文书官',
              appearance: '办公桌整齐，常备一枝银杆羽笔。',
              personality: '',
              motivation: '',
              secret: '拒绝海都求情。',
              voice: '',
              citations: [{ documentName: '模组.pdf', page: 12 }],
            }],
          }}
          mapHref="/campaign/test/maps"
          initialTab="people"
          onEdit={vi.fn()}
          onPortraitChange={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(html.match(/data-testid="pdf-person-row"/g)).toHaveLength(1)
    expect(html).toContain('费兰迪尔·银翼')
    expect(html).toContain('别名：费兰迪尔')
    expect(html).toContain('人物详情')
    expect(html).toContain('欲望或目标')
    expect(html).toContain('维护文书程序与家族法律底线。')
  })

  it('按全书剧情顺序展示紧凑事件列表，不再按引用页码误排', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PdfCampaignKnowledgeBase
          analysis={{
            ...analysis,
            scenes: [{
              name: '不应进入时间线的设施说明', description: '这只是一个可运行场景资料。', location: '文书室', npcs: [], monsters: [], citations: [{ documentName: '模组.pdf', page: 15 }],
            }],
            timelineEvents: [{
              name: '进入翠羽城', description: '玩家抵达翠羽城。', location: '翠羽城', npcs: [], monsters: [],
              time: '黑桦弯伏击后', timelineKind: 'current', timelineOrder: 30, tags: ['主线'],
              citations: [{ documentName: '模组.pdf', page: 2 }],
            }, {
              name: '白鹿案', description: '海都官员在森都拜访白鹿。', location: '翠羽森林', npcs: [], monsters: [],
              time: '数年前', timelineKind: 'history', timelineOrder: 10, tags: ['背景'],
              citations: [{ documentName: '模组.pdf', page: 20 }],
            }, {
              name: '海都密信求助', description: '潮木村出现少量死者复起迹象。', location: '潮木村', npcs: [], monsters: [],
              time: '故事开始前', timelineKind: 'history', timelineOrder: 20, tags: ['背景'],
              citations: [{ documentName: '模组.pdf', page: 18 }],
            }],
          }}
          mapHref="/campaign/test/maps"
          initialTab="timeline"
          onEdit={vi.fn()}
          onPortraitChange={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(html.indexOf('白鹿案')).toBeLessThan(html.indexOf('海都密信求助'))
    expect(html.indexOf('海都密信求助')).toBeLessThan(html.indexOf('进入翠羽城'))
    expect(html).toContain('数年前')
    expect(html).toContain('背景历史')
    expect(html).toContain('事件详情')
    expect(html).not.toContain('不应进入时间线的设施说明')
  })

  it('旧分析仅有页段场景时不会回退生成伪时间线', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PdfCampaignKnowledgeBase
          analysis={{
            ...analysis,
            scenes: Array.from({ length: 52 }, (_, index) => ({
              name: `页段场景 ${index + 1}`,
              description: '用于地图与备团的细颗粒度场景。',
              location: '',
              npcs: [],
              monsters: [],
              citations: [{ documentName: '模组.pdf', page: index + 1 }],
            })),
          }}
          mapHref="/campaign/test/maps"
          initialTab="timeline"
          onEdit={vi.fn()}
          onPortraitChange={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(html).toContain('尚未生成全书关键时间线')
    expect(html).toContain('页段场景不会再被当作时间线展示')
    expect(html).not.toContain('页段场景 1')
  })

  it('用房间战役时钟绘制当前时间红线，并分开未绑定的叙事事件', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PdfCampaignKnowledgeBase
          analysis={{
            ...analysis,
            timelineEvents: [{
              name: '早间会面', description: '已绑定的事件。', location: '', npcs: [], monsters: [],
              gameTimeWorldMinute: 7 * 60, time: '当日早间', citations: [],
            }, {
              name: '午后调查', description: '已绑定的事件。', location: '', npcs: [], monsters: [],
              gameTimeWorldMinute: 13 * 60, time: '当日午后', citations: [],
            }, {
              name: '古代事件', description: '只有叙事时间。', location: '', npcs: [], monsters: [],
              time: '数年前', citations: [],
            }],
          }}
          mapHref="/campaign/test/maps"
          initialTab="timeline"
          onEdit={vi.fn()}
          onPortraitChange={vi.fn()}
        />
      </MemoryRouter>,
    )
    expect(html).toContain('data-testid="pdf-timeline-now-marker"')
    expect(html).toContain('当前时间 · 第 1 日 08:00')
    expect(html.indexOf('早间会面')).toBeLessThan(html.indexOf('当前时间 ·'))
    expect(html.indexOf('当前时间 ·')).toBeLessThan(html.indexOf('午后调查'))
    expect(html).toContain('未绑定游戏时间 · 1')
  })

  it('允许 DM 在时间线页直接切换战役时间或公历日期并编辑节点', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter>
        <PdfCampaignKnowledgeBase
          analysis={{
            ...analysis,
            timelineEvents: [{
              name: '调查白鹿案', description: '玩家开始调查。', location: '白鹿小教堂', npcs: [], monsters: [],
              gameTimeWorldMinute: 10 * 60, time: '调查阶段', citations: [],
            }],
          }}
          mapHref="/campaign/test/maps"
          initialTab="timeline"
          onEdit={vi.fn()}
          onPortraitChange={vi.fn()}
          onTimelineEventsChange={vi.fn()}
        />
      </MemoryRouter>,
    )

    expect(html).toContain('data-testid="pdf-timeline-clock-editor"')
    expect(html).toContain('战役时间')
    expect(html).toContain('公历日期')
    expect(html).toContain('新增时间节点')
    expect(html).toContain('直接编辑此节点')
  })
})
