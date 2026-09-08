import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'

const viteConfigSource = readFileSync(
  new URL('../../../vite.config.ts', import.meta.url),
  'utf8',
)
const viteServerSource = readFileSync(
  new URL('../../../scripts/vite-server.mjs', import.meta.url),
  'utf8',
)

describe('地图开发服务器预热', () => {
  it('在首次进入地图前预编译 Konva 的 React 依赖图', () => {
    expect(viteConfigSource).toContain("'react-konva'")
    expect(viteConfigSource).toContain("'konva'")
    expect(viteConfigSource).toContain("'react-dom/client'")
    expect(viteConfigSource).toContain("'src/pages/MapsWorkspacePage.tsx'")
    expect(viteConfigSource).toContain("'src/presentation/maps/MapViewportLayer.tsx'")
    expect(viteConfigSource).toContain("'react-router-dom'")
    expect(viteConfigSource).toContain("'zustand/react/shallow'")
  })

  it('启动监听后完成地图模块预热，避免等待未启动的依赖转换服务', () => {
    expect(viteServerSource).toContain("'/src/pages/MapsWorkspacePage.tsx'")
    expect(viteServerSource).toContain("'/src/presentation/maps/MapViewportLayer.tsx'")
    expect(viteServerSource).toContain("'/src/presentation/maps/MapWorkspacePanelsLayer.tsx'")
    expect(viteServerSource).toContain('await server.environments.client.waitForRequestsIdle()')
    expect(viteServerSource).toContain('await clientDepsOptimizer?.scanProcessing')
    expect(viteServerSource).toContain('dependency.processing')
    expect(viteServerSource.indexOf('for (const url of warmupUrls)')).toBeGreaterThan(
      viteServerSource.indexOf('await server.listen()'),
    )
    expect(viteServerSource.indexOf('await clientDepsOptimizer?.scanProcessing')).toBeGreaterThan(
      viteServerSource.indexOf('await server.listen()'),
    )
  })
})
