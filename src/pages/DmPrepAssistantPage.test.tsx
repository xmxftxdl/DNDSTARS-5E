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
  it('默认进入本次备团，并把长页面收拢为五类工作区', () => {
    const html = renderPage()

    expect(html).toContain('备团工作台')
    expect(html).toContain('本次备团')
    expect(html).toContain('剧情')
    expect(html).toContain('世界')
    expect(html).toContain('资源')
    expect(html).toContain('团务复盘')
    expect(html).toContain('备团就绪度')
    expect(html).toContain('先建立这场战役的备团档案')
  })

  it('把现有工具入口绑定到当前战役', () => {
    const html = renderPage('campaign with spaces')

    expect(html).toContain('/campaign/campaign%20with%20spaces/maps')
    expect(html).toContain('/campaign/campaign%20with%20spaces/dm-tools/workshop')
    expect(html).toContain('/campaign/campaign%20with%20spaces/dm-tools/simulation')
    expect(html).toContain('/campaign/campaign%20with%20spaces/communications')
  })

  it('把 AI 导入与任务收拢到独立复核入口', () => {
    const html = renderPage()

    expect(html).not.toContain('本地免费模型')
    expect(html).not.toContain('Ollama')
    expect(html).toContain('AI 导入与任务')
    expect(html).toContain('external-account')
    expect(html).toContain('导入并分析模组')
    expect(html).not.toContain('第一阶段：导入模组并建立 AI 战役索引')
  })
})
