import type { Character } from './character'
import type { Dnd5eTimedEffect } from '../rulesets/dnd5e/timedEffects'

export interface LegacyTrait {
  id: string
  name: string
  level: number
  uses: number
  maxUses: number
  description: string
  featureKey?: string
}

export interface LegacyCombatSkill {
  id: string
  name: string
  emoji: string
  description: string
  apCost: number
  cooldown: number
  cdReduction: number
  remaining: number
  usedThisTurn: boolean
  damageCount: number
  damageSides: number
  damageBonus: number
  [key: string]: unknown
}

export type LegacyCharacterSave = Omit<Partial<Character>, 'rulesetId' | 'dnd5eCombatState'> & {
  rulesetId?: 'dnd5e-2014-srd-5.1' | 'dnd5e-srd-5.2.1'
  actionPoints?: number
  currentAP?: number
  mana?: number
  maxMana?: number
  traits?: LegacyTrait[]
  combatSkills?: LegacyCombatSkill[]
  heroicInspiration?: boolean
  archerLv1ChoiceDone?: boolean
  archerLv3ChoiceDone?: boolean
  traitChoicesDone?: Record<string, boolean>
  combatBuffs?: Record<string, unknown>
  featureUpgradePoints?: number
  skillRanks?: Record<string, number>
  qi?: number
  bulletPuzzle?: unknown
  dnd5eCombatState?: NonNullable<Character['dnd5eCombatState']> & {
    timedEffects?: Dnd5eTimedEffect[]
  }
}
