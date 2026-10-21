import weakenedIcon from './icons/condition-weakened.svg'
import { describe, expect, it } from 'vitest'
import { dnd5eTokenStatusMarkerStyle, dnd5eTokenStatusMarkerTooltip } from './dnd5eTokenStatusMarkerPresentation'
import { dnd5eTokenStatusMarkersFromActiveEffects } from '../../rulesets/dnd5e/tokenStatusMarkers'

describe('D&D 5e Token status marker presentation', () => {
  it('describes saved module dice and updates remaining duration without spell-name special cases', () => {
    const saved = JSON.parse(JSON.stringify({id:'test:boon',label:'检定祝福',legacyCondition:'community.check-boon.boon-mark',
      modifiers:{optionalBonusDie:{sides:6,appliesTo:['ability-check','saving-throw'],consumeOnUse:true}},
      duration:{type:'rounds',remainingRounds:10,tickOn:'target-turn-end'}}))
    const tooltip = () => dnd5eTokenStatusMarkerTooltip(dnd5eTokenStatusMarkersFromActiveEffects([saved])[0])
    expect(tooltip().description).toContain('1d6')
    expect(tooltip().description).toContain('属性／技能检定或豁免')
    expect(tooltip().description).toContain('使用后移除此效果')
    expect(tooltip().description).toContain('剩余 10 轮')
    expect(tooltip().description).not.toContain('地图标注')
    saved.duration.remainingRounds = 9
    saved.modifiers.optionalBonusDie.sides = 8
    expect(tooltip().description).toContain('剩余 9 轮')
    expect(tooltip().description).toContain('1d8')
    saved.modifiers.optionalBonusDie.consumeOnUse = false
    expect(tooltip().description).toContain('持续期间每次对应检定均可选择使用')
    expect(tooltip().description).not.toContain('使用后移除此效果')
  })
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

it('uses a dedicated weakness silhouette for enfeeblement badges', () => {
  expect(dnd5eTokenStatusMarkerStyle('weakened').icon).toBe(weakenedIcon)
})
