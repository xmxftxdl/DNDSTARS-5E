import { useRef, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { Stage, Layer } from 'react-konva'
import type Konva from 'konva'
import { TokenNode } from '../../src/components/map/MapTokenNode'
import Dnd5eActiveEffectDetailsDialog from '../../src/components/map/Dnd5eActiveEffectDetailsDialog'
import MapCombatUnitDrawer from '../../src/presentation/maps/MapCombatUnitDrawer'
import MapReferencePanel, { MapReferenceProvider } from '../../src/presentation/maps/MapReferencePanel'
import type { MapTokenStatusInstance } from '../../src/components/map/mapTokenStatusInstance'
import type { Token } from '../../src/store/maps'
import '../../src/index.css'
function App() {
 const stage = useRef<Konva.Stage>(null)
 const [instance, setInstance] = useState<MapTokenStatusInstance | null>(null)
 const pdf = new URLSearchParams(location.search).has('pdf')
 const token = { id: 'test-token', type: 'player', x: 200, y: 200, size: 1, color: '#888', label: '状态测试角色' } as Token
 Object.assign(window, { statusCenter: () => { const circle = stage.current!.findOne('Circle')!; const rect = circle.getClientRect(); const host = stage.current!.container().getBoundingClientRect(); return { x: host.x + rect.x + rect.width / 2, y: host.y + rect.y + rect.height / 2 } } })
 if (new URLSearchParams(location.search).has('weakness')) return <>
   <p style={{padding:20,color:'white'}}>衰弱：无来源（白）／法师来源（蓝）／牧师来源（金）</p>
   <Stage width={650} height={360}><Layer>{['#ffffff','#3B82F6','#FBBF24'].map((borderColor,index) =>
     <TokenNode key={borderColor} token={{...token,id:`weak-${index}`,x:100+index*200,y:140,size:2,label:['无来源','法师来源','牧师来源'][index]}}
       gridSize={65} selected={false} derivedTokenStatusMarkers={[{schemaVersion:1,id:`weak-${index}`,statusId:'weakened',source:'headless',label:'衰弱射线',borderColor}]}
       onSelect={()=>{}} onDragEnd={()=>{}} />
   )}</Layer></Stage>
 </>
 return <MapReferenceProvider enabled={pdf}><div className="flex h-screen"><>{pdf && <MapReferencePanel><p>PDF 测试页签</p></MapReferencePanel>}</><main className="relative flex-1"><Stage ref={stage} width={650} height={600}><Layer><TokenNode renderMode="vitals" token={token} gridSize={80} selected={false} standardConditions={['poisoned']} onStatusTooltipChange={() => {}} onStatusTokenClick={setInstance} onSelect={() => {}} onDragEnd={() => {}} /></Layer></Stage><MapCombatUnitDrawer open={pdf} unitKey="test-token" activeTab="stats" actionsAvailable={false} onTabChange={() => {}} onClose={() => {}}><p>单位资料</p></MapCombatUnitDrawer>{instance && <Dnd5eActiveEffectDetailsDialog targetName="状态测试角色" effects={[]} instance={instance} onClose={() => setInstance(null)} />}</main></div></MapReferenceProvider>
}
createRoot(document.getElementById('root')!).render(<App />)
