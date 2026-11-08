import { renderToStaticMarkup } from 'react-dom/server'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { expect, it, vi } from 'vitest'
import CampaignReadinessPanel from './CampaignReadinessPanel'
const fixture = vi.hoisted(() => ({
  characters: [{id:'hero',name:'Hero',roomId:'room',roomMemberId:'player'}, {id:'foreign',name:'Other campaign',roomId:'other',roomMemberId:'other-player'}],
  maps: [{tokens:[] as {characterId:string}[]}],
}))
vi.mock('../store/characters', () => ({useCharacterStore: (select: (state: typeof fixture) => unknown) => select(fixture)}))
vi.mock('../store/maps', () => ({useMapStore: (select: (state: typeof fixture) => unknown) => select(fixture)}))
vi.mock('../lib/roomSession', () => ({getRoomSession: () => ({roomId:'room',role:'dm'})}))
function render() { return renderToStaticMarkup(<MemoryRouter initialEntries={['/campaign/example/overview']}><Routes><Route path="/campaign/:campaignId/overview" element={<CampaignReadinessPanel />} /></Routes></MemoryRouter>) }
it('shows missing placed characters and routes to this campaign rather than a global workspace', () => {
  const html = render()
  expect(html).toContain('尚未放上地图：Hero')
  expect(html).not.toContain('Other campaign')
  expect(html).toContain('/campaign/example/maps')
  expect(html).toContain('/campaign/example/characters')
})
it('recognizes assigned character tokens and keeps the remaining manual checks explicit', () => {
  fixture.maps[0].tokens = [{characterId:'hero'}]
  const html = render()
  expect(html).toContain('已分配的角色都有地图棋子')
  expect(html).toContain('规则包兼容性和玩家可见范围仍需检查')
})