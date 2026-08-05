import { buildDnd5eCustomMonster, type Dnd5eCustomMonsterDraft } from './customMonsterWorkshop'
import {
  createDnd5eCombatant,
  resolveDnd5eHeadlessAction,
  startDnd5eHeadlessCombat,
  type Dnd5eCombatant,
  type Dnd5eCombatEvent,
  type Dnd5eMonsterOnHitEffectRoll,
} from './headlessCombatEngine'
import {
  dnd5eMonsterAreaSavingThrowEffect,
  getDnd5eSrdMonster,
  type Dnd5eMonsterAction,
  type Dnd5eMonsterDamage,
  type Dnd5eMonsterOnHitEffect,
  type Dnd5eMonsterSize,
  type Dnd5eMonsterStatBlock,
} from './monsters'
import { dnd5eMonsterActionAutomation } from './monsterSchema'
import { registerDnd5ePluginMonsterCatalogEntry } from './roomMonsterCatalog'

const SANDBOX_MONSTER_ID_PREFIX = 'room-monster:headless-sandbox-'
const SANDBOX_ACTOR_ID = 'monster-workshop-sandbox-actor'
const SANDBOX_TARGET_ID = 'monster-workshop-sandbox-target'

export interface Dnd5eMonsterWorkshopSandboxInput {
  draft: Dnd5eCustomMonsterDraft
  /** 当前工坊可见的自定义怪物目录；召唤事务必须验证被召唤模板真实存在。 */
  monsterCatalog?: readonly Dnd5eMonsterStatBlock[]
  actionId: string
  targetArmorClass: number
  targetHitPoints: number
  targetSavingThrowBonus?: number
  /** 传入后固定攻击或豁免的 d20，主要用于复现和自动化测试。 */
  d20?: number
  /** Host 负责预掷；测试可以注入确定性骰子源。 */
  randomDie?: (sides: number) => number
}

export interface Dnd5eMonsterWorkshopSandboxRolls {
  d20: number
  damageRolls: readonly (readonly number[])[]
  summonCountRolls?: readonly number[]
  attacks?: readonly {
    actionId: string
    actionName: string
    d20: number
    damageRolls: readonly (readonly number[])[]
    onHitEffectRolls?: readonly Dnd5eMonsterOnHitEffectRoll[]
  }[]
}

export interface Dnd5eMonsterWorkshopSandboxAttackResult {
  d20: number
  total: number
  armorClass: number
  hit: boolean
  critical: boolean
}

interface Dnd5eMonsterWorkshopSandboxBaseResult {
  actionId: string
  actionName: string
  targetHitPointsBefore: number
  targetHitPointsAfter: number
  damageApplied: number
  rolls: Dnd5eMonsterWorkshopSandboxRolls
  events: readonly Dnd5eCombatEvent[]
  eventSummaries: readonly string[]
}

export type Dnd5eMonsterWorkshopSandboxResult =
  | (Dnd5eMonsterWorkshopSandboxBaseResult & {
      ok: true
      kind: 'weapon-attack' | 'multiattack' | 'legendary-action' | 'bonus-action' | 'reaction'
      attack: Dnd5eMonsterWorkshopSandboxAttackResult
      attacks: readonly Dnd5eMonsterWorkshopSandboxAttackResult[]
      legendary?: { cost: number; remaining: number }
      save?: undefined
    })
  | (Dnd5eMonsterWorkshopSandboxBaseResult & {
      ok: true
      kind: 'area-saving-throw'
      save: {
        ability: string
        modifier: number
        total: number
        dc: number
        success: boolean
      }
      attack?: undefined
    })
  | (Dnd5eMonsterWorkshopSandboxBaseResult & {
      ok: true
      kind: 'summon'
      summon: {
        monsterId: string
        count: number
        timing: 'immediate' | 'source-next-turn-start'
        durationRounds: number
        concentration: boolean
        concentrationEndsOnAppearance: boolean
      }
      attack?: undefined
      attacks?: undefined
      save?: undefined
    })
  | {
      ok: false
      actionId: string
      actionName: string
      reason: string
      events: readonly Dnd5eCombatEvent[]
      eventSummaries: readonly string[]
    }

export interface Dnd5eMonsterWorkshopSandboxActionOption {
  id: string
  name: string
  kind: 'weapon-attack' | 'area-saving-throw' | 'summon' | 'multiattack' | 'legendary-action' | 'bonus-action' | 'reaction'
}

interface SandboxCatalogAction {
  action: Dnd5eMonsterAction
  category: 'action' | 'bonus-action' | 'reaction' | 'legendary'
}

function clampInteger(value: number, minimum: number, maximum: number): number {
  if (!Number.isFinite(value)) return minimum
  return Math.max(minimum, Math.min(maximum, Math.trunc(value)))
}

function defaultRandomDie(sides: number): number {
  return Math.floor(Math.random() * sides) + 1
}

function rollDie(randomDie: (sides: number) => number, sides: number): number {
  const value = randomDie(sides)
  if (!Number.isInteger(value) || value < 1 || value > sides) {
    throw new Error(`骰子源为 d${sides} 返回了无效结果：${value}`)
  }
  return value
}

function rollDamage(
  damage: Dnd5eMonsterDamage,
  randomDie: (sides: number) => number,
  critical: boolean,
): number[] {
  const count = Math.max(0, damage.count) * (critical ? 2 : 1)
  return Array.from({ length: count }, () => rollDie(randomDie, damage.sides))
}

function sandboxSupportsOnHitEffects(action: Dnd5eMonsterAction): boolean {
  return !(action.attack?.onHitEffects ?? []).some((effect) => effect.kind === 'forced-movement')
}

function prepareOnHitEffectRolls(
  effects: readonly Dnd5eMonsterOnHitEffect[],
  input: {
    d20: number
    randomDie: (sides: number) => number
    fixedD20: boolean
    targetSizeRank: number
  },
): Dnd5eMonsterOnHitEffectRoll[] {
  const effectD20 = () => input.fixedD20 ? input.d20 : rollDie(input.randomDie, 20)
  return effects.map((effect) => {
    const base: Dnd5eMonsterOnHitEffectRoll = { effectId: effect.id }
    if (effect.kind === 'forced-movement') {
      throw new Error(`命中后效果“${effect.id}”需要地图几何位移配方，当前隔离沙盒不能安全生成。`)
    }
    if (effect.kind === 'saving-throw-damage') {
      return {
        ...base,
        d20: effectD20(),
        damageRolls: effect.damage.map((damage) => rollDamage(damage, input.randomDie, false)),
      }
    }
    if (effect.kind === 'saving-throw-condition') return { ...base, d20: effectD20() }
    if (effect.kind === 'source-linked-condition') {
      return effect.savingThrow && input.targetSizeRank <= effect.relation.targetMaxSizeRank
        ? { ...base, d20: effectD20() }
        : base
    }
    if (effect.kind === 'persistent-effect' || effect.kind === 'hit-point-maximum-reduction') {
      return effect.savingThrow ? { ...base, d20: effectD20() } : base
    }
    return base
  })
}

function challengeProficiencyBonus(rating: string): number {
  const fraction = rating.match(/^\s*(\d+)\s*\/\s*(\d+)\s*$/)
  const challenge = fraction
    ? Number(fraction[1]) / Math.max(1, Number(fraction[2]))
    : Number(rating)
  if (!Number.isFinite(challenge) || challenge < 5) return 2
  if (challenge < 9) return 3
  if (challenge < 13) return 4
  if (challenge < 17) return 5
  return 6
}

function sizeRank(size: Dnd5eMonsterSize): number {
  return ['微型', '小型', '中型', '大型', '超大型', '巨型'].indexOf(size)
}

function temporaryMonsterId(): string {
  const suffix = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
    ? crypto.randomUUID().replaceAll('-', '')
    : `${Date.now().toString(36)}${Math.random().toString(36).slice(2)}`
  return `${SANDBOX_MONSTER_ID_PREFIX}${suffix}`
}

function eventSummaries(events: readonly Dnd5eCombatEvent[]): string[] {
  return events.flatMap((event) => {
    if (event.type === 'attack-resolved') {
      return [`攻击：d20 ${event.d20}，总值 ${event.total} 对 AC ${event.armorClass}，${event.hit ? event.critical ? '暴击命中' : '命中' : '未命中'}`]
    }
    if (event.type === 'saving-throw-resolved') {
      return [`豁免：${event.ability.toUpperCase()} d20 ${event.d20} ${event.modifier >= 0 ? '+' : ''}${event.modifier} = ${event.total} 对 DC ${event.dc}，${event.success ? '成功' : '失败'}`]
    }
    if (event.type === 'damage-applied' && event.targetId === SANDBOX_TARGET_ID) {
      return [`伤害：${event.amount}，目标 HP ${event.hpBefore} → ${event.hpAfter}`]
    }
    if (event.type === 'monster-on-hit-save-required') {
      return [`待继续结算：命中后需要 ${event.ability.toUpperCase()} DC ${event.dc} 豁免（${event.condition}）`]
    }
    if (event.type === 'monster-area-action-resolved') {
      return [`范围动作已由 Headless 接受，预掷基础伤害 ${event.damage}`]
    }
    if (event.type === 'monster-summon-resolved') {
      return [`召唤：${event.monsterId} × ${event.count}，${event.timing === 'immediate' ? '立即出现' : '召唤者下回合开始时出现'}，出现后持续 ${event.durationRounds} 轮${event.concentration ? event.concentrationEndsOnAppearance ? '，出现前需要专注' : '，存在期间需要专注' : ''}`]
    }
    if (event.type === 'monster-legendary-action-used') {
      return [`传奇动作：消耗 ${event.cost} 点，剩余 ${event.remaining} 点`]
    }
    if (event.type === 'active-effect-applied') {
      return [`命中后效果：已应用 ${event.definitionId}`]
    }
    if (event.type === 'hit-point-maximum-reduced') {
      return [`命中后效果：目标生命上限降低 ${event.appliedAmount}`]
    }
    if (event.type === 'turn-resource-spent') {
      const resource = event.resource === 'action'
        ? '动作'
        : event.resource === 'bonusAction' ? '附赠动作' : event.resource === 'reaction' ? '反应' : event.resource
      return [`行动经济：已消耗${resource}`]
    }
    return []
  })
}

function allMonsterActions(monster: Dnd5eMonsterStatBlock): Dnd5eMonsterAction[] {
  return [
    ...monster.actions,
    ...(monster.bonusActions ?? []),
    ...(monster.reactions ?? []),
    ...(monster.legendaryActions ?? []),
    ...(monster.lairActions ?? []),
  ]
}

function initialMonsterClassState(monster: Dnd5eMonsterStatBlock): Dnd5eCombatant['classState'] {
  const actions = allMonsterActions(monster)
  return {
    monsterLegendaryActionPoints: monster.legendaryActionPoints ?? 3,
    monsterRechargeReadyByActionId: Object.fromEntries(actions.flatMap((action) =>
      action.usage?.kind === 'recharge' ? [[action.id, true]] : [])),
    monsterActionUsesByActionId: Object.fromEntries(actions.flatMap((action) =>
      action.usage?.kind === 'per-day'
        ? [[action.id, { current: action.usage.max, max: action.usage.max }]]
        : [])),
  }
}

function sandboxCatalogAction(
  monster: Dnd5eMonsterStatBlock,
  actionId: string,
): SandboxCatalogAction | undefined {
  const ordinary = monster.actions.find((action) => action.id === actionId)
  if (ordinary) return { action: ordinary, category: 'action' }
  const bonusAction = monster.bonusActions?.find((action) => action.id === actionId)
  if (bonusAction) return { action: bonusAction, category: 'bonus-action' }
  const reaction = monster.reactions?.find((action) => action.id === actionId)
  if (reaction) return { action: reaction, category: 'reaction' }
  const legendary = monster.legendaryActions?.find((action) => action.id === actionId)
  return legendary ? { action: legendary, category: 'legendary' } : undefined
}

function referencedWeaponAction(
  monster: Dnd5eMonsterStatBlock,
  action: Dnd5eMonsterAction,
): Dnd5eMonsterAction | undefined {
  const resolved = action.referencedActionId
    ? monster.actions.find((candidate) => candidate.id === action.referencedActionId)
    : action
  return resolved?.kind === 'weapon-attack' && resolved.attack ? resolved : undefined
}

function fixedWeaponSequence(
  monster: Dnd5eMonsterStatBlock,
  action: Dnd5eMonsterAction,
): Dnd5eMonsterAction[] | undefined {
  const direct = referencedWeaponAction(monster, action)
  if (direct) return [direct]
  if (action.kind !== 'multiattack' || !action.sequence?.length || action.randomRepeat) return undefined
  const sequence = action.sequence.map((actionId) =>
    monster.actions.find((candidate) => candidate.id === actionId))
  if (sequence.some((candidate) => !candidate || candidate.kind !== 'weapon-attack' || !candidate.attack)) {
    return undefined
  }
  return sequence as Dnd5eMonsterAction[]
}

export function listDnd5eMonsterWorkshopSandboxActions(
  draft: Dnd5eCustomMonsterDraft,
): Dnd5eMonsterWorkshopSandboxActionOption[] {
  try {
    const monster = buildDnd5eCustomMonster(draft)
    const ordinary = monster.actions.flatMap<Dnd5eMonsterWorkshopSandboxActionOption>((action) => {
      if (dnd5eMonsterActionAutomation(action) !== 'headless') return []
      const sequence = fixedWeaponSequence(monster, action)
      if (sequence?.length && sequence.every(sandboxSupportsOnHitEffects)) {
        return [{
          id: action.id,
          name: action.name,
          kind: action.kind === 'multiattack' ? 'multiattack' as const : 'weapon-attack' as const,
        }]
      }
      if (dnd5eMonsterAreaSavingThrowEffect(action)) {
        return [{ id: action.id, name: action.name, kind: 'area-saving-throw' as const }]
      }
      if (action.rule?.kind === 'summon') {
        return [{ id: action.id, name: action.name, kind: 'summon' as const }]
      }
      return []
    })
    const legendary = (monster.legendaryActions ?? []).flatMap<Dnd5eMonsterWorkshopSandboxActionOption>((action) => {
      const sequence = fixedWeaponSequence(monster, action)
      if (
        dnd5eMonsterActionAutomation(action) === 'headless' &&
        sequence?.length &&
        sequence.every(sandboxSupportsOnHitEffects)
      ) {
        return [{ id: action.id, name: action.name, kind: 'legendary-action' as const }]
      }
      return []
    })
    const bonusActions = (monster.bonusActions ?? []).flatMap<Dnd5eMonsterWorkshopSandboxActionOption>((action) => {
      const sequence = fixedWeaponSequence(monster, action)
      return dnd5eMonsterActionAutomation(action) === 'headless' &&
        sequence?.length &&
        sequence.every(sandboxSupportsOnHitEffects)
        ? [{ id: action.id, name: action.name, kind: 'bonus-action' as const }]
        : []
    })
    const reactions = (monster.reactions ?? []).flatMap<Dnd5eMonsterWorkshopSandboxActionOption>((action) => {
      const sequence = fixedWeaponSequence(monster, action)
      return dnd5eMonsterActionAutomation(action) === 'headless' &&
        action.reactionTrigger?.kind === 'after-action' &&
        sequence?.length &&
        sequence.every(sandboxSupportsOnHitEffects)
        ? [{ id: action.id, name: action.name, kind: 'reaction' as const }]
        : []
    })
    return [...ordinary, ...bonusActions, ...reactions, ...legendary]
  } catch {
    return []
  }
}

export function runDnd5eMonsterWorkshopSandbox(
  input: Dnd5eMonsterWorkshopSandboxInput,
): Dnd5eMonsterWorkshopSandboxResult {
  let actionName = input.actionId
  const disposers: (() => void)[] = []
  try {
    const compiled = buildDnd5eCustomMonster(input.draft)
    const monsterId = temporaryMonsterId()
    const monster = {
      ...compiled,
      id: monsterId,
      slug: monsterId.slice('room-monster:'.length),
    }
    const catalogAction = sandboxCatalogAction(monster, input.actionId)
    const action = catalogAction?.action
    actionName = action?.name ?? input.actionId
    if (!action || !catalogAction || dnd5eMonsterActionAutomation(action) !== 'headless') {
      return { ok: false, actionId: input.actionId, actionName, reason: '该动作尚未标记为 Headless。', events: [], eventSummaries: [] }
    }
    const weaponSequence = fixedWeaponSequence(monster, action)
    if (weaponSequence?.some((entry) => !sandboxSupportsOnHitEffects(entry))) {
      return { ok: false, actionId: input.actionId, actionName, reason: '该动作含依赖地图几何的强制位移效果；当前沙盒不能安全生成其预掷配方。', events: [], eventSummaries: [] }
    }

    disposers.push(registerDnd5ePluginMonsterCatalogEntry(monster))
    for (const catalogMonster of input.monsterCatalog ?? []) {
      if (!getDnd5eSrdMonster(catalogMonster.id)) {
        disposers.push(registerDnd5ePluginMonsterCatalogEntry(catalogMonster))
      }
    }
    const randomDie = input.randomDie ?? defaultRandomDie
    const targetArmorClass = clampInteger(input.targetArmorClass, 1, 100)
    const targetHitPoints = clampInteger(input.targetHitPoints, 1, 1_000_000)
    const saveBonus = clampInteger(input.targetSavingThrowBonus ?? 0, -100, 100)
    const areaRule = catalogAction.category === 'action'
      ? dnd5eMonsterAreaSavingThrowEffect(action)
      : undefined
    const summonRule = action.rule?.kind === 'summon' ? action.rule : undefined
    const rangedOnly = weaponSequence?.every((entry) => entry.attack?.mode === 'ranged') === true
    const rangedNormal = weaponSequence?.[0]?.attack?.rangeFeet?.normal ?? 30
    const targetDistance = rangedOnly
      ? Math.max(10, Math.min(30, rangedNormal))
      : 5
    const legendary = catalogAction.category === 'legendary'
    const reaction = catalogAction.category === 'reaction'
    const bonusAction = catalogAction.category === 'bonus-action'
    const combatId = `monster-workshop-sandbox-${Date.now()}`
    const classState = {
      ...initialMonsterClassState(monster),
      ...(reaction && action.reactionTrigger?.kind === 'after-action'
        ? {
            monsterReactionTriggerPending: {
              schemaVersion: 1 as const,
              combatId,
              round: 1,
              sourceActionId: action.reactionTrigger.actionId,
              reactionActionIds: [action.id],
            },
          }
        : {}),
    }
    const actor = createDnd5eCombatant({
      id: SANDBOX_ACTOR_ID,
      name: monster.name,
      controller: 'dm',
      initiative: legendary || reaction ? 10 : 20,
      abilities: monster.abilities,
      proficiencyBonus: challengeProficiencyBonus(monster.challenge.rating),
      armorClass: monster.armorClass.value,
      currentHp: monster.hitPoints.average,
      maxHp: monster.hitPoints.average,
      temporaryHp: 0,
      speed: monster.speed.walk,
      position: { x: 0, y: 0 },
      concentrating: false,
      statBlockId: monster.id,
      sizeRank: sizeRank(monster.size),
      classState,
      savingThrowBonuses: monster.savingThrows,
      passivePerception: monster.passivePerception,
      damageVulnerabilities: monster.damageVulnerabilities,
      damageResistances: monster.damageResistances,
      damageImmunities: monster.damageImmunities,
      damageDefenseRules: monster.damageDefenseRules,
      conditionImmunities: monster.conditionImmunities,
    })
    const target = createDnd5eCombatant({
      id: SANDBOX_TARGET_ID,
      name: '沙盒目标',
      controller: 'player',
      initiative: legendary || reaction ? 20 : 10,
      abilities: { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 },
      proficiencyBonus: 2,
      armorClass: targetArmorClass,
      currentHp: targetHitPoints,
      maxHp: targetHitPoints,
      temporaryHp: 0,
      speed: 30,
      position: { x: targetDistance, y: 0 },
      concentrating: false,
      savingThrowBonuses: {
        str: saveBonus,
        dex: saveBonus,
        con: saveBonus,
        int: saveBonus,
        wis: saveBonus,
        cha: saveBonus,
      },
      usesDeathSaves: false,
    })
    const state = startDnd5eHeadlessCombat(combatId, [actor, target])

    if (weaponSequence?.length) {
      const preparedRolls = weaponSequence.map((sequenceAction) => {
        const attack = sequenceAction.attack!
        const d20 = input.d20 == null
          ? rollDie(randomDie, 20)
          : clampInteger(input.d20, 1, 20)
        const critical = d20 !== 1 && d20 >= (attack.criticalThreshold ?? 20)
        const damageRolls = [
          ...attack.damage.map((damage) => rollDamage(damage, randomDie, critical)),
          ...(critical ? attack.criticalExtraDamage ?? [] : []).map((damage) => rollDamage(damage, randomDie, false)),
        ]
        const predictedHit = d20 !== 1 && (
          d20 === 20 || d20 + attack.toHit >= targetArmorClass
        )
        const onHitEffectRolls = predictedHit
          ? prepareOnHitEffectRolls(attack.onHitEffects ?? [], {
              d20,
              randomDie,
              fixedD20: input.d20 != null,
              targetSizeRank: 2,
            })
          : undefined
        return {
          actionId: sequenceAction.id,
          actionName: sequenceAction.name,
          d20,
          damageRolls,
          onHitEffectRolls,
        }
      })
      const rolls = preparedRolls.map((roll) => ({
        targetId: SANDBOX_TARGET_ID,
        d20: roll.d20,
        damageRolls: roll.damageRolls,
        onHitEffectRolls: roll.onHitEffectRolls,
      }))
      const result = resolveDnd5eHeadlessAction(state, legendary
        ? {
            type: 'monster-legendary-action',
            actorId: SANDBOX_ACTOR_ID,
            actionId: action.id,
            rolls,
          }
        : reaction
          ? {
              type: 'monster-reaction-action',
              actorId: SANDBOX_ACTOR_ID,
              actionId: action.id,
              rolls,
            }
          : bonusAction
            ? {
                type: 'monster-bonus-action',
                actorId: SANDBOX_ACTOR_ID,
                actionId: action.id,
                rolls,
              }
        : {
            type: 'monster-action',
            actorId: SANDBOX_ACTOR_ID,
            actionId: action.id,
            rolls,
          })
      const summaries = eventSummaries(result.events)
      if (!result.ok) {
        return { ok: false, actionId: action.id, actionName, reason: `Headless 拒绝事务：${result.reason}`, events: result.events, eventSummaries: summaries }
      }
      const attackEvents = result.events.filter(
        (event): event is Extract<Dnd5eCombatEvent, { type: 'attack-resolved' }> =>
          event.type === 'attack-resolved' && event.targetId === SANDBOX_TARGET_ID,
      )
      const attackEvent = attackEvents[0]
      if (!attackEvent || attackEvent.type !== 'attack-resolved') {
        return { ok: false, actionId: action.id, actionName, reason: 'Headless 未返回攻击结算事件。', events: result.events, eventSummaries: summaries }
      }
      const hpAfter = result.state.combatants[SANDBOX_TARGET_ID]?.currentHp ?? targetHitPoints
      const legendaryEvent = result.events.find((event) => event.type === 'monster-legendary-action-used')
      return {
        ok: true,
        kind: legendary
          ? 'legendary-action'
          : reaction
            ? 'reaction'
            : bonusAction
              ? 'bonus-action'
          : action.kind === 'multiattack' ? 'multiattack' : 'weapon-attack',
        actionId: action.id,
        actionName,
        targetHitPointsBefore: targetHitPoints,
        targetHitPointsAfter: hpAfter,
        damageApplied: targetHitPoints - hpAfter,
        rolls: {
          d20: preparedRolls[0].d20,
          damageRolls: preparedRolls[0].damageRolls,
          attacks: preparedRolls,
        },
        attack: {
          d20: attackEvent.d20,
          total: attackEvent.total,
          armorClass: attackEvent.armorClass,
          hit: attackEvent.hit,
          critical: attackEvent.critical,
        },
        attacks: attackEvents.map((event) => ({
          d20: event.d20,
          total: event.total,
          armorClass: event.armorClass,
          hit: event.hit,
          critical: event.critical,
        })),
        ...(legendaryEvent?.type === 'monster-legendary-action-used'
          ? { legendary: { cost: legendaryEvent.cost, remaining: legendaryEvent.remaining } }
          : {}),
        events: result.events,
        eventSummaries: summaries,
      }
    }

    if (summonRule) {
      const countRule = summonRule.count
      const summonCountRolls = countRule.kind === 'dice'
        ? Array.from({ length: countRule.count }, () =>
            rollDie(randomDie, countRule.sides))
        : []
      const result = resolveDnd5eHeadlessAction(state, legendary
        ? {
            type: 'monster-legendary-special-action',
            actorId: SANDBOX_ACTOR_ID,
            actionId: action.id,
            summonCountRolls,
          }
        : {
            type: 'monster-special-action',
            actorId: SANDBOX_ACTOR_ID,
            actionId: action.id,
            summonCountRolls,
          })
      const summaries = eventSummaries(result.events)
      if (!result.ok) {
        return { ok: false, actionId: action.id, actionName, reason: `Headless 拒绝事务：${result.reason}`, events: result.events, eventSummaries: summaries }
      }
      const summonEvent = result.events.find((event) => event.type === 'monster-summon-resolved')
      if (!summonEvent || summonEvent.type !== 'monster-summon-resolved') {
        return { ok: false, actionId: action.id, actionName, reason: 'Headless 未返回召唤结算事件。', events: result.events, eventSummaries: summaries }
      }
      return {
        ok: true,
        kind: 'summon',
        actionId: action.id,
        actionName,
        targetHitPointsBefore: targetHitPoints,
        targetHitPointsAfter: targetHitPoints,
        damageApplied: 0,
        rolls: { d20: 0, damageRolls: [], summonCountRolls },
        summon: {
          monsterId: summonEvent.monsterId,
          count: summonEvent.count,
          timing: summonEvent.timing,
          durationRounds: summonEvent.durationRounds,
          concentration: summonEvent.concentration,
          concentrationEndsOnAppearance: summonEvent.concentrationEndsOnAppearance,
        },
        events: result.events,
        eventSummaries: summaries,
      }
    }

    if (areaRule) {
      const d20 = input.d20 == null
        ? rollDie(randomDie, 20)
        : clampInteger(input.d20, 1, 20)
      const damageRolls = areaRule.damage
        ? rollDamage(areaRule.damage, randomDie, false)
        : []
      const result = resolveDnd5eHeadlessAction(state, {
        type: 'monster-area-action',
        actorId: SANDBOX_ACTOR_ID,
        actionId: action.id,
        resolution: {
          schemaVersion: 1,
          targetIds: [SANDBOX_TARGET_ID],
          targetSavingThrows: [{ targetId: SANDBOX_TARGET_ID, d20 }],
          damageRolls,
        },
      })
      const summaries = eventSummaries(result.events)
      if (!result.ok) {
        return { ok: false, actionId: action.id, actionName, reason: `Headless 拒绝事务：${result.reason}`, events: result.events, eventSummaries: summaries }
      }
      const saveEvent = result.events.find((event) => event.type === 'saving-throw-resolved' && event.targetId === SANDBOX_TARGET_ID)
      if (!saveEvent || saveEvent.type !== 'saving-throw-resolved') {
        return { ok: false, actionId: action.id, actionName, reason: 'Headless 未返回豁免结算事件。', events: result.events, eventSummaries: summaries }
      }
      const hpAfter = result.state.combatants[SANDBOX_TARGET_ID]?.currentHp ?? targetHitPoints
      return {
        ok: true,
        kind: 'area-saving-throw',
        actionId: action.id,
        actionName,
        targetHitPointsBefore: targetHitPoints,
        targetHitPointsAfter: hpAfter,
        damageApplied: targetHitPoints - hpAfter,
        rolls: { d20, damageRolls: [damageRolls] },
        save: {
          ability: saveEvent.ability,
          modifier: saveEvent.modifier,
          total: saveEvent.total,
          dc: saveEvent.dc,
          success: saveEvent.success,
        },
        events: result.events,
        eventSummaries: summaries,
      }
    }

    return { ok: false, actionId: action.id, actionName, reason: '当前沙盒仅支持武器攻击和范围豁免动作。', events: [], eventSummaries: [] }
  } catch (error) {
    return {
      ok: false,
      actionId: input.actionId,
      actionName,
      reason: error instanceof Error ? error.message : '沙盒试运行失败。',
      events: [],
      eventSummaries: [],
    }
  } finally {
    for (const dispose of disposers.reverse()) dispose()
  }
}
