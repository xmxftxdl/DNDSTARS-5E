/** Stable Host resource identities, shared by runtime providers and import references. */
export const DND5E_RACIAL_STATIC_RESOURCES = {
  dragonbornBreath: { id: 'dnd5e-racial-dragonborn-breath', name: '龙裔吐息' },
  relentlessEndurance: { id: 'dnd5e-racial-half-orc-relentless-endurance', name: '顽强' },
} as const

export const DND5E_RACIAL_RESOURCE_KEYS = {
  dragonbornBreath: DND5E_RACIAL_STATIC_RESOURCES.dragonbornBreath.id,
  relentlessEndurance: DND5E_RACIAL_STATIC_RESOURCES.relentlessEndurance.id,
  innateSpell: (spellId: string) => `dnd5e-racial-spell-${spellId}`,
} as const
