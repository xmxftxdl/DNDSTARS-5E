import { describe, expect, it } from 'vitest'
import { dnd5eTokenStatusMarkerStyle } from './dnd5eTokenStatusMarkerPresentation'

describe('D&D 5e Token status marker presentation', () => {
  it('uses the Disguise Self artwork for the disguise marker', () => {
    expect(dnd5eTokenStatusMarkerStyle('disguised')).toMatchObject({
      glyph: '幻',
      icon: '/assets/icons/disguise-self-spell-action.png',
    })
  })

  it('uses the Imprisonment artwork for every imprisonment mode marker', () => {
    expect(dnd5eTokenStatusMarkerStyle('imprisoned')).toMatchObject({
      glyph: '禁',
      icon: '/assets/icons/imprisonment-spell-action.png',
    })
  })

  it('uses the Cone of Cold artwork for a frozen statue marker', () => {
    expect(dnd5eTokenStatusMarkerStyle('frozen-statue')).toMatchObject({
      glyph: '冰',
      icon: '/assets/icons/cone-of-cold-spell-action.png',
      stroke: '#7dd3fc',
    })
  })

  it('uses the Plane Shift artwork for a transported marker', () => {
    expect(dnd5eTokenStatusMarkerStyle('plane-shifted')).toMatchObject({
      glyph: '界',
      icon: '/assets/icons/plane-shift-spell-action.png',
      stroke: '#a78bfa',
    })
  })
})
