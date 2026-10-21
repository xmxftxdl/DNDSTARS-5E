import {expect,it} from 'vitest'
import {resolveControlledWaterInput} from './controlledWaterInput'
it('accepts a finite three-dimensional displacement and removes prompt metadata',()=>{
 const intent={kind:'move' as const,displacementFeet:{x:5,y:0,z:0},promptForChange:true}
 expect(resolveControlledWaterInput(intent,{x:'-3',y:'0',z:'4'})).toEqual({kind:'move',displacementFeet:{x:-3,y:0,z:4}})
 for(const values of [{x:'',y:'0',z:'0'},{x:'Infinity',y:'0',z:'0'},{x:'5',y:'1',z:'0'},{x:'0',y:'0',z:'0'}])expect(resolveControlledWaterInput(intent,values)).toBeUndefined()
})
it('validates appearance and literal shape text without switching the declared mode',()=>{
 const appearance={kind:'appearance' as const,color:'#000000',opacity:1,promptForChange:true}
 expect(resolveControlledWaterInput(appearance,{color:'#123abc',opacity:'0'})).toEqual({kind:'appearance',color:'#123abc',opacity:0})
 expect(resolveControlledWaterInput(appearance,{color:'red',opacity:'1'})).toBeUndefined()
 expect(resolveControlledWaterInput(appearance,{color:'#123abc',opacity:'2'})).toBeUndefined()
 expect(resolveControlledWaterInput({kind:'shape',description:'placeholder'},{description:' <script>鱼</script> '})).toEqual({kind:'shape',description:'<script>鱼</script>'})
 expect(resolveControlledWaterInput({kind:'freeze'},{description:'fish'})).toBeUndefined()
})
it('preserves normalized vector drawing through shape input and shared water persistence',async()=>{
 const {normalizeControlledWaterState}=await import('../../../shared/controlled-water-state.mjs')
 const drawing={version:1,strokes:[{points:[0,0,1,1],color:'#0088ff',width:0.02}]}
 const shape=resolveControlledWaterInput({kind:'shape',description:'placeholder'},{description:'鱼',drawing:JSON.stringify(drawing)})!
 expect(shape).toMatchObject({kind:'shape',description:'鱼',drawing})
 const water={id:'water',positionFeet:{x:0,y:0,z:0},dimensionsFeet:{x:5,y:5,z:5},color:'#0088ff',opacity:0.5,
  appliedActionIds:['shape'],alterations:[{...shape,id:'shape',casterId:'caster',appliedAtWorldMinute:0,expiresAtWorldMinute:60}]}
 expect(normalizeControlledWaterState(JSON.parse(JSON.stringify(water)))?.alterations[0]).toMatchObject({drawing})
 expect(resolveControlledWaterInput({kind:'shape',description:'placeholder'},{description:'鱼',drawing:'{"version":1,"strokes":[]}'})).toBeUndefined()
 const broken=structuredClone(water) as any;broken.alterations[0].drawing.strokes[0].points[0]=2
 expect(normalizeControlledWaterState(broken)).toBeUndefined()
})
