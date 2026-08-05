import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import { normalizeCombatPresentationEvent } from '../../scripts/shared-server-core.mjs'
import CombatActionBanner from '../components/map/CombatActionBanner'
import {
  EMPTY_COMBAT_PRESENTATION_STATE,
  combatPresentationAttackTargetEffectsForMap,
  parseCombatPresentationEvent,
  reduceCombatPresentationState,
} from './combatPresentation'

const actionBanner = {
  schemaVersion: 1 as const,
  id: 'custom-monster-pulse:banner',
  type: 'attack-banner' as const,
  mapId: 'map',
  transactionId: 'custom-monster-pulse',
  sourceTokenId: 'monster',
  actorName: 'Custom Monster',
  attackName: 'Starfall Pulse',
  attackKind: 'action' as const,
  classId: 'monster',
  createdAt: 1_000,
  expiresAt: 4_500,
}

describe('generic combat action banners', () => {
  it('accepts newly-authored actions without a name allowlist', () => {
    expect(parseCombatPresentationEvent(actionBanner)).toEqual(actionBanner)
    expect(normalizeCombatPresentationEvent(
      { ...actionBanner, createdAt: undefined, expiresAt: undefined },
      { role: 'dm' },
      2_000,
    )).toMatchObject({
      ok: true,
      event: { attackKind: 'action', attackName: 'Starfall Pulse' },
    })
  })

  it('does not mistake a generic action for a target hit marker', () => {
    const state = reduceCombatPresentationState(
      EMPTY_COMBAT_PRESENTATION_STATE,
      actionBanner,
      1_000,
    )
    expect(combatPresentationAttackTargetEffectsForMap(state, {
      id: 'map',
      gridSize: 70,
      tokens: [{ id: 'monster', x: 70, y: 70 }],
    }, 1_100)).toEqual([])
  })

  it('renders a class-coloured generated icon for the custom action', () => {
    const html = renderToStaticMarkup(createElement(CombatActionBanner, {
      mode: 'attack',
      classId: 'monster',
      attackName: 'Starfall Pulse',
      attackKind: 'action',
    }))
    expect(html).toContain('Starfall Pulse')
    expect(html).toContain('data-class-backdrop="monster"')
    expect(html).toContain('--combat-banner-color:#7F1D1D')
  })

  it('accepts player custom spell ids in spell banners', () => {
    const customSpellBanner = {
      schemaVersion: 1 as const,
      id: 'player-custom-spell:banner',
      type: 'spell-banner' as const,
      mapId: 'map',
      transactionId: 'player-custom-spell',
      spellId: 'player.custom:aurora-lance',
      sourceTokenId: 'wizard',
      casterName: 'Player Wizard',
      spellName: 'Aurora Lance',
      castingClassId: 'wizard',
      createdAt: 1_000,
      expiresAt: 4_500,
    }
    expect(parseCombatPresentationEvent(customSpellBanner)).toEqual(customSpellBanner)
    expect(normalizeCombatPresentationEvent(
      { ...customSpellBanner, createdAt: undefined, expiresAt: undefined },
      { role: 'dm' },
      2_000,
    )).toMatchObject({
      ok: true,
      event: { spellId: 'player.custom:aurora-lance', spellName: 'Aurora Lance' },
    })
  })
})
