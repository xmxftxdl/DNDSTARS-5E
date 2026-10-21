import type { Dnd5eContentPackageV2 } from './contentPackageV2'

/** A fresh worker owns its registries; validation cannot install content in the active room. */
export async function validateContentPackageRuntime(value: Dnd5eContentPackageV2): Promise<'registered' | 'unavailable'> {
  if (typeof Worker === 'undefined') return 'unavailable'
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL('./contentPackageRuntimeValidation.worker.ts', import.meta.url), { type: 'module' })
    const finish = (error?: string) => {
      clearTimeout(timeout)
      worker.terminate()
      if (error) reject(new Error(`接收端注册预检失败：${error}`))
      else resolve('registered')
    }
    const timeout = setTimeout(() => finish('校验超时，请重试。'), 30000)
    worker.onmessage = (event: MessageEvent<{ ok: boolean; error?: string }>) => finish(event.data.ok ? undefined : event.data.error ?? 'unknown')
    worker.onerror = () => finish('校验环境无法加载。')
    try { worker.postMessage(value) } catch (error) { finish(String(error)) }
  })
}
