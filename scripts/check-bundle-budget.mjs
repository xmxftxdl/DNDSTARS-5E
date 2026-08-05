import { readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'

const distDir = path.resolve('dist')
const assetsDir = path.join(distDir, 'assets')
const assets = await readdir(assetsDir)
const mainFile = assets.find((name) => /^main-[^.]+\.js$/.test(name))

if (!mainFile) throw new Error('未找到生产入口 main-*.js；请先执行 npm run build')

const mainBytes = (await stat(path.join(assetsDir, mainFile))).size
const mainBudgetBytes = 300 * 1024
if (mainBytes > mainBudgetBytes) {
  throw new Error(`生产入口 ${mainFile} 为 ${(mainBytes / 1024).toFixed(1)} KiB，超过 ${mainBudgetBytes / 1024} KiB 预算`)
}

const indexHtml = await readFile(path.join(distDir, 'index.html'), 'utf8')
for (const deferredChunk of [
  'MapsPage-',
  'monsterTurnPlanner-',
  'SceneCanvas-',
  'diceFrame-',
]) {
  if (indexHtml.includes(deferredChunk)) {
    throw new Error(`首页不应预加载重型异步资源：${deferredChunk}`)
  }
}

for (const expectedChunk of [
  'MapsPage-',
  'monsterTurnPlanner-',
  'SceneCanvas-',
  'dnd5e-plugin-protocol-',
  'dnd5e-plugin-registry-',
  'dnd5e-plugin-headless-runtime-',
  'dnd5e-plugin-compiler-',
  'diceFrame-',
]) {
  if (!assets.some((name) => name.startsWith(expectedChunk) && name.endsWith('.js'))) {
    throw new Error(`缺少预期的独立生产资源：${expectedChunk}*.js`)
  }
}

console.log(`生产包预算通过：入口 ${(mainBytes / 1024).toFixed(1)} KiB；地图、SRD 怪物目录和 3D 骰子均延迟加载。`)
