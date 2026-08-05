import { describe, expect, it } from 'vitest'
import type { CombatLogEntry } from '../../lib/sharedCombatTypes'
import type { Token } from '../../store/maps'
import type { Character } from '../../types/character'
import {
  dnd5eCharacterPresentationColors,
  inferCombatLogActorTokenId,
  resolveCombatLogSubject,
  resolveHeadlessCombatLogActorTokenId,
} from './combatLogPresentation'

function token(patch: Partial<Token> & Pick<Token, 'id' | 'label' | 'type'>): Token {
  return {
    x: 0,
    y: 0,
    color: '#94a3b8',
    emoji: '',
    size: 1,
    ...patch,
  }
}

function entry(patch: Partial<CombatLogEntry> = {}): CombatLogEntry {
  return {
    id: 1,
    round: 1,
    text: '哥布林攻击法师',
    kind: 'attack',
    time: '10:00',
    ...patch,
  }
}

const wizard = {
  id: 'wizard-character',
  name: '法师',
  avatar: '🧙',
  charClass: 'wizard',
  dnd5eClassLevels: { wizard: 5 },
  tokenPortrait: '/wizard-token.png',
} as Character

const wizardToken = token({
  id: 'wizard-token',
  label: '法师',
  type: 'player',
  characterId: wizard.id,
})
const goblinToken = token({
  id: 'goblin-token',
  label: '哥布林',
  type: 'enemy',
  poolId: 'srd-5.1:goblin',
  portraitImageId: 'uploaded-goblin',
})

describe('combat log subject presentation', () => {
  it('keeps the solid combat border, light status frame and glow as separate class colors', () => {
    expect(dnd5eCharacterPresentationColors(wizard)).toMatchObject({
      accentColor: '#3B82F6',
      statusBorderColor: '#DBEAFE',
      glowColor: '#60A5FA',
      classId: 'wizard',
    })
  })

  it('uses stable actorTokenId before target names and applies the player class border', () => {
    const subject = resolveCombatLogSubject({
      entry: entry({ actorTokenId: wizardToken.id }),
      tokens: [goblinToken, wizardToken],
      characters: [wizard],
    })

    expect(subject).toMatchObject({
      token: wizardToken,
      resolution: 'actor-token-id',
      side: 'player',
      classId: 'wizard',
      borderColor: '#3B82F6',
      portrait: '/wizard-token.png',
    })
  })

  it('uses monster template art while preserving an uploaded portraitImageId', () => {
    const subject = resolveCombatLogSubject({
      entry: entry({ actorTokenId: goblinToken.id }),
      tokens: [goblinToken],
      characters: [],
    })

    expect(subject).toMatchObject({
      resolution: 'actor-token-id',
      side: 'monster',
      borderColor: '#EF4444',
      portraitImageId: 'uploaded-goblin',
      portrait: '/assets/portraits/goblin-forest-scout-token.png',
    })
  })

  it('keeps legacy text fallback and resolves Headless actor/source entity ids', () => {
    expect(resolveCombatLogSubject({
      entry: entry({ actorTokenId: undefined }),
      tokens: [wizardToken, goblinToken],
      characters: [wizard],
    }).token?.id).toBe(goblinToken.id)

    expect(resolveHeadlessCombatLogActorTokenId(
      [{ actorId: wizard.id, sourceId: goblinToken.id }],
      [wizardToken, goblinToken],
    )).toBe(wizardToken.id)
  })

  it('keeps round-boundary rows actorless instead of borrowing the first token of the new round', () => {
    const roundEntry = entry({
      round: 2,
      text: '进入第 2 回合',
      kind: 'turn',
      actorTokenId: goblinToken.id,
    })

    expect(inferCombatLogActorTokenId({
      text: roundEntry.text,
      kind: roundEntry.kind,
      tokens: [goblinToken, wizardToken],
      characters: [wizard],
      currentTurnTokenId: goblinToken.id,
    })).toBeUndefined()
    const subject = resolveCombatLogSubject({
      entry: roundEntry,
      tokens: [goblinToken, wizardToken],
      characters: [wizard],
      currentTurnTokenId: goblinToken.id,
    })
    expect(subject).toMatchObject({
      side: 'neutral',
      resolution: 'neutral',
    })
    expect(subject.token).toBeUndefined()
  })
})
