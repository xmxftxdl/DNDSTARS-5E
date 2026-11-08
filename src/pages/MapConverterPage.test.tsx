import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { sidebarDmAssistantItems } from '../components/sidebarNavigation'
import MapConverterPage from './MapConverterPage'

describe('standalone map converter', () => {
  it('opens image and wall conversion without a PDF or prep session', () => {
    const html = renderToStaticMarkup(
      <MemoryRouter initialEntries={['/campaign/test%20campaign/dm-tools/map-converter']}>
        <Routes><Route path="/campaign/:campaignId/dm-tools/map-converter" element={<MapConverterPage />} /></Routes>
      </MemoryRouter>,
    )
    expect(html).toContain('AI 地图转换')
    expect(html).toContain('选择一张地图图片')
    expect(html).toContain('导出含原图的 UVTT')
    expect(html).toContain('href="/campaign/test%20campaign/maps"')
    expect(html).not.toContain('备团工作台')
    expect(html).not.toContain('PDF 自动模型路由')
  })

  it('has its own campaign-scoped sidebar entry', () => {
    const entries = sidebarDmAssistantItems('/campaign/test%20campaign')
    expect(entries.find((entry) => entry.label === 'AI 地图转换')?.to)
      .toBe('/campaign/test%20campaign/dm-tools/map-converter')
    expect(entries.find((entry) => entry.label === '备团助手')?.to)
      .toBe('/campaign/test%20campaign/dm-tools/prep')
  })
})
