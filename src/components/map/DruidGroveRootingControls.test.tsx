import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { DruidGroveRootingControls } from './DruidGroveRootingControls'
import type { Token } from '../../store/maps'
const tree: Token = { id: 'tree', label: 'Oak', type: 'obstacle', x: 0, y: 0, size: 1, color: '', emoji: '', hp: 20,
  dnd5eObjectState: { schemaVersion: 1, vegetation: 'living' }, dnd5eGroveRooting: 'pending' }
it('offers both terrain decisions only for a living pending restored tree with an authority callback', () => {
  const html = renderToStaticMarkup(<DruidGroveRootingControls token={tree} onSettle={async () => {}} />)
  expect(html).toContain('此处可以生根')
  expect(html).toContain('此处无法生根')
  for (const token of [tree, { ...tree, hp: 0 }, { ...tree, dnd5eGroveRooting: 'rooted' as const }, { ...tree, dnd5eGroveRooting: 'unrooted' as const }]) {
    const markup = renderToStaticMarkup(<DruidGroveRootingControls token={token} onSettle={token === tree ? undefined : async () => {}} />)
    expect(markup).not.toContain('<button')
  }
  expect(renderToStaticMarkup(<DruidGroveRootingControls token={{ ...tree, dnd5eGroveRooting: undefined }} />)).toBe('')
})
