import { describe, expect, it } from 'vitest'
import { DND5E_STANDARD_CONDITION_IDS } from '../../rulesets/dnd5e/conditions'
import {
  MAP_SPELL_STATUS_IDS,
  concentrationTokenTooltip,
  overflowConditionTokenTooltip,
  spellStatusTokenTooltip,
  standardConditionTokenTooltip,
} from './tokenStatusTooltip'

describe('map Token status tooltips', () => {
  it('gives every standard condition a localized name and concrete rule summary', () => {
    for (const condition of DND5E_STANDARD_CONDITION_IDS) {
      const tooltip = standardConditionTokenTooltip(condition)
      expect(tooltip.title).not.toBe(condition)
      expect(tooltip.description.length).toBeGreaterThan(8)
    }

    expect(standardConditionTokenTooltip('prone')).toEqual({
      title: '倒地',
      description: expect.stringContaining('起身'),
    })
  })

  it('resolves every rendered spell status and keeps descriptions compact', () => {
    for (const statusId of MAP_SPELL_STATUS_IDS) {
      const tooltip = spellStatusTokenTooltip(statusId)
      expect(tooltip.title.length).toBeGreaterThan(0)
      expect(tooltip.description.length).toBeGreaterThan(8)
      expect(tooltip.description.length).toBeLessThanOrEqual(220)
    }

    expect(spellStatusTokenTooltip('guidance')).toMatchObject({
      title: expect.stringContaining('神导术'),
      description: expect.stringContaining('d4'),
    })
    expect(spellStatusTokenTooltip('monster-damage-aversion')).toMatchObject({
      title: '伤害畏避',
      description: expect.stringContaining('火焰伤害'),
    })
  })

  it('names the concentrated spell and lists hidden overflow conditions', () => {
    expect(concentrationTokenTooltip('flaming-sphere')).toMatchObject({
      title: expect.stringContaining('炽焰法球'),
      description: expect.stringContaining('体质豁免'),
    })
    expect(overflowConditionTokenTooltip(['blinded', 'prone'])).toEqual({
      title: '另有 2 个状态',
      description: '目盲、倒地',
    })
  })
})
