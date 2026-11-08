import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useSceneOrchestrationStore } from '../../store/sceneOrchestration'
import { useMapStore, type BattleMap } from '../../store/maps'
import SceneOrchestrationPanel from './SceneOrchestrationPanel'

vi.mock('../../store/sceneOrchestration', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../store/sceneOrchestration')>()
  return { ...original, useSceneOrchestrationStore: Object.assign(
    (selector: (state: ReturnType<typeof original.useSceneOrchestrationStore.getState>) => unknown) => selector(original.useSceneOrchestrationStore.getState()),
    original.useSceneOrchestrationStore,
  ) }
})
vi.mock('../../store/maps', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../store/maps')>()
  return { ...original, useMapStore: Object.assign(
    (selector: (state: ReturnType<typeof original.useMapStore.getState>) => unknown) => selector(original.useMapStore.getState()),
    original.useMapStore,
  ) }
})

const map: BattleMap = { id: 'map-a', name: '地图 A', width: 800, height: 600,
  gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [] }
const props = { map, combatActive: false, open: true, onOpenChange: vi.fn(),
  onBeginDraw: vi.fn(), onCancelDraw: vi.fn(), onRunTrigger: vi.fn(),
  onStep: vi.fn(), onUndo: vi.fn(), onPlayBackground: vi.fn(), onStopAudio: vi.fn() }

describe('travel editing in the geometry panel', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    useSceneOrchestrationStore.getState().reset()
    useMapStore.setState({ maps: [map, { ...map, id: 'map-b', name: '地图 B' }], selectedId: map.id })
  })
  afterEach(() => vi.restoreAllMocks())

  it('offers jump setup without requiring the separate scene panel', () => {
    const html = renderToStaticMarkup(createElement(SceneOrchestrationPanel, { ...props, embedded: true, travelOnly: true }))
    expect(html).toContain('data-testid="map-travel-editor"')
    expect(html).toContain('开始设置跳转')
    expect(html).not.toContain('全局场景音乐')
    expect(html).not.toContain('场景光照与天气')
  })

  it('reuses existing entrance and destination IDs and offers only travel actions', () => {
    const store = useSceneOrchestrationStore.getState()
    const sceneId = store.ensureScene(map.id, map.name)
    const trigger = useSceneOrchestrationStore.getState().shared.scenes[0].triggers[0]
    store.addAction(sceneId, trigger.id, { id: 'existing-exit', kind: 'teleport', enabled: true,
      targetMapId: 'map-b', x: 200, y: 300, moveTriggeringToken: true })
    const before = JSON.stringify(useSceneOrchestrationStore.getState().shared.scenes)
    const html = renderToStaticMarkup(createElement(SceneOrchestrationPanel, { ...props, embedded: true, travelOnly: true }))
    expect(html).toContain('目标地图/楼层')
    expect(html).toContain('地图 B')
    expect(html).toContain('value="teleport"')
    expect(html).not.toContain('value="whisper"')
    expect(html).toContain('墙体与几何 → 地图跳转')
    expect(JSON.stringify(useSceneOrchestrationStore.getState().shared.scenes)).toBe(before)
  })

  it('keeps scene actions available and points to the new travel editor', () => {
    useSceneOrchestrationStore.getState().ensureScene(map.id, map.name)
    const html = renderToStaticMarkup(createElement(SceneOrchestrationPanel, { ...props, onOpenMapTravel: vi.fn() }))
    expect(html).toContain('地图跳转已移至')
    expect(html).toContain('value="whisper"')
    expect(html).not.toContain('value="teleport"')
  })
})
