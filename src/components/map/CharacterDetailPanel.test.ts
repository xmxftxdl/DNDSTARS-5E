import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import CharacterDetailPanel from './CharacterDetailPanel'
import { parseLiveHitPointDraft } from './characterHitPoints'

const token: Token = {
  id: 'hero-token',
  label: '新冒险者',
  x: 0,
  y: 0,
  color: '#34d399',
  emoji: '🧝',
  size: 1,
  type: 'player',
  characterId: 'hero',
}

const character = {
  id: 'hero',
  name: '新冒险者',
  player: '玩家一',
  avatar: '🧝',
  accent: 'from-emerald-500 to-teal-700',
  tokenPortrait: 'data:image/png;base64,character-token',
  race: '人类',
  charClass: '吟游诗人',
  level: 13,
  maxHp: 94,
  currentHp: 79,
  tempHp: 0,
  abilities: { str: 10, dex: 14, con: 14, int: 12, wis: 10, cha: 18 },
  conditions: [],
  speed: 30,
} as unknown as Character

describe('CharacterDetailPanel', () => {
  it('生命值输入时立即解析有效数值，并允许暂时清空输入框', () => {
    expect(parseLiveHitPointDraft('79', 94)).toBe(79)
    expect(parseLiveHitPointDraft('120', 94)).toBe(94)
    expect(parseLiveHitPointDraft('-3', 94)).toBe(0)
    expect(parseLiveHitPointDraft('', 94)).toBeUndefined()
    expect(parseLiveHitPointDraft('invalid', 94)).toBeUndefined()
  })

  it('使用与地图一致的人物 Token，而不是旧 emoji', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character,
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))

    expect(markup).toContain('data:image/png;base64,character-token')
    expect(markup).toContain('新冒险者的地图 Token')
    expect(markup).not.toContain('>🧝<')
  })

  it('初始生命值输入显示权威角色数值', () => {
    const markup = renderToStaticMarkup(createElement(CharacterDetailPanel, {
      token,
      character,
      onSetHitPoints: () => undefined,
      onClose: () => undefined,
      isDM: true,
    }))

    expect(markup).toContain('value="79"')
    expect(markup).toContain('value="94"')
  })
})
