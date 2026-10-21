import { expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { migrateMapsState, type BattleMap, type Token } from '../../store/maps'
import { createDnd5eMechanicalEffect } from './activeEffects'
import { reconcileDnd5eSummonSourceDeathsAcrossMaps } from './mapBridge'
import { planDnd5eSummonedCreature } from './summonedCreatures'
import { advanceDnd5eCampaignTimedActiveEffects } from './campaignTimeRules'

it('preserves unchanged roster identity during room lifetime reconciliation', () => {
  const characters = [normalizeCharacter({ id: 'idle', name: 'Idle', equipment: {} })]
  const result = reconcileDnd5eSummonSourceDeathsAcrossMaps({ maps: [], characters, round: 1 })
  expect(result.characters).toBe(characters)
})

it.each(['active','caster-dead','ended','other-controller','missing'] as const)('keeps or releases a remote corpse by its exact captivity controller (%s)',scenario=>{
  const controller=createDnd5eMechanicalEffect({id:'cage-one',definitionId:'controller',label:'Controller',targetId:'old-source',
    source:{kind:'spell',actorId:'old-source',characterId:'caster'},duration:{type:'permanent'}})
  const captive=createDnd5eMechanicalEffect({id:'captivity',definitionId:'captive',label:'Captive',targetId:'corpse',
    source:{kind:'spell',actorId:'old-source',characterId:'caster'},duration:{type:'permanent'},modifiers:{preventsRevival:true},
    removal:{sourceLink:{sourceRequiresEffect:'controller',sourceRequiresEffectSameApplication:true,sourceRequiresEffectInstanceId:'cage-one'}}})
  const caster=normalizeCharacter({id:'caster',name:'Caster',charClass:'法师',level:11,currentHp:scenario==='caster-dead'?0:30,maxHp:30,
    deathSaveFailures:scenario==='caster-dead'?3:0,dnd5eCombatState:{activeEffects:scenario==='ended'?[]:[scenario==='other-controller'?{...controller,id:'cage-two'}:controller]}})
  const map:BattleMap={id:'remote-corpse',name:'Remote',width:500,height:500,gridSize:50,gridOffsetX:0,gridOffsetY:0,showGrid:true,
    tokens:[{id:'corpse',type:'enemy',poolId:'srd-5.1:bandit',label:'Corpse',x:25,y:25,size:1,color:'',emoji:'',hp:0,maxHp:11,
      dnd5eCombatState:{deathRound:1,activeEffects:[captive]}}]}
  const input={maps:[map],characters:scenario==='missing'?[]:[caster],round:2}
  const before=structuredClone(input),settled=reconcileDnd5eSummonSourceDeathsAcrossMaps(input)
  const retained=settled.maps[0].tokens[0].dnd5eCombatState?.activeEffects?.some(effect=>effect.id==='captivity')??false
  expect(retained).toBe(!['ended','other-controller'].includes(scenario))
  expect(input).toEqual(before)
  const replay=reconcileDnd5eSummonSourceDeathsAcrossMaps({...settled,round:3})
  expect(replay.events).toEqual([])
})

it.each(['alive', 'unconscious', 'dead', 'ended', 'source-ended', 'missing', 'ambiguous'] as const)('reconciles off-map donor and non-character companion (%s)', scenario => {
  const debit = { ...createDnd5eMechanicalEffect({ id: 'debit', definitionId: 'debit', label: 'Debit',
    source: { kind: 'feature', actorId: 'old-caster', characterId: 'owner' }, targetId: 'old-caster',
    duration: { type: 'permanent' }, modifiers: {} }), linkedLifetime: { actorId: 'companion', effectId: 'credit' } }
  const credit = { ...createDnd5eMechanicalEffect({ id: 'credit', definitionId: 'credit', label: 'Credit',
    source: { kind: 'feature', actorId: 'old-caster', characterId: 'owner' }, targetId: 'companion',
    duration: { type: 'permanent' }, modifiers: { hitPointMaximumBonus: 7 } }),
    linkedLifetime: { actorId: 'old-caster', characterId: 'owner', effectId: 'debit' } }
  let owner = normalizeCharacter({ id: 'owner', name: 'Owner', charClass: '法师', level: 5, maxHp: 23, currentHp: 23,
    dnd5eCombatState: { schemaVersion: 2, activeEffects: [debit], hitPointMaximumReductionLedger: {
      schemaVersion: 1, baseMaximum: 30, entries: [{ id: 'debit-entry', amount: 7, recovery: 'effect-removal', sourceEffectId: 'debit' }],
    } } })
  if (scenario === 'source-ended') owner = advanceDnd5eCampaignTimedActiveEffects({ ...owner,
    dnd5eCombatState: { ...owner.dnd5eCombatState, activeEffects: [] } }, 0)
  const caster: Token = { id: 'old-caster', characterId: 'owner', type: 'player', label: 'Owner', x: 25, y: 25, size: 1, color: '', emoji: '' }
  const map: BattleMap = { id: 'remote', name: 'Remote', width: 500, height: 500, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, tokens: [caster] }
  const planned = planDnd5eSummonedCreature({ map, actorToken: caster, sourceCharacterId: owner.id,
    featureId: 'companion', pluginId: 'test.links', actionId: 'create', round: 1, initiativeD20: 10,
    targetCell: { col: 2, row: 2 }, summon: { monsterId: 'srd-5.1:wolf', durationRounds: 10, persistent: true, concentration: false } })
  if (!planned.ok) throw Error('Expected companion')
  const companion: Token = { ...planned.plan.token, id: 'companion', hp: scenario === 'dead' || scenario === 'unconscious' ? 0 : 18, maxHp: 11,
    dnd5eCombatState: { activeEffects: scenario === 'ended' ? [] : [credit], ...(scenario === 'dead' ? { deathRound: 1 } : {}) } }
  const remote = { ...map, tokens: scenario === 'missing' ? [] : [companion] }
  const untouched = { ...map, id: 'empty', tokens: [] }
  const duplicate = { ...map, id: 'duplicate', tokens: [{ ...companion, dnd5eCombatState: { activeEffects: [] }, hp: 0 }] }
  const maps = scenario === 'ambiguous' ? [untouched, remote, duplicate] : [untouched, remote]
  const original = structuredClone({ maps, owner })
  for (const order of [maps, [...maps].reverse()]) {
    const settled = reconcileDnd5eSummonSourceDeathsAcrossMaps({ maps: order, characters: [owner], round: 2 })
    const ends = scenario === 'dead' || scenario === 'ended' || scenario === 'source-ended'
    expect(settled.characters[0].maxHp).toBe(ends ? 30 : 23)
    expect(settled.characters[0].currentHp).toBe(23)
    expect(settled.maps.find(candidate => candidate.id === 'empty')).toBe(untouched)
    if (scenario === 'source-ended') {
      const receiver = settled.maps.find(candidate => candidate.id === 'remote')!.tokens[0]
      expect(receiver.hp).toBe(11)
      expect(receiver.dnd5eCombatState?.activeEffects?.some(effect => effect.id === 'credit') ?? false).toBe(false)
    }
    const savedMaps = migrateMapsState(JSON.parse(JSON.stringify({ maps: settled.maps }))).maps
    const savedOwner = normalizeCharacter(JSON.parse(JSON.stringify(settled.characters[0])))
    const replay = reconcileDnd5eSummonSourceDeathsAcrossMaps({ maps: savedMaps, characters: [savedOwner], round: 3 })
    expect(replay.maps).toBe(savedMaps)
    expect(replay.characters[0]).toBe(savedOwner)
    expect(replay.events).toEqual([])
  }
  expect({ maps, owner }).toEqual(original)
})
