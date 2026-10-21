import { expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { ObjectFlightPreview } from './ObjectFlightPreview'
vi.mock('react-konva', async () => {
  const { createElement } = await import('react')
  const node = (props: Record<string, any>) => createElement('div', { 'data-text': props.text, 'data-x': props.x, 'data-points': props.points?.join(',') }, props.children)
  return { Arrow: node, Circle: node, Group: node, Text: node }
})
it('shows the trajectory and altitude without revealing unseen creature contacts', () => {
  const html = renderToStaticMarkup(createElement(ObjectFlightPreview, { valid: true, gridSize: 50,
    visibleTokenIds: new Set(['visible']), plan: { objectId: 'stone', from: { x: 10, y: 20 }, to: { x: 900, y: 20 },
      elevationFeet: 10, destinationElevationFeet: 30,
      creatures: [{ tokenId: 'hidden', t: .1, point: { x: 123, y: 20 }, elevationFeet: 12 },
        { tokenId: 'visible', t: .2, point: { x: 234, y: 20 }, elevationFeet: 14 }] } }))
  expect(html).toContain('10 → 30 尺')
  expect(html).toContain('10,20,900,20')
  expect(html).toContain('data-x="234"')
  expect(html).not.toContain('data-x="123"')
  expect(html).toContain('data-text="1"')
  expect(html).not.toContain('data-text="2"')
})
