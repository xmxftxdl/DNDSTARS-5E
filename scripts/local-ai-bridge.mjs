import { startLocalAiBridge } from './local-ai-bridge-core.mjs'
import {
  loadLocalAiBridgeConfig,
  localAiBridgeOptionsFromConfig,
} from './local-ai-config-store.mjs'

const port = Number(process.env.ASTRALTRACE_LOCAL_AI_PORT || 47431)
const persisted = await loadLocalAiBridgeConfig()
if (!persisted.found) {
  throw new Error(`Local AI 尚未持久化配置。请先运行 npm run local-ai:configure（配置位置：${persisted.files.config}）。`)
}
const configured = localAiBridgeOptionsFromConfig(persisted.config)

const bridge = await startLocalAiBridge({
  port,
  ollamaUrl: process.env.ASTRALTRACE_OLLAMA_URL,
  llamaCppUrl: process.env.ASTRALTRACE_LLAMA_CPP_URL,
  ...configured,
  usageAuditPath: persisted.files.usage,
})

console.log(`Astral Trace Local AI Bridge 已启动：${bridge.url}`)
console.log(`持久化配置：${persisted.files.config}`)
console.log(`配对码：${bridge.getPairingCode()}`)
console.log('服务仅监听本机回环地址；不要将该端口映射到公网。')

const stop = async () => {
  await bridge.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
