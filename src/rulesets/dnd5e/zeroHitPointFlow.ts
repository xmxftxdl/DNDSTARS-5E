import type { Dnd5eAction, Dnd5eHeadlessCombatState } from './headlessCombatEngine'
import type { Dnd5eActivityTriggerChoiceRequestV1, Dnd5eActivityTriggerConfirmationV1 } from './activities/dnd5eActivityTriggerSettlement'
import { createDnd5eZeroHitPointSession } from './zeroHitPointSession'
import { dnd5ePluginFeatureDefinition } from './pluginApi'
import { automationCapabilityFromLegacyStatus } from '../../domain/automation/automationCapability'

/** Uses the existing controller-routed Activity confirmation contract. The room
 * caller must combine this with its other reaction windows before publishing. */
export async function resolveDnd5eZeroHitPointFlow(input:{
  state:Dnd5eHeadlessCombatState
  action:Dnd5eAction
  transactionId:string
  authorityUnchanged:()=>boolean
  confirm:(request:Dnd5eActivityTriggerChoiceRequestV1)=>Promise<Dnd5eActivityTriggerConfirmationV1>
  prepareStart?:(actorId:string)=>Promise<Extract<Dnd5eAction,{type:'begin-turn'}>>
}) {
  const guard = () => {if (!input.authorityUnchanged()) throw new Error('zero-hp-authority-changed')}
  const session = createDnd5eZeroHitPointSession(input.state,input.action,input.transactionId)
  guard()
  let result = session.run(input.state)
  for (let count=0;count<128;count++) {
    if (result.status==='resolved') {guard();return result.result}
    if (result.status==='rejected') throw new Error(result.reason)
    if (result.status==='pending-start') {
      if (!input.prepareStart) throw new Error('zero-hp-start-input-required')
      const start = await input.prepareStart(result.actorId)
      guard()
      result = session.supplyStart(input.state,start)
      continue
    }
    const pending = result
    let selected:string|undefined
    for (const option of pending.options) {
      const feature = dnd5ePluginFeatureDefinition(option.featureId)
      if (!feature?.declarativeAbility) throw new Error('zero-hp-definition-missing')
      const eventId = `${input.transactionId}:zero-hp:${pending.checkpoint.occurrence}:${option.featureId}`
      guard()
      const choice = await input.confirm({eventId,packageId:feature.ownerPluginId,actorId:option.actorId,
        targetIds:[option.actorId],confirmation:'actor-choice',
        activity:{schemaVersion:1,id:'zero-hit-point-extra-turn',name:feature.name,description:feature.declarativeAbility.description,
          activation:{kind:'reaction'},automation:automationCapabilityFromLegacyStatus('partial'),target:{kind:'self'},outcomes:[]},
        triggerContext:{eventId,event:'before-drop-to-zero',source:{kind:'combat',id:input.state.combatId},
          eligibleActorIds:[option.actorId],eligibleTargetIds:[option.actorId],actionEconomyAvailable:{reaction:true}},
      })
      guard()
      if (choice.accepted) {selected=option.featureId;break}
    }
    result = session.choose(input.state,pending.checkpoint.occurrence,selected)
  }
  throw new Error('zero-hp-replay-limit')
}
