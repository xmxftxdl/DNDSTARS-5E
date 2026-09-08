import { describe, expect, it } from 'vitest'
import {
  playerGeometryDoorClickRoute,
  playerGeometryDoorInteractionOptions,
} from './playerGeometryDoorInteraction'
import type { MapGeometryDoor } from '../../lib/mapGeometry'

const door = (patch: Partial<MapGeometryDoor> = {}): MapGeometryDoor => {
  const base: MapGeometryDoor = {
    id: 'door', kind: 'door', label: '石门',
    points: [{ x: 0, y: 0 }, { x: 50, y: 0 }],
    state: 'closed', openState: 'closed', lockState: 'unlocked', physicalState: 'intact',
    baseHeightFeet: 0, heightFeet: 10,
    blocksVision: true, blocksMovement: true, blocksLineOfEffect: true,
    secret: false, createdAt: 1,
  }
  return { ...base, ...patch }
}

describe('playerGeometryDoorClickRoute', () => {
  it('routes an ordinary player door click to the interaction menu', () => {
    expect(playerGeometryDoorClickRoute({
      isDM: false,
      isSpectator: false,
      spellAoeSelectActive: false,
    })).toBe('door-interaction')
  })

  it('preserves door targeting for an active spell point picker', () => {
    expect(playerGeometryDoorClickRoute({
      isDM: false,
      isSpectator: false,
      spellAoeSelectActive: true,
    })).toBe('spell-target')
  })

  it.each([
    { isDM: true, isSpectator: false },
    { isDM: false, isSpectator: true },
  ])('does not expose player door interaction for $isDM/$isSpectator', (role) => {
    expect(playerGeometryDoorClickRoute({
      ...role,
      spellAoeSelectActive: true,
    })).toBe('ignore')
  })

  it('offers direct open and force for an ordinary closed door', () => {
    expect(playerGeometryDoorInteractionOptions({
      door: door(), actorTokenId: 'actor', hasMatchingKey: false, hasThievesTools: false,
    }).map((option) => option.id)).toEqual(['open', 'break'])
  })

  it('offers owned key and thieves tools for a locked door', () => {
    expect(playerGeometryDoorInteractionOptions({
      door: door({ state: 'locked', lockState: 'locked' }), actorTokenId: 'actor',
      hasMatchingKey: true, hasThievesTools: true,
    }).map((option) => option.id)).toEqual(['key', 'thieves-tools', 'break'])
  })

  it('only offers close for an open door', () => {
    expect(playerGeometryDoorInteractionOptions({
      door: door({ state: 'open', openState: 'open' }), actorTokenId: 'actor',
      hasMatchingKey: false, hasThievesTools: false,
    }).map((option) => option.id)).toEqual(['close'])
  })
})
