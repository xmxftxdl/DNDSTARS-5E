import { readCampaignInteractionContext } from './campaignInteractionController'
import { campaignEnvironmentalCombatContext } from './campaignEnvironmentalCombatContext'
import { planDnd5eCampaignEnvironmentalExposure } from './campaignEnvironmentalExposure'
import { publishCampaignEnvironmentalExposure } from './publishCampaignEnvironmentalExposure'
import { getEnvironmentalExposureInteraction } from '../../composition/environmentalExposureInteraction'
import * as shared from '../../composition/browserSharedRoomResources'
import { getRoomSession } from '../../lib/roomSession'
import { appRoomAuthorityScheduler } from '../../lib/roomAuthorityScheduler'
import { dnd5eSavingThrowMode } from '../../rulesets/dnd5e/passiveDefenses'
import { dnd5eCombatantEnvironmentalImmunities } from '../../rulesets/dnd5e/environmentalProtection'
import { useCampaignTimeStore } from '../../store/campaignTime'
import type { SharedCampaignTimeState } from '../../lib/campaignTime'

function hostGuard() {
  const session = getRoomSession()
  if (session?.role !== 'dm') throw Error('仅 DM 可以结算气候暴露。')
  const { roomId, memberId } = session
  return () => {
    const current = getRoomSession()
    if (current?.role !== 'dm' || current.roomId !== roomId || current.memberId !== memberId) throw Error('房间或 DM 身份已改变。')
  }
}

export async function loadEnvironmentalExposureTargets(mapId: string) {
  const guard = hostGuard(), context = await readCampaignInteractionContext(mapId)
  guard()
  return { worldMinute: context.clock.worldMinute, combatActive: context.state.active,
    targets: Object.values(context.state.combatants).map(target => ({ id: target.id, name: target.name,
      protections: dnd5eCombatantEnvironmentalImmunities(target) })) }
}

export function runCampaignEnvironmentalExposure(input: {
  mapId: string; targetId: string; exposureId: string; hazard: 'extreme-heat' | 'extreme-cold';
  fromWorldMinute: number; toWorldMinute: number; dc: number; continuityConfirmed: boolean;
}) {
  const guard = hostGuard()
  return appRoomAuthorityScheduler.run(`environmental-exposure:${input.exposureId}`, async () => {
    guard()
    if (!input.continuityConfirmed) throw Error('请确认该时段内目标持续暴露于所选气候。')
    const context = campaignEnvironmentalCombatContext(await readCampaignInteractionContext(input.mapId))
    guard()
    const target = context.state.combatants[input.targetId]
    if (!target) throw Error('目标已离开地图。')
    const protectedTarget = dnd5eCombatantEnvironmentalImmunities(target).includes(input.hazard)
    // Preflight rejects stale/duplicate intervals before asking anyone to roll.
    const preflight = planDnd5eCampaignEnvironmentalExposure({ ...context, ...input, now: Date.now(), rolls: {} })
    if (!preflight.ok && preflight.reason !== 'exposure-roll-invalid') throw Error(preflight.reason)
    let completion = preflight
    if (!protectedTarget) {
      const owner = getEnvironmentalExposureInteraction()
      const values = await owner({ mapId: input.mapId, targetId: target.id, characterId: context.characterIdByCombatantId[target.id],
        targetName: target.name, label: `${input.hazard === 'extreme-heat' ? '极端炎热' : '极端寒冷'} · 体质豁免`,
        mode: dnd5eSavingThrowMode(target, 'con', { sourceIsSpell: false, sourceIsMagical: false }) })
      guard()
      if (getEnvironmentalExposureInteraction() !== owner) throw Error('地图已关闭，请重新读取目标。')
      completion = planDnd5eCampaignEnvironmentalExposure({ ...context, ...input, now: Date.now(), rolls: { [`save:${target.id}`]: { values } } })
    }
    if (!completion.ok) throw Error(completion.reason)
    guard()
    await publishCampaignEnvironmentalExposure({ ...context, completion, updatedAt: Date.now(), gateway: {
      saveResourcesAtomically: shared.saveSharedResourcesAtomically,
      loadResource: name => shared.loadSharedResource<SharedCampaignTimeState>(name),
    } })
    guard()
    await useCampaignTimeStore.getState().loadShared()
    return completion.receipt
  })
}
