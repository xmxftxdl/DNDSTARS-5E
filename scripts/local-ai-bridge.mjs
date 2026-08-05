import { startLocalAiBridge } from './local-ai-bridge-core.mjs'

const port = Number(process.env.ASTRALTRACE_LOCAL_AI_PORT || 47431)
const allowedOrigins = process.env.ASTRALTRACE_LOCAL_AI_ORIGINS
  ? process.env.ASTRALTRACE_LOCAL_AI_ORIGINS.split(',').map((value) => value.trim()).filter(Boolean)
  : undefined

const bridge = await startLocalAiBridge({
  port,
  ollamaUrl: process.env.ASTRALTRACE_OLLAMA_URL,
  llamaCppUrl: process.env.ASTRALTRACE_LLAMA_CPP_URL,
  externalApiUrl: process.env.ASTRALTRACE_MODEL_API_URL,
  externalApiKey: process.env.ASTRALTRACE_MODEL_API_KEY,
  externalModelId: process.env.ASTRALTRACE_MODEL_ID,
  externalModelDisplayName: process.env.ASTRALTRACE_MODEL_DISPLAY_NAME,
  externalModelContextWindow: process.env.ASTRALTRACE_MODEL_CONTEXT_WINDOW,
  externalExtractionApiUrl: process.env.ASTRALTRACE_EXTRACTION_MODEL_API_URL,
  externalExtractionApiKey: process.env.ASTRALTRACE_EXTRACTION_MODEL_API_KEY,
  externalExtractionModelId: process.env.ASTRALTRACE_EXTRACTION_MODEL_ID,
  externalExtractionModelDisplayName: process.env.ASTRALTRACE_EXTRACTION_MODEL_DISPLAY_NAME,
  externalExtractionModelContextWindow: process.env.ASTRALTRACE_EXTRACTION_MODEL_CONTEXT_WINDOW,
  externalSynthesisApiUrl: process.env.ASTRALTRACE_SYNTHESIS_MODEL_API_URL,
  externalSynthesisApiKey: process.env.ASTRALTRACE_SYNTHESIS_MODEL_API_KEY,
  externalSynthesisModelId: process.env.ASTRALTRACE_SYNTHESIS_MODEL_ID,
  externalSynthesisModelDisplayName: process.env.ASTRALTRACE_SYNTHESIS_MODEL_DISPLAY_NAME,
  externalSynthesisModelContextWindow: process.env.ASTRALTRACE_SYNTHESIS_MODEL_CONTEXT_WINDOW,
  externalImageApiUrl: process.env.ASTRALTRACE_IMAGE_MODEL_API_URL,
  externalImageApiKey: process.env.ASTRALTRACE_IMAGE_MODEL_API_KEY,
  externalImageModelId: process.env.ASTRALTRACE_IMAGE_MODEL_ID,
  externalImageDefaultQuality: process.env.ASTRALTRACE_IMAGE_DEFAULT_QUALITY,
  allowedOrigins,
})

console.log(`Astral Trace Local AI Bridge 已启动：${bridge.url}`)
console.log(`配对码：${bridge.getPairingCode()}`)
console.log('服务仅监听本机回环地址；不要将该端口映射到公网。')

const stop = async () => {
  await bridge.close()
  process.exit(0)
}
process.on('SIGINT', stop)
process.on('SIGTERM', stop)
