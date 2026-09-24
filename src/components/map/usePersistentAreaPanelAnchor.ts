import { useLayoutEffect, useRef } from 'react'
import type { BattleMap, Dnd5ePluginArea } from '../../store/maps'

/** Follow the same live viewport dataset used while Konva pans the map. */
export function usePersistentAreaPanelAnchor(area?: Dnd5ePluginArea, map?: BattleMap) {
  const ref = useRef<HTMLDivElement>(null)
  useLayoutEffect(() => {
    const panel = ref.current
    const canvas = panel?.closest('.map-workspace-viewport')?.querySelector<HTMLElement>('[data-testid="map-canvas"]')
      ?? document.querySelector<HTMLElement>('[data-testid="map-canvas"]')
    if (!panel || !canvas || !area?.cells.length || !map) return
    const cols = area.cells.map(cell => cell.col)
    const rows = area.cells.map(cell => cell.row)
    const left = Math.min(...cols) * map.gridSize + (map.gridOffsetX ?? 0)
    const right = (Math.max(...cols) + 1) * map.gridSize + (map.gridOffsetX ?? 0)
    const centerY = (Math.min(...rows) + Math.max(...rows) + 1) / 2 * map.gridSize + (map.gridOffsetY ?? 0)
    const update = () => {
      const rect = canvas.getBoundingClientRect()
      const parent = panel.offsetParent?.getBoundingClientRect() ?? { left: 0, top: 0 }
      const scale = Number(canvas.dataset.viewportScale) || 1
      const x = rect.left + (Number(canvas.dataset.viewportX) || 0)
      const y = rect.top + (Number(canvas.dataset.viewportY) || 0)
      const minX = Math.max(0, rect.left) + 12
      const maxX = Math.min(window.innerWidth, rect.right) - 12
      const minY = Math.max(0, rect.top) + 12
      const maxY = Math.min(window.innerHeight, rect.bottom) - 12
      panel.style.maxHeight = `${Math.max(80, maxY - minY)}px`
      panel.style.width = `${Math.max(80, Math.min(320, maxX - minX))}px`
      const width = panel.offsetWidth
      const height = panel.offsetHeight
      const preferredX = x + right * scale + 14
      const besideX = preferredX + width <= maxX ? preferredX : x + left * scale - width - 14
      panel.style.left = `${Math.max(minX, Math.min(besideX, maxX - width)) - parent.left}px`
      panel.style.top = `${Math.max(minY, Math.min(y + centerY * scale - height / 2, maxY - height)) - parent.top}px`
    }
    const observer = new MutationObserver(update)
    observer.observe(canvas, { attributes: true, attributeFilter: ['data-viewport-x', 'data-viewport-y', 'data-viewport-scale'] })
    const resize = new ResizeObserver(update)
    resize.observe(canvas)
    resize.observe(panel)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    update()
    return () => {
      observer.disconnect()
      resize.disconnect()
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [area, map])
  return ref
}
