import { createInterface as createPromiseInterface } from 'node:readline/promises'
import { createInterface as createCallbackInterface } from 'node:readline'
import { stdin, stdout } from 'node:process'
import { AI_MODEL_POLICY } from '../shared/ai-model-policy.mjs'
import {
  defaultLocalAiConfigDirectory,
  loadLocalAiBridgeConfig,
  saveLocalAiBridgeConfig,
} from './local-ai-config-store.mjs'

const imported = process.argv.includes('--import-env')
const current = await loadLocalAiBridgeConfig().catch(() => ({ found: false, config: null }))
const previous = current.config ?? {}

async function maskedQuestion(label) {
  if (!stdin.isTTY) return ''
  return await new Promise((resolve) => {
    const prompt = createCallbackInterface({ input: stdin, output: stdout, terminal: true })
    let muted = false
    const originalWrite = prompt._writeToOutput.bind(prompt)
    prompt._writeToOutput = (value) => {
      if (!muted) {
        originalWrite(value)
        return
      }
      // Keep the actual secret hidden, but give visible feedback for typing,
      // paste and deletion. Keeping the masked text the same width as the
      // secret also lets readline's cursor/backspace handling remain correct.
      if (value.includes('\n') || value.includes('\r')) {
        stdout.write('\n')
        return
      }
      if (value.startsWith(label)) {
        const secretPart = value.slice(label.length)
        originalWrite(`${label}${'*'.repeat([...secretPart].length)}`)
        return
      }
      if (value === ' ') {
        originalWrite(value)
        return
      }
      const visibleInput = value
        .replace(/^\u001b\[200~/, '')
        .replace(/\u001b\[201~$/, '')
      originalWrite('*'.repeat([...visibleInput].length))
    }
    prompt.question(label, (answer) => {
      muted = false
      prompt.close()
      resolve(answer
        .replace(/^\u001b\[200~/, '')
        .replace(/\u001b\[201~$/, '')
        .trim())
    })
    muted = true
  })
}

let input
if (imported) {
  input = {
    apiUrl: process.env.ASTRALTRACE_MODEL_API_URL || previous.apiUrl,
    apiKey: process.env.ASTRALTRACE_MODEL_API_KEY || previous.apiKey,
    imageApiUrl: process.env.ASTRALTRACE_IMAGE_MODEL_API_URL || previous.imageApiUrl,
    imageApiKey: process.env.ASTRALTRACE_IMAGE_MODEL_API_KEY || previous.imageApiKey,
    ocrApiUrl: process.env.ASTRALTRACE_OCR_API_URL || previous.ocrApiUrl,
    ocrApiKey: process.env.ASTRALTRACE_OCR_API_KEY || previous.ocrApiKey,
    ocrEngineId: process.env.ASTRALTRACE_OCR_ENGINE || previous.ocrEngineId,
    allowedOrigins: process.env.ASTRALTRACE_LOCAL_AI_ORIGINS
      ? process.env.ASTRALTRACE_LOCAL_AI_ORIGINS.split(',')
      : previous.allowedOrigins,
  }
} else {
  const ask = async (label, fallback = '') => {
    const prompt = createPromiseInterface({ input: stdin, output: stdout })
    const suffix = fallback ? ` [${fallback}]` : ''
    try {
      return (await prompt.question(`${label}${suffix}: `)).trim() || fallback
    } finally {
      prompt.close()
    }
  }
  const apiUrl = await ask('OpenAI-compatible API URL', previous.apiUrl)
  const apiKey = await maskedQuestion(`API Key${previous.apiKey ? '（留空保留现有值）' : ''}（输入或粘贴后显示星号）: `) || previous.apiKey
  const imageApiUrl = await ask('图片 API URL', previous.imageApiUrl || apiUrl)
  const imageApiKey = await maskedQuestion(`图片 API Key${previous.imageApiKey ? '（留空保留现有值）' : '（留空复用文本 Key）'}（输入或粘贴后显示星号）: `) || previous.imageApiKey || apiKey
  const ocrApiUrl = await ask('RapidOCR URL（可留空）', previous.ocrApiUrl)
  const origins = await ask('允许的站点 Origin，逗号分隔（可留空使用内置安全列表）', (previous.allowedOrigins ?? []).join(','))
  input = {
    apiUrl,
    apiKey,
    imageApiUrl,
    imageApiKey,
    ocrApiUrl,
    ocrApiKey: previous.ocrApiKey,
    ocrEngineId: 'rapidocr',
    allowedOrigins: origins.split(',').map((value) => value.trim()).filter(Boolean),
  }
}

const saved = await saveLocalAiBridgeConfig(input)
console.log(`Local AI 配置已安全保存：${saved.files.config}`)
console.log(`密钥存储：${saved.config.secretStorage}`)
console.log(`统一模型：PDF 分段 ${AI_MODEL_POLICY.pdfExtractionModelId}；PDF 综合 ${AI_MODEL_POLICY.pdfSynthesisModelId}；其他文本 ${AI_MODEL_POLICY.generalModelId}；图片 ${AI_MODEL_POLICY.imageModelId}/${AI_MODEL_POLICY.imageQuality}`)
console.log(`今后直接运行 npm run local-ai-bridge，无需再次设置临时环境变量。`)
