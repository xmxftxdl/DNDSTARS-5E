import { dnd5eMonsterCoreSpellCompatibility } from './monsterAdvancedAbilities'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import { dnd5eMonsterMultiattackChildIsCompositeSupported } from './monsterCompositeMultiattack'
import {
  DND5E_SRD_MONSTERS,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterAutomation,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import { getDnd5eSrdCombatSpell } from './spells'

export const DND5E_MONSTER_ACTION_SECTIONS = [
  'actions',
  'bonusActions',
  'reactions',
  'legendaryActions',
  'lairActions',
] as const

export type Dnd5eMonsterActionSection = typeof DND5E_MONSTER_ACTION_SECTIONS[number]

export type Dnd5eMonsterActionStructure =
  | 'weapon'
  | 'multiattack'
  | 'unparsed-multiattack'
  | 'rule'
  | 'reference'
  | 'none'

export type Dnd5eMonsterActionEffectiveAutomation =
  | 'headless'
  | 'dm-adjudication'
  | 'unstructured'
  | 'blocked-by-child'
  | 'invalid'

export type Dnd5eMonsterActionCoverageReason =
  | 'invalid-action'
  | 'explicit-dm-adjudication'
  | 'no-structured-rule'
  | 'multiattack-child-missing'
  | 'multiattack-child-not-headless'
  | 'multiattack-child-unsupported'

export interface Dnd5eMonsterActionCoverageRow {
  monsterId: string
  slug: string
  section: Dnd5eMonsterActionSection
  actionId: string
  actionName: string
  kind: Dnd5eMonsterAction['kind']
  declaredAutomation: Dnd5eMonsterAutomation | 'implicit'
  effectiveAutomation: Dnd5eMonsterActionEffectiveAutomation
  structure: Dnd5eMonsterActionStructure
  blockedChildIds: readonly string[]
  reasonCodes: readonly Dnd5eMonsterActionCoverageReason[]
}

export interface Dnd5eMonsterSpellOccurrenceCoverageRow {
  monsterId: string
  slug: string
  spellId: string
  spellName: string
  declaredAutomation: Dnd5eMonsterAutomation
  definition: 'present' | 'missing'
  compatibility: 'full' | 'manual' | 'missing'
  reason?: string
}

export interface Dnd5eMonsterTraitCoverageRow {
  monsterId: string
  slug: string
  traitIndex: number
  traitName: string
  declaredAutomation: Dnd5eMonsterAutomation | 'implicit'
  hasRule: boolean
  effectiveAutomation:
    | 'headless-with-rule'
    | 'headless-without-rule'
    | 'dm-adjudication'
    | 'implicit'
}

export interface Dnd5eMonsterDamageDefenseCoverageRow {
  monsterId: string
  slug: string
  conditionalRuleCount: number
  unparsedClauses: readonly {
    outcome: 'immune' | 'resistant' | 'vulnerable'
    text: string
  }[]
}

export interface Dnd5eMonsterHeadlessCoverageReport {
  schemaVersion: 1
  monsterCount: number
  actions: {
    rows: readonly Dnd5eMonsterActionCoverageRow[]
    summary: {
      total: number
      declared: {
        headless: number
        dmAdjudication: number
        implicit: number
      }
      effective: {
        headless: number
        dmAdjudication: number
        unstructured: number
        blockedByChild: number
        invalid: number
      }
      multiattack: {
        total: number
        headless: number
        incomplete: number
        unparsed: number
      }
    }
  }
  spells: {
    occurrences: readonly Dnd5eMonsterSpellOccurrenceCoverageRow[]
    summary: {
      total: number
      full: number
      manual: number
      missing: number
      compatibilityRate: number
    }
  }
  traits: {
    rows: readonly Dnd5eMonsterTraitCoverageRow[]
    summary: {
      total: number
      headlessWithRule: number
      headlessWithoutRule: number
      dmAdjudication: number
      implicit: number
    }
  }
  damageDefenses: {
    rows: readonly Dnd5eMonsterDamageDefenseCoverageRow[]
    summary: {
      monstersWithConditionalRules: number
      conditionalRuleCount: number
      monstersWithUnparsedClauses: number
      unparsedClauseCount: number
    }
  }
}

/**
 * Monotonic coverage floor for the checked-in SRD catalog.
 *
 * These values deliberately measure executable structure, rather than names or
 * prose that merely look like a supported rule:
 * - actions must pass the action schema and, for Multiattack, every referenced
 *   child must be supported by the composite transaction;
 * - spells must have a structured core definition accepted by the monster spell
 *   compatibility gate;
 * - traits only count when they explicitly declare Headless automation and carry
 *   a structured rule payload.
 *
 * Raising a floor (or lowering a maximum) is expected when coverage improves.
 * Lowering one requires an explicit review because it permits a regression.
 */
export const DND5E_MONSTER_HEADLESS_COVERAGE_RATCHET = {
  schemaVersion: 1,
  monsterCount: 334,
  actions: {
    total: 1056,
    headlessMinimum: 931,
    dmAdjudicationMaximum: 31,
    unstructuredMaximum: 94,
    blockedByChildMaximum: 0,
    invalidMaximum: 0,
    multiattack: {
      total: 240,
      headlessMinimum: 240,
      incompleteMaximum: 0,
      unparsedMaximum: 0,
    },
  },
  spells: {
    occurrenceTotal: 313,
    fullMinimum: 94,
    definedMinimum: 159,
    missingMaximum: 154,
  },
  traits: {
    total: 551,
    headlessWithRuleMinimum: 139,
    headlessWithoutRuleMaximum: 0,
    dmAdjudicationMaximum: 412,
  },
} as const

export interface Dnd5eMonsterHeadlessCoverageRatchetResult {
  passed: boolean
  violations: readonly string[]
}

function requireExact(
  violations: string[],
  label: string,
  actual: number,
  expected: number,
): void {
  if (actual !== expected) violations.push(`${label}: expected ${expected}, received ${actual}`)
}

function requireMinimum(
  violations: string[],
  label: string,
  actual: number,
  minimum: number,
): void {
  if (actual < minimum) violations.push(`${label}: minimum ${minimum}, received ${actual}`)
}

function requireMaximum(
  violations: string[],
  label: string,
  actual: number,
  maximum: number,
): void {
  if (actual > maximum) violations.push(`${label}: maximum ${maximum}, received ${actual}`)
}

export function verifyDnd5eMonsterHeadlessCoverageRatchet(
  report: Dnd5eMonsterHeadlessCoverageReport,
): Dnd5eMonsterHeadlessCoverageRatchetResult {
  const ratchet = DND5E_MONSTER_HEADLESS_COVERAGE_RATCHET
  const action = report.actions.summary
  const spell = report.spells.summary
  const trait = report.traits.summary
  const violations: string[] = []

  requireExact(violations, 'monsters.total', report.monsterCount, ratchet.monsterCount)
  requireExact(violations, 'actions.total', action.total, ratchet.actions.total)
  requireExact(
    violations,
    'actions.declared.partition',
    action.declared.headless + action.declared.dmAdjudication + action.declared.implicit,
    action.total,
  )
  requireExact(
    violations,
    'actions.effective.partition',
    action.effective.headless + action.effective.dmAdjudication +
      action.effective.unstructured + action.effective.blockedByChild + action.effective.invalid,
    action.total,
  )
  requireMinimum(
    violations,
    'actions.headless',
    action.effective.headless,
    ratchet.actions.headlessMinimum,
  )
  requireMaximum(
    violations,
    'actions.dmAdjudication',
    action.effective.dmAdjudication,
    ratchet.actions.dmAdjudicationMaximum,
  )
  requireMaximum(
    violations,
    'actions.unstructured',
    action.effective.unstructured,
    ratchet.actions.unstructuredMaximum,
  )
  requireMaximum(
    violations,
    'actions.blockedByChild',
    action.effective.blockedByChild,
    ratchet.actions.blockedByChildMaximum,
  )
  requireMaximum(
    violations,
    'actions.invalid',
    action.effective.invalid,
    ratchet.actions.invalidMaximum,
  )
  requireExact(
    violations,
    'actions.multiattack.total',
    action.multiattack.total,
    ratchet.actions.multiattack.total,
  )
  requireMinimum(
    violations,
    'actions.multiattack.headless',
    action.multiattack.headless,
    ratchet.actions.multiattack.headlessMinimum,
  )
  requireMaximum(
    violations,
    'actions.multiattack.incomplete',
    action.multiattack.incomplete,
    ratchet.actions.multiattack.incompleteMaximum,
  )
  requireMaximum(
    violations,
    'actions.multiattack.unparsed',
    action.multiattack.unparsed,
    ratchet.actions.multiattack.unparsedMaximum,
  )
  const unprovenActionRows = report.actions.rows.filter((row) =>
    row.effectiveAutomation === 'headless' &&
    (row.blockedChildIds.length > 0 || row.reasonCodes.length > 0))
  requireMaximum(
    violations,
    'actions.headlessWithoutExecutableEvidence',
    unprovenActionRows.length,
    0,
  )

  requireExact(violations, 'spells.occurrences', spell.total, ratchet.spells.occurrenceTotal)
  requireExact(
    violations,
    'spells.partition',
    spell.full + spell.manual + spell.missing,
    spell.total,
  )
  requireMinimum(violations, 'spells.full', spell.full, ratchet.spells.fullMinimum)
  requireMinimum(
    violations,
    'spells.defined',
    spell.full + spell.manual,
    ratchet.spells.definedMinimum,
  )
  requireMaximum(violations, 'spells.missing', spell.missing, ratchet.spells.missingMaximum)
  requireMaximum(
    violations,
    'spells.fullWithoutDefinition',
    report.spells.occurrences.filter((row) =>
      row.compatibility === 'full' && row.definition !== 'present').length,
    0,
  )

  requireExact(violations, 'traits.total', trait.total, ratchet.traits.total)
  requireExact(
    violations,
    'traits.partition',
    trait.headlessWithRule + trait.headlessWithoutRule + trait.dmAdjudication + trait.implicit,
    trait.total,
  )
  requireMinimum(
    violations,
    'traits.headlessWithRule',
    trait.headlessWithRule,
    ratchet.traits.headlessWithRuleMinimum,
  )
  requireMaximum(
    violations,
    'traits.headlessWithoutRule',
    trait.headlessWithoutRule,
    ratchet.traits.headlessWithoutRuleMaximum,
  )
  requireMaximum(
    violations,
    'traits.dmAdjudication',
    trait.dmAdjudication,
    ratchet.traits.dmAdjudicationMaximum,
  )
  requireMaximum(
    violations,
    'traits.headlessWithoutExecutableEvidence',
    report.traits.rows.filter((row) =>
      row.effectiveAutomation === 'headless-with-rule' &&
      (row.declaredAutomation !== 'headless' || !row.hasRule)).length,
    0,
  )

  return { passed: violations.length === 0, violations }
}

function actionStructure(action: Dnd5eMonsterAction): Dnd5eMonsterActionStructure {
  if (action.referencedActionId) return 'reference'
  if (action.kind === 'weapon-attack') return 'weapon'
  if (action.kind === 'multiattack') return 'multiattack'
  if (
    action.id.toLowerCase() === 'multiattack' ||
    /^(?:multiattack|多重攻击)$/i.test(action.name.trim())
  ) return 'unparsed-multiattack'
  if (action.rule) return 'rule'
  return 'none'
}

function multiattackBlockers(
  monster: Dnd5eMonsterStatBlock,
  action: Dnd5eMonsterAction,
): {
  childIds: readonly string[]
  reasons: readonly Dnd5eMonsterActionCoverageReason[]
} {
  if (action.kind !== 'multiattack') return { childIds: [], reasons: [] }
  const childIds: string[] = []
  const reasons: Dnd5eMonsterActionCoverageReason[] = []
  const referencedChildIds = action.randomRepeat
    ? [action.randomRepeat.actionId]
    : action.sequence ?? []
  for (const childId of referencedChildIds) {
    const child = monster.actions.find((candidate) => candidate.id === childId)
    if (!child) {
      childIds.push(childId)
      reasons.push('multiattack-child-missing')
      continue
    }
    if (dnd5eMonsterActionAutomation(child) !== 'headless') {
      childIds.push(childId)
      reasons.push('multiattack-child-not-headless')
      continue
    }
    if (!dnd5eMonsterMultiattackChildIsCompositeSupported(child)) {
      childIds.push(childId)
      reasons.push('multiattack-child-unsupported')
    }
  }
  return {
    childIds: [...new Set(childIds)],
    reasons: [...new Set(reasons)],
  }
}

function auditAction(
  monster: Dnd5eMonsterStatBlock,
  section: Dnd5eMonsterActionSection,
  action: Dnd5eMonsterAction,
): Dnd5eMonsterActionCoverageRow {
  const declaredAutomation = action.automation ?? 'implicit'
  const baseAutomation = dnd5eMonsterActionAutomation(action)
  const structure = actionStructure(action)
  const blockers = multiattackBlockers(monster, action)
  let effectiveAutomation: Dnd5eMonsterActionEffectiveAutomation
  const reasonCodes: Dnd5eMonsterActionCoverageReason[] = [...blockers.reasons]

  if (baseAutomation === 'invalid') {
    effectiveAutomation = 'invalid'
    reasonCodes.push('invalid-action')
  } else if (blockers.childIds.length > 0) {
    effectiveAutomation = 'blocked-by-child'
  } else if (baseAutomation === 'headless') {
    effectiveAutomation = 'headless'
  } else if (structure === 'none') {
    effectiveAutomation = 'unstructured'
    reasonCodes.push('no-structured-rule')
  } else {
    effectiveAutomation = 'dm-adjudication'
    reasonCodes.push('explicit-dm-adjudication')
  }

  return {
    monsterId: monster.id,
    slug: monster.slug,
    section,
    actionId: action.id,
    actionName: action.name,
    kind: action.kind,
    declaredAutomation,
    effectiveAutomation,
    structure,
    blockedChildIds: blockers.childIds,
    reasonCodes: [...new Set(reasonCodes)],
  }
}

function countWhere<T>(rows: readonly T[], predicate: (row: T) => boolean): number {
  return rows.reduce((count, row) => count + (predicate(row) ? 1 : 0), 0)
}

export function auditDnd5eMonsterHeadlessCoverage(
  monsters: readonly Dnd5eMonsterStatBlock[] = DND5E_SRD_MONSTERS,
): Dnd5eMonsterHeadlessCoverageReport {
  const actionRows = monsters.flatMap((monster) =>
    DND5E_MONSTER_ACTION_SECTIONS.flatMap((section) =>
      (monster[section] ?? []).map((action) => auditAction(monster, section, action))))

  const spellOccurrences = monsters.flatMap((monster) =>
    (monster.spellcasting?.spells ?? []).map((listedSpell): Dnd5eMonsterSpellOccurrenceCoverageRow => {
      const definition = getDnd5eSrdCombatSpell(listedSpell.id)
      if (!definition) {
        return {
          monsterId: monster.id,
          slug: monster.slug,
          spellId: listedSpell.id,
          spellName: listedSpell.name,
          declaredAutomation: monster.spellcasting!.automation,
          definition: 'missing',
          compatibility: 'missing',
          reason: 'No core Headless spell definition.',
        }
      }
      const compatibility = dnd5eMonsterCoreSpellCompatibility(definition)
      return {
        monsterId: monster.id,
        slug: monster.slug,
        spellId: listedSpell.id,
        spellName: listedSpell.name,
        declaredAutomation: monster.spellcasting!.automation,
        definition: 'present',
        compatibility: compatibility.automation,
        ...(compatibility.reason ? { reason: compatibility.reason } : {}),
      }
    }))

  const traitRows = monsters.flatMap((monster) =>
    monster.traits.map((trait, traitIndex): Dnd5eMonsterTraitCoverageRow => {
      const declaredAutomation = trait.automation ?? 'implicit'
      const hasRule = !!trait.rule
      return {
        monsterId: monster.id,
        slug: monster.slug,
        traitIndex,
        traitName: trait.name,
        declaredAutomation,
        hasRule,
        effectiveAutomation: declaredAutomation === 'headless'
          ? hasRule ? 'headless-with-rule' : 'headless-without-rule'
          : declaredAutomation === 'dm-adjudication' ? 'dm-adjudication' : 'implicit',
      }
    }))

  const damageDefenseRows = monsters.map((monster): Dnd5eMonsterDamageDefenseCoverageRow => ({
    monsterId: monster.id,
    slug: monster.slug,
    conditionalRuleCount: monster.damageDefenseRules?.length ?? 0,
    unparsedClauses: monster.unparsedDamageDefenses?.map((entry) => ({ ...entry })) ?? [],
  }))

  const fullSpells = countWhere(spellOccurrences, (row) => row.compatibility === 'full')
  const multiattackRows = actionRows.filter((row) =>
    row.structure === 'multiattack' || row.structure === 'unparsed-multiattack')
  const headlessMultiattacks = countWhere(
    multiattackRows,
    (row) => row.effectiveAutomation === 'headless',
  )
  return {
    schemaVersion: 1,
    monsterCount: monsters.length,
    actions: {
      rows: actionRows,
      summary: {
        total: actionRows.length,
        declared: {
          headless: countWhere(actionRows, (row) => row.declaredAutomation === 'headless'),
          dmAdjudication: countWhere(actionRows, (row) => row.declaredAutomation === 'dm-adjudication'),
          implicit: countWhere(actionRows, (row) => row.declaredAutomation === 'implicit'),
        },
        effective: {
          headless: countWhere(actionRows, (row) => row.effectiveAutomation === 'headless'),
          dmAdjudication: countWhere(actionRows, (row) => row.effectiveAutomation === 'dm-adjudication'),
          unstructured: countWhere(actionRows, (row) => row.effectiveAutomation === 'unstructured'),
          blockedByChild: countWhere(actionRows, (row) => row.effectiveAutomation === 'blocked-by-child'),
          invalid: countWhere(actionRows, (row) => row.effectiveAutomation === 'invalid'),
        },
        multiattack: {
          total: multiattackRows.length,
          headless: headlessMultiattacks,
          incomplete: multiattackRows.length - headlessMultiattacks,
          unparsed: countWhere(
            multiattackRows,
            (row) => row.structure === 'unparsed-multiattack',
          ),
        },
      },
    },
    spells: {
      occurrences: spellOccurrences,
      summary: {
        total: spellOccurrences.length,
        full: fullSpells,
        manual: countWhere(spellOccurrences, (row) => row.compatibility === 'manual'),
        missing: countWhere(spellOccurrences, (row) => row.compatibility === 'missing'),
        compatibilityRate: spellOccurrences.length > 0 ? fullSpells / spellOccurrences.length : 1,
      },
    },
    traits: {
      rows: traitRows,
      summary: {
        total: traitRows.length,
        headlessWithRule: countWhere(traitRows, (row) => row.effectiveAutomation === 'headless-with-rule'),
        headlessWithoutRule: countWhere(traitRows, (row) => row.effectiveAutomation === 'headless-without-rule'),
        dmAdjudication: countWhere(traitRows, (row) => row.effectiveAutomation === 'dm-adjudication'),
        implicit: countWhere(traitRows, (row) => row.effectiveAutomation === 'implicit'),
      },
    },
    damageDefenses: {
      rows: damageDefenseRows,
      summary: {
        monstersWithConditionalRules: countWhere(
          damageDefenseRows,
          (row) => row.conditionalRuleCount > 0,
        ),
        conditionalRuleCount: damageDefenseRows.reduce(
          (sum, row) => sum + row.conditionalRuleCount,
          0,
        ),
        monstersWithUnparsedClauses: countWhere(
          damageDefenseRows,
          (row) => row.unparsedClauses.length > 0,
        ),
        unparsedClauseCount: damageDefenseRows.reduce(
          (sum, row) => sum + row.unparsedClauses.length,
          0,
        ),
      },
    },
  }
}
