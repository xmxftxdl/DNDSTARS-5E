import { findClassTrait } from '../../lib/classFeatures'
import { getClassResourceCurrent, spendClassResource } from '../../lib/classResources'
import { isCalmMindActive } from '../../lib/calmMind'
import {
  registerHeadlessFeatureActivationResolver,
  type HeadlessFeatureActivationContext,
} from '../../lib/featureActivationRegistry'

function resolveArcherFeature(context: HeadlessFeatureActivationContext) {
  const { state, action, actorToken, actor, trait, events, services } = context

  if (action.featureKey === 'eagleEye') {
    if (trait.uses <= 0) return services.fail('invalid-skill')
    if (!services.spendActorAp(1)) return services.fail('insufficient-ap')
    services.updateCharacter(actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, eagleEyeTurns: 3 },
      traits: item.traits.map((currentTrait) =>
        currentTrait.featureKey === 'eagleEye'
          ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
          : currentTrait,
      ),
    }))
    events.push({ type: 'log', text: `${actor.name} 激活鹰眼。` })
    return services.succeed()
  }

  if (action.featureKey === 'wildernessGuide') {
    if (!services.spendActorAp(1)) return services.fail('insufficient-ap')
    services.updateCharacter(actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, wildernessGuideBoost: true },
      traits: item.traits.map((currentTrait) =>
        currentTrait.featureKey === 'wildernessGuide'
          ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
          : currentTrait,
      ),
    }))
    events.push({ type: 'log', text: `${actor.name} 激活特殊指引：下次生存或察觉检定具有优势。` })
    return services.succeed()
  }

  if (action.featureKey === 'doubleArrow') {
    if (actor.combatBuffs?.doubleArrowReady) {
      services.updateCharacter(actor.id, (item) => ({
        ...item,
        combatBuffs: { ...item.combatBuffs, doubleArrowReady: undefined },
      }))
      events.push({ type: 'log', text: `${actor.name} 取消双箭。` })
      return services.succeed()
    }
    if (!services.spendActorAp(1)) return services.fail('insufficient-ap')
    services.updateCharacter(actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, doubleArrowReady: true },
    }))
    events.push({ type: 'log', text: `${actor.name} 激活双箭。` })
    return services.succeed()
  }

  if (action.featureKey === 'stillWater') {
    if (!isCalmMindActive(actor)) return services.fail('invalid-skill')
    if (!services.spendActorAp(1)) return services.fail('insufficient-ap')
    const tempHp = Math.max(1, trait.level) * 10
    let affected = 0
    for (const allyToken of state.map.tokens) {
      if (allyToken.type !== 'player' || !allyToken.characterId) continue
      const ally = services.findCharacter(allyToken.characterId)
      if (!ally || ally.currentHp <= 0 || services.distanceFeet(actorToken, allyToken) > 15) continue
      affected += 1
      services.updateCharacter(ally.id, (item) => ({
        ...item,
        tempHp: Math.max(item.tempHp ?? 0, tempHp),
        combatBuffs: {
          ...item.combatBuffs,
          stillWaterBreathImmunityTurns: 2,
          stillWaterTempHpTurns: 10,
          outOfBreathTurns: undefined,
          calmMind: findClassTrait(item, 'calmMind') ? true : item.combatBuffs?.calmMind,
        },
      }))
    }
    events.push({ type: 'log', text: `${actor.name} 激活心如止水：15尺内 ${affected} 名友方获得 ${tempHp} 临时生命，2回合免气喘。` })
    return services.succeed()
  }

  if (action.featureKey === 'finale') {
    if (actor.combatBuffs?.finaleReady) {
      services.updateCharacter(actor.id, (item) => ({
        ...item,
        combatBuffs: { ...item.combatBuffs, finaleReady: undefined },
      }))
      events.push({ type: 'log', text: `${actor.name} 取消曲终待触发。` })
      return services.succeed()
    }
    if (!services.spendActorAp(2)) return services.fail('insufficient-ap')
    services.updateCharacter(actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, finaleReady: true },
      traits: item.traits.map((currentTrait) =>
        currentTrait.featureKey === 'finale'
          ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
          : currentTrait,
      ),
    }))
    events.push({ type: 'log', text: `${actor.name} 激活曲终：等待下一名敌对生物狩猎印记叠至 4 层。` })
    return services.succeed()
  }

  if (action.featureKey === 'illusionDance') return services.resolveIllusionDance()

  if (action.featureKey === 'shadowVeil') {
    const targetToken = state.map.tokens.find((item) => item.id === action.targetTokenId)
    if (!targetToken || targetToken.type !== 'enemy' || !services.isTokenAlive(targetToken)) return services.fail('invalid-target')
    if ((targetToken.huntingMarkStacks ?? 0) < 2) return services.fail('invalid-target')
    if (!services.spendActorAp(1)) return services.fail('insufficient-ap')
    services.updateToken(targetToken.id, (token) => ({
      ...token,
      huntingMarkStacks: Math.max(0, (token.huntingMarkStacks ?? 0) - 2),
    }))
    services.updateCharacter(actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, shadowVeilTargetId: targetToken.id },
      traits: item.traits.map((currentTrait) =>
        currentTrait.featureKey === 'shadowVeil'
          ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
          : currentTrait,
      ),
    }))
    events.push({ type: 'log', text: `${actor.name} 激活影遁之术：${targetToken.label} 印记 -2，本回合攻击 +1D6。` })
    return services.succeed()
  }

  if (action.featureKey === 'trackingArrow') {
    const targetToken = state.map.tokens.find((item) => item.id === action.targetTokenId)
    if (!targetToken || targetToken.type !== 'enemy' || !services.isTokenAlive(targetToken)) return services.fail('invalid-target')
    if ((targetToken.huntingMarkStacks ?? 0) <= 0) return services.fail('invalid-target')
    const nextStacks = Math.min(4, (targetToken.huntingMarkStacks ?? 0) + 1)
    const finaleWillTrigger = nextStacks === 4 && !!actor.combatBuffs?.finaleReady
    const finaleDamageValues = finaleWillTrigger
      ? services.resolveFinaleDamageValues(action.finaleDamageValues, findClassTrait(actor, 'finale')?.level ?? 1)
      : []
    if (!finaleDamageValues) return services.fail('invalid-dice')
    if (!services.spendActorAp(1)) return services.fail('insufficient-ap')
    services.updateToken(targetToken.id, (token) => ({ ...token, huntingMarkStacks: nextStacks }))
    services.updateCharacter(actor.id, (item) => ({
      ...item,
      traits: item.traits.map((currentTrait) =>
        currentTrait.featureKey === 'trackingArrow'
          ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
          : currentTrait,
      ),
    }))
    events.push({ type: 'log', text: `${actor.name} 激活追踪箭：${targetToken.label} 狩猎印记 +1（${nextStacks}/4）。` })
    if (finaleWillTrigger) {
      const latestTarget = state.map.tokens.find((token) => token.id === targetToken.id) ?? targetToken
      services.resolveFinaleTrigger(actor, latestTarget, finaleDamageValues)
    }
    return services.succeed()
  }

  if (action.featureKey === 'flexibleBody') {
    if (getClassResourceCurrent(actor, 'qi') < 1) return services.fail('insufficient-resource')
    if (!services.spendActorAp(1)) return services.fail('insufficient-ap')
    const bonus = 5 + (Math.max(1, trait.level) - 1) * 2
    services.updateCharacter(actor.id, (item) => {
      const spent = spendClassResource(item, 'qi', 1) ?? item
      return { ...spent, combatBuffs: { ...spent.combatBuffs, flexibleBodyBonus: bonus } }
    })
    events.push({ type: 'log', text: `${actor.name} 激活灵活身躯：下次闪避/敏捷豁免 +${bonus}。` })
    return services.succeed()
  }

  if (action.featureKey === 'showtime') {
    if (getClassResourceCurrent(actor, 'qi') < 1) return services.fail('insufficient-resource')
    if (!services.spendActorAp(1)) return services.fail('insufficient-ap')
    services.updateCharacter(actor.id, (item) => {
      const spent = spendClassResource(item, 'qi', 1) ?? item
      return {
        ...spent,
        combatBuffs: { ...spent.combatBuffs, showtimeTurns: 2 },
        traits: spent.traits.map((currentTrait) =>
          currentTrait.featureKey === 'showtime'
            ? { ...currentTrait, uses: Math.max(0, currentTrait.uses - 1) }
            : currentTrait,
        ),
      }
    })
    events.push({ type: 'log', text: `${actor.name} 激活演出时间：持续 2 回合。` })
    return services.succeed()
  }

  if (action.featureKey === 'windBlade') {
    if (getClassResourceCurrent(actor, 'qi') < 1) return services.fail('insufficient-resource')
    services.updateCharacter(actor.id, (item) => {
      const spent = spendClassResource(item, 'qi', 1) ?? item
      return { ...spent, combatBuffs: { ...spent.combatBuffs, windBladeFreeDodgeTurns: 1 } }
    })
    events.push({ type: 'log', text: `${actor.name} 激活风刃乱舞：下回合开始前，回合外闪避不消耗 AP。` })
    return services.succeed()
  }

  if (actor.combatBuffs?.preciseStrikeReady) {
    services.updateCharacter(actor.id, (item) => ({
      ...item,
      combatBuffs: { ...item.combatBuffs, preciseStrikeReady: undefined },
    }))
    events.push({ type: 'log', text: `${actor.name} 取消精准打击。` })
    return services.succeed()
  }
  if (!services.spendActorAp(1)) return services.fail('insufficient-ap')
  services.updateCharacter(actor.id, (item) => ({
    ...item,
    combatBuffs: { ...item.combatBuffs, preciseStrikeReady: true },
  }))
  events.push({ type: 'log', text: `${actor.name} 准备精准打击。` })
  return services.succeed()
}

export function registerArcherHeadlessFeatureResolvers(): void {
  for (const featureKey of [
    'eagleEye', 'wildernessGuide', 'doubleArrow', 'preciseStrike', 'stillWater', 'finale',
    'illusionDance', 'shadowVeil', 'trackingArrow', 'flexibleBody', 'showtime', 'windBlade',
  ] as const) {
    registerHeadlessFeatureActivationResolver(featureKey, resolveArcherFeature)
  }
}
