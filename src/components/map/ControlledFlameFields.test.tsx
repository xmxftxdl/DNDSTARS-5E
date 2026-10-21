import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ControlledFlameFields, controlledFlameBaseLightPatch } from './ControlledFlameFields'
import { normalizeMapGeometryEntity, type MapGeometryLight } from '../../lib/mapGeometry'
import { projectDnd5eControlledFlame } from '../../rulesets/dnd5e/controlledFlame'

const light:MapGeometryLight={id:'fire',kind:'light',label:'Fire',enabled:true,points:[{x:50,y:50}],
 brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffaa00',elevationFeet:0,createdAt:1}

it('ordinary lights remain unclassified until the DM opts in',()=>{
 const html=renderToStaticMarkup(<ControlledFlameFields light={light} onChange={()=>{}} />)
 expect(html).toContain('实体火焰／燃料')
 expect(html).not.toContain('正在燃烧')
 expect(html).not.toContain('checked=""')
 expect(controlledFlameBaseLightPatch(light,{brightRadiusFeet:40})).toEqual({brightRadiusFeet:40})
})
it('editing the physical base preserves the active effect, survives reload, and restores the edited base at expiry',()=>{
 const current:MapGeometryLight={...light,controlledFlame:{id:'fire',burning:true,magical:false,extentFeet:5,fuelAvailable:true,
  brightRadiusFeet:20,dimRadiusFeet:20,color:'#ffaa00',alterations:[{id:'effect',casterId:'caster',kind:'illumination',
   multiplier:2,appliedAtWorldMinute:480,expiresAtWorldMinute:540}]}}
 const patch=controlledFlameBaseLightPatch(current,{brightRadiusFeet:30,dimRadiusFeet:10,color:'#ffffff'})
 const saved=normalizeMapGeometryEntity(JSON.parse(JSON.stringify({...current,...patch})))
 if(saved?.kind!=='light'||!saved.controlledFlame)throw Error('Lost fire state')
 expect(saved.controlledFlame.alterations).toEqual(current.controlledFlame!.alterations)
 expect(projectDnd5eControlledFlame(saved.controlledFlame,539)).toMatchObject({brightRadiusFeet:60,dimRadiusFeet:20,color:'#ffffff'})
 expect(projectDnd5eControlledFlame(saved.controlledFlame,540)).toMatchObject({brightRadiusFeet:30,dimRadiusFeet:10,color:'#ffffff'})
 const html=renderToStaticMarkup(<ControlledFlameFields light={saved} onChange={()=>{}} />)
 for(const label of ['正在燃烧','魔法火焰','有可燃物','火焰或燃料尺寸'])expect(html).toContain(label)
 expect(current.controlledFlame?.brightRadiusFeet).toBe(20)
})
