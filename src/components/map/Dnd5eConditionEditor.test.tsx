import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { createDnd5eMechanicalEffect } from '../../rulesets/dnd5e/activeEffects'
import Dnd5eConditionEditor, { dnd5eConditionButtonRemovesExisting } from './Dnd5eConditionEditor'

describe('Dnd5eConditionEditor custom statuses', () => {
  it('offers the shared custom status creator for characters and monsters', () => {
    const markup = renderToStaticMarkup(
      <Dnd5eConditionEditor conditions={[]} activeEffects={[]} onChange={() => {}} />,
    )

    expect(markup).toContain('data-testid="dnd5e-custom-status-name"')
    expect(markup).toContain('data-testid="dnd5e-add-custom-status"')
    expect(markup).toContain('data-testid="dnd5e-custom-status-category"')
    expect(markup).toContain('data-testid="dnd5e-custom-status-magical"')
    expect(markup).not.toContain('角色与怪物共用')
  })

  it('adds another standard-condition instance when stacking is allowed', () => {
    expect(dnd5eConditionButtonRemovesExisting(true, 'stack')).toBe(false)
    expect(dnd5eConditionButtonRemovesExisting(true, 'refresh-duration')).toBe(true)
  })

  it('disables a condition granted as an immunity by an active spell effect', () => {
    const brandingSmite = createDnd5eMechanicalEffect({
      definitionId: 'activity:branding-smite:on-hit-target',
      label: '印记斩',
      source: { kind: 'spell', actorId: 'paladin', rulesId: 'branding-smite' },
      targetId: 'armor',
      modifiers: { conditionImmunities: ['invisible'] },
    })
    const markup = renderToStaticMarkup(
      <Dnd5eConditionEditor conditions={[]} activeEffects={[brandingSmite]} onChange={() => {}} />,
    )

    expect(markup).toMatch(/data-testid="dnd5e-condition-toggle-invisible"[^>]*disabled/)
    expect(markup).toContain('隐形：目标免疫')
  })
})
