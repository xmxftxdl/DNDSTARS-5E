import { dnd5eSavingThrowMode } from './passiveDefenses'
import { afterEach, expect, it } from 'vitest'
import { normalizeCharacter } from '../../store/characters'
import { migrateMapsState, type BattleMap, type Dnd5ePluginArea } from '../../store/maps'
import { setMapGeometryRuntime } from '../../lib/mapGeometry'
import { normalizeDnd5ePersistentAreaOccupantModifiers } from './persistentAreaTypes'
import { createDnd5eMapCombatSnapshot, planDnd5eMapResultApplication } from './mapBridge'
import { dnd5eAbilityCheckRollMode } from './headlessCombatEngine'

afterEach(() => setMapGeometryRuntime([]))
function fixture() {
  const hero = normalizeCharacter({ id: 'hero', name: 'Hero', maxHp: 20, currentHp: 20 })
  const area: Dnd5ePluginArea = { id: 'rest-zone', pluginId: 'test', featureId: 'rest-zone', label: 'Rest zone', color: '#aaa',
    sourceTokenId: 'player', sourceCharacterId: 'hero', cells: [{ col: 0, row: 0 }, { col: 1, row: 0 }], anchorCell: { col: 0, row: 0 },
    createdRound: 1, expiresAfterRound: 100, includeSelf: true, relation: 'ally',
    occupantModifiers: { skillCheckBonuses: { stealth: 5, perception: 5 }, requiresLineOfEffectFromAnchor: true } }
  const map: BattleMap = { id: 'map', name: 'Map', width: 200, height: 100, gridSize: 50, gridOffsetX: 0, gridOffsetY: 0, showGrid: true, feetPerCell: 5,
    tokens: [{ id: 'player', characterId: 'hero', type: 'player', label: 'Hero', x: 75, y: 25, size: 1, emoji: '', color: '' },
      { id: 'enemy', type: 'enemy', label: 'Enemy', x: 75, y: 25, size: 1, emoji: '', color: '', hp: 20, maxHp: 20 }], dnd5ePluginAreas: [area] }
  const snapshot = (nextMap = map, characters = [hero]) => createDnd5eMapCombatSnapshot({ combatId: 'skill-zone', map: nextMap, characters,
    initiativeOrder: nextMap.tokens.map((t, i) => ({ tokenId: t.id, label: t.label, emoji: '', color: '', roll: 20 - i })) })
  return { hero, area, map, snapshot }
}

it('round-trips bounded saving abilities and separate continuous relation',()=>{
 const value={relation:'ally' as const,savingThrowAdvantages:['str'] as const}
 expect(normalizeDnd5ePersistentAreaOccupantModifiers(value)).toMatchObject(value)
 for(const savingThrowAdvantages of [[],['invalid'],['str',7],'str'])expect(normalizeDnd5ePersistentAreaOccupantModifiers({savingThrowAdvantages})).toBeUndefined()
 expect(normalizeDnd5ePersistentAreaOccupantModifiers({relation:'invalid',savingThrowAdvantages:['str']})).toBeUndefined()
 const {map,area}=fixture();area.occupantModifiers=value
 expect(migrateMapsState(JSON.parse(JSON.stringify({maps:[map]}))).maps[0].dnd5ePluginAreas?.[0].occupantModifiers).toMatchObject(value)
})
it('projects allied Strength checks and saves only while inside, without persisting transient advantages',()=>{
 const {map,area,hero,snapshot}=fixture()
 // Initial chosen recipients can be any creature; sustained benefits are allies only.
 area.relation='any';area.occupantModifiers={relation:'ally',abilityCheckRules:[{ability:'str',mode:'advantage'}],savingThrowAdvantages:['str']}
 const mode=(state:ReturnType<typeof snapshot>['state'],id='player')=>({check:dnd5eAbilityCheckRollMode(state.combatants[id],{ability:'str'}),save:dnd5eSavingThrowMode(state.combatants[id],'str')})
 const active=snapshot();expect(mode(active.state)).toEqual({check:'advantage',save:'advantage'})
 expect(mode(active.state,'enemy')).toEqual({check:'normal',save:'normal'})
 expect(dnd5eSavingThrowMode(active.state.combatants.player,'dex')).toBe('normal')
 expect(dnd5eAbilityCheckRollMode(active.state.combatants.player,{ability:'wis'})).toBe('normal')
 const saved=planDnd5eMapResultApplication({state:active.state,map,characters:[hero],characterIdByCombatantId:active.characterIdByCombatantId})
 expect(saved.characters[0].dnd5eCombatState?.activeEffects?.some(e=>e.modifiers?.savingThrowAdvantages?.includes('str'))??false).toBe(false)
 expect(mode(snapshot({...saved.map,dnd5ePluginAreas:[]},saved.characters).state)).toEqual({check:'normal',save:'normal'})
 expect(mode(snapshot({...map,tokens:map.tokens.map(t=>({...t,x:175}))}).state)).toEqual({check:'normal',save:'normal'})
 const anti={...area,id:'anti',occupantModifiers:{suppressesMagic:true}}
 expect(mode(snapshot({...map,dnd5ePluginAreas:[area,anti]}).state)).toEqual({check:'normal',save:'normal'})
})
