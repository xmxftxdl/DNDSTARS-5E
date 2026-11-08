import {expect,it} from 'vitest'
import {activityNegationAuthorityFingerprint as fingerprint} from './activityNegationAuthority'
function fixture(){return {maps:[{id:'current',tokens:[{id:'enemy',x:325,y:275,hp:100,conditions:[] as string[],effects:[] as string[],dnd5eWorldTimeAppliedMinute:undefined as number|undefined}]},{id:'other',tokens:[]}],characters:[{id:'owner',currentHp:94,resources:{uses:1},conditions:[] as string[]}],worldMinute:100 as number|null|undefined}}
it('allows only the reproduced token time-projection receipt without mutating either snapshot',()=>{
  const before=fixture(),after=structuredClone(before)
  after.maps[0].tokens[0].dnd5eWorldTimeAppliedMinute=100
  expect(fingerprint(after)).toBe(fingerprint(before))
  expect(before.maps[0].tokens[0].dnd5eWorldTimeAppliedMinute).toBeUndefined()
  expect(after.maps[0].tokens[0].dnd5eWorldTimeAppliedMinute).toBe(100)
})
it('retains all actual creature, map, character, resource and clock changes',()=>{
  const before=fixture()
  const edits=[
    (v:ReturnType<typeof fixture>)=>{v.worldMinute=101},
    (v:ReturnType<typeof fixture>)=>{v.maps[0].tokens[0].hp=99},
    (v:ReturnType<typeof fixture>)=>{v.maps[0].tokens[0].x=375},
    (v:ReturnType<typeof fixture>)=>{v.maps[0].tokens[0].effects.push('blinded')},
    (v:ReturnType<typeof fixture>)=>{v.maps[0].tokens[0].conditions.push('incapacitated')},
    (v:ReturnType<typeof fixture>)=>{v.maps[1].id='changed-other-map'},
    (v:ReturnType<typeof fixture>)=>{v.characters[0].currentHp=90},
    (v:ReturnType<typeof fixture>)=>{v.characters[0].resources.uses=0},
  ]
  for(const edit of edits){const after=structuredClone(before);edit(after);expect(fingerprint(after)).not.toBe(fingerprint(before))}
  const times=[0,undefined,null].map(worldMinute=>fingerprint({...before,worldMinute}))
  expect(new Set(times).size).toBe(3)
})
