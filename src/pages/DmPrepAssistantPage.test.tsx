import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import DmPrepAssistantPage from './DmPrepAssistantPage'

function renderPage(campaignId = 'campaign-01') {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[`/campaign/${campaignId}/dm-tools/prep`]}>
      <Routes>
        <Route path="/campaign/:campaignId/dm-tools/prep" element={<DmPrepAssistantPage />} />
      </Routes>
    </MemoryRouter>,
  )
}

describe('DmPrepAssistantPage', () => {
  it('按 PDF 解析、场景制作、开团记录和战役导出组织备团流程', () => {
    const html = renderPage()

    expect(html).toContain('导入模组并建立 AI 战役索引')
    expect(html).toContain('地图与场景制作')
    expect(html).toContain('语音转录与持续战役记忆')
    expect(html).toContain('导出完整战役设置')
    expect(html).toContain('人物关系图')
    expect(html).toContain('人物形象与档案')
    expect(html).toContain('关键线索')
    expect(html).toContain('DM 可以编辑或删除结果')
  })

  it('把现有工具入口绑定到当前战役', () => {
    const html = renderPage('campaign with spaces')

    expect(html).toContain('/campaign/campaign%20with%20spaces/maps')
    expect(html).toContain('/campaign/campaign%20with%20spaces/dm-tools/workshop')
    expect(html).toContain('/campaign/campaign%20with%20spaces/dm-tools/simulation')
    expect(html).toContain('/campaign/campaign%20with%20spaces/communications')
  })

  it('显示已接通的 PDF 分析入口，并保留云端与语音能力的明确边界', () => {
    const html = renderPage()

    expect(html).toContain('本地免费模型')
    expect(html).toContain('Astral Trace 付费模型')
    expect(html).toContain('使用自己的 API Key')
    expect(html).toContain('选择 PDF')
    expect(html).toContain('点击选择 PDF，或将文件拖到这里')
    expect(html).toContain('深度分析')
    expect(html).toContain('实体、剧情分开提取，再做全书综合')
    expect(html).toContain('快速提取')
    expect(html).toContain('扫描页会被标记')
    expect(html).toContain('未明确勾选时，系统只会暂停任务，不会自动扣除 AI Credit')
    expect(html).toContain('disabled=""')
    expect(html).toContain('待接入')
  })
})
