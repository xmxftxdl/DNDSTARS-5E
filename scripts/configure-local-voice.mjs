import { stdin, stdout } from 'node:process'
import { createInterface } from 'node:readline/promises'
import {
  loadLocalVoiceConfig,
  saveLocalVoiceConfig,
} from './local-voice-config-store.mjs'

const current = await loadLocalVoiceConfig().catch(() => ({ found: false, config: null }))
const previous = current.config ?? {}

async function question(label, fallback = '') {
  const prompt = createInterface({ input: stdin, output: stdout })
  const suffix = fallback ? ` [${fallback}]` : ''
  try {
    return (await prompt.question(`${label}${suffix}: `)).trim() || fallback
  } finally {
    prompt.close()
  }
}

async function maskedQuestion(label) {
  if (!stdin.isTTY || typeof stdin.setRawMode !== 'function') {
    throw new Error('local-voice-interactive-terminal-required')
  }

  stdout.write(label)
  stdin.setEncoding('utf8')
  stdin.setRawMode(true)
  stdin.resume()

  return await new Promise((resolve, reject) => {
    let value = ''
    const finish = (error) => {
      stdin.off('data', onData)
      stdin.setRawMode(false)
      stdin.pause()
      stdout.write('\n')
      if (error) reject(error)
      else resolve(value.trim())
    }
    const onData = (chunk) => {
      const text = String(chunk)
        .replaceAll('\u001b[200~', '')
        .replaceAll('\u001b[201~', '')
      for (const character of text) {
        if (character === '\u0003') {
          finish(new Error('local-voice-configuration-cancelled'))
          return
        }
        if (character === '\r' || character === '\n') {
          finish()
          return
        }
        if (character === '\u007f' || character === '\b') {
          if (value.length > 0) {
            value = [...value].slice(0, -1).join('')
            stdout.write('\b \b')
          }
          continue
        }
        if (character === '\u001b') continue
        if (character >= ' ') {
          value += character
          stdout.write('*')
        }
      }
    }
    stdin.on('data', onData)
  })
}

console.log('星痕本地语音配置')
console.log('密钥只在当前 PowerShell 中输入，并加密保存；不会显示明文。')
console.log('')

const serverUrl = await question(
  'LiveKit WebSocket URL（云端使用 wss://；本机允许 ws://127.0.0.1:7880）',
  previous.serverUrl ?? 'ws://127.0.0.1:7880',
)
const apiKey = await maskedQuestion(
  `LiveKit API Key${previous.apiKey ? '（留空保留现有值）' : ''}（输入/粘贴会显示星号）: `,
) || previous.apiKey
const apiSecret = await maskedQuestion(
  `LiveKit API Secret${previous.apiSecret ? '（留空保留现有值）' : ''}（输入/粘贴会显示星号）: `,
) || previous.apiSecret

const saved = await saveLocalVoiceConfig({ serverUrl, apiKey, apiSecret })
console.log('')
console.log(`本地语音配置已安全保存：${saved.files.config}`)
console.log(`密钥存储：${saved.config.secretStorage}`)
console.log('重新启动 5273/5274 后会自动载入，无需再设置 PowerShell 临时变量。')
