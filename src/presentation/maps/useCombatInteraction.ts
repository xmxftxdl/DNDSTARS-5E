import { useState } from 'react'
import type { GridCell } from '../../lib/gridCombat'
import type {
  Dnd5eWeaponAttackOptions,
} from '../../lib/sharedCombatTypes'
import type {
  Dnd5ePluginTargeting,
} from '../../application/combat/dnd5eCombatRules'
import type { Dnd5eSpellTargetingSession } from '../../application/combat/spells/SpellTargetingContracts'
export type { Dnd5eSpellTargetingSession } from '../../application/combat/spells/SpellTargetingContracts'
import type { Dnd5eInventoryTargeting } from '../../types/inventory'

export interface Dnd5eItemAreaTargetingSession {
  characterId: string
  instanceId: string
  itemName: string
  targeting: Extract<Dnd5eInventoryTargeting, { kind: 'map-area' }>
}

export interface Dnd5ePluginAreaTargetingSession {
  source: 'plugin' | 'dragonborn-breath'
  characterId: string
  featureId: string
  featureName: string
  targeting: Extract<Dnd5ePluginTargeting, { kind: 'area' }>
}

export interface Dnd5eItemCreatureTargetingSession {
  characterId: string
  instanceId: string
  itemName: string
  targeting: Extract<Dnd5eInventoryTargeting, { kind: 'creature' }>
}

/** Browser-only targeting and preview state. No authoritative combat facts live here. */
export function useCombatInteraction() {
  const [dnd5eWeaponTargeting, setDnd5eWeaponTargeting] = useState<string | null>(null)
  const [dnd5eWeaponAttackOptions, setDnd5eWeaponAttackOptions] =
    useState<Dnd5eWeaponAttackOptions>()
  const [dnd5eSpellTargeting, setDnd5eSpellTargeting] = useState<Dnd5eSpellTargetingSession | null>(null)
  const [dnd5eItemAreaTargeting, setDnd5eItemAreaTargeting] = useState<Dnd5eItemAreaTargetingSession | null>(null)
  const [dnd5ePluginAreaTargeting, setDnd5ePluginAreaTargeting] = useState<Dnd5ePluginAreaTargetingSession | null>(null)
  const [dnd5eExtraActionTeleportTargeting, setDnd5eExtraActionTeleportTargeting] = useState<{ characterId: string } | null>(null)
  const [dnd5eItemCreatureTargeting, setDnd5eItemCreatureTargeting] = useState<Dnd5eItemCreatureTargetingSession | null>(null)
  const [aoePreviewCell, setAoePreviewCell] = useState<GridCell | null>(null)
  const [aoeRectRotation, setAoeRectRotation] = useState(0)

  return {
    dnd5eWeaponTargeting,
    setDnd5eWeaponTargeting,
    dnd5eWeaponAttackOptions,
    setDnd5eWeaponAttackOptions,
    dnd5eSpellTargeting,
    setDnd5eSpellTargeting,
    dnd5eItemAreaTargeting,
    setDnd5eItemAreaTargeting,
    dnd5ePluginAreaTargeting,
    setDnd5ePluginAreaTargeting,
    dnd5eExtraActionTeleportTargeting,
    setDnd5eExtraActionTeleportTargeting,
    dnd5eItemCreatureTargeting,
    setDnd5eItemCreatureTargeting,
    aoePreviewCell,
    setAoePreviewCell,
    aoeRectRotation,
    setAoeRectRotation,
  }
}
