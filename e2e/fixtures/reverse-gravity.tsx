import { useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Stage, Layer, Line, Circle, Text } from 'react-konva'
import { VfxSequenceRenderer } from '../../src/components/map/VfxSequenceRenderer'
function App() {
 const [issuedAt,setIssuedAt]=useState(Date.now())
 return <><button onClick={()=>setIssuedAt(Date.now())}>反重力</button><Stage width={640} height={520}><Layer>
 {Array.from({length:14},(_,i)=><Line key={'x'+i} points={[i*48,0,i*48,520]} stroke="#ffffff0c"/>)}
 {Array.from({length:12},(_,i)=><Line key={'y'+i} points={[0,i*48,640,i*48]} stroke="#ffffff0c"/>)}
 <Circle x={320} y={280} radius={18} fill="#374151" stroke="#9ca3af"/><Text x={297} y={274} text="目标" fill="#e5e7eb"/>
 <VfxSequenceRenderer key={issuedAt} projectile={{id:'reverse-gravity-test',kind:'reverse-gravity',from:{x:90,y:400},to:{x:320,y:280},radiusPx:150,issuedAt,durationMs:1800}}/>
 </Layer></Stage></>
}
createRoot(document.getElementById('root')!).render(<App/> )

