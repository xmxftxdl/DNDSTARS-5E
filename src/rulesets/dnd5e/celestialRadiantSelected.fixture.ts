import {celestialRadiantBundle} from './celestialNative.fixture'
export function celestialRadiantSelectedBundle(){
 const bundle=celestialRadiantBundle(),sub=bundle.definitions.find(d=>d.kind==='subclass')
 if(!sub||sub.kind!=='subclass')throw Error('Real Celestial source required')
 sub.payload.abilities=[...sub.payload.abilities,{schemaVersion:1,id:'radiant-soul-selected-damage',name:'光耀之魂 · 可选伤害',description:'施放造成火焰或光耀伤害的法术时，可将魅力调整值加入一个目标的一次伤害骰。同一次施法只能使用一次。',level:6,trigger:{kind:'after-spell-cast'},targeting:{kind:'self'},effects:[],automation:'full',mechanic:{kind:'spell-damage-selected-ability-modifier',ability:'cha',damageTypes:['fire','radiant'],oncePerSpellCast:true}}]
 return bundle
}
