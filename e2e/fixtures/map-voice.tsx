import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import MapVoicePanel from '../../src/components/map/MapVoicePanel'
import { VoiceRoomContext, type VoiceRoomContextValue } from '../../src/voice/useVoiceRoom'
import '../../src/index.css'
const role = new URLSearchParams(location.search).get('role') || 'player'
// UI fixture only: no real room, microphone access or voice connection.
const voice = { session: { role, roomId: 'fixture' }, connected: false, enabled: false, joining: false, notice: '拖动测试', voiceChangerConfig: { slots: [] } } as unknown as VoiceRoomContextValue
createRoot(document.getElementById('root')!).render(<MemoryRouter><VoiceRoomContext.Provider value={voice}><main style={{ position: 'relative', width: 900, height: 600 }}><MapVoicePanel /></main></VoiceRoomContext.Provider></MemoryRouter>)
