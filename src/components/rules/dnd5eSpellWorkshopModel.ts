import {
  DND5E_PLUGIN_IMAGE_ASSET_MAX_BYTES,
  validateDnd5ePluginImageAsset,
  type Dnd5ePluginImageAssetDefinition,
  type Dnd5ePluginImageMediaType,
} from '../../rulesets/dnd5e'

export type Dnd5eSpellWorkshopHeadlessStatus = 'full' | 'partial' | 'reference-only'

export interface Dnd5eSpellWorkshopHeadlessInput {
  enabled: boolean
  damageEnabled: boolean
  conditionEnabled: boolean
}

/** A spell is executable only when the editor can emit at least one effect. */
export function dnd5eSpellWorkshopHeadlessStatus(
  input: Dnd5eSpellWorkshopHeadlessInput,
): Dnd5eSpellWorkshopHeadlessStatus {
  if (!input.enabled) return 'reference-only'
  return input.damageEnabled || input.conditionEnabled ? 'full' : 'partial'
}

export function dnd5eSpellWorkshopHeadlessReady(
  input: Dnd5eSpellWorkshopHeadlessInput,
): boolean {
  return dnd5eSpellWorkshopHeadlessStatus(input) === 'full'
}

/** Multi-class spells preview the class the author selected most recently. */
export function dnd5eSpellPreviewClassId(classes: readonly string[]): string {
  return classes.at(-1)?.trim() || 'wizard'
}

function localAssetId(spellId: string): string {
  const safe = spellId.trim().toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 84) || 'custom-spell'
  return `spell-${safe}-icon`
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = ''
  const chunkSize = 0x8000
  for (let offset = 0; offset < bytes.length; offset += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + chunkSize))
  }
  return globalThis.btoa(binary)
}

export async function dnd5eSpellIconAssetFromFile(
  spellId: string,
  file: Pick<File, 'type' | 'size' | 'arrayBuffer'>,
): Promise<Dnd5ePluginImageAssetDefinition> {
  const mediaType = file.type.toLowerCase() as Dnd5ePluginImageMediaType
  if (!['image/png', 'image/jpeg', 'image/webp'].includes(mediaType)) {
    throw new Error('法术图标只支持 PNG、JPG 或 WebP。')
  }
  if (file.size <= 0) throw new Error('法术图标文件为空。')
  if (file.size > DND5E_PLUGIN_IMAGE_ASSET_MAX_BYTES) {
    throw new Error('法术图标不能超过 384 KiB，请先压缩或缩小图片。')
  }
  const asset: Dnd5ePluginImageAssetDefinition = {
    id: localAssetId(spellId),
    mediaType,
    dataBase64: bytesToBase64(new Uint8Array(await file.arrayBuffer())),
  }
  const validated = validateDnd5ePluginImageAsset(asset)
  return { ...asset, dataBase64: validated.dataBase64 }
}

export function dnd5eSpellIconAssetDataUrl(
  asset: Dnd5ePluginImageAssetDefinition | undefined,
): string | undefined {
  return asset ? `data:${asset.mediaType};base64,${asset.dataBase64}` : undefined
}

export interface Dnd5eSpellIconPromptInput {
  name: string
  englishName?: string
  school?: string
  description?: string
  damageType?: string
}

/** The generated bitmap is only the painted foreground; the host supplies the class frame. */
export function buildDnd5eSpellIconPrompt(input: Dnd5eSpellIconPromptInput): string {
  return [
    `Create a polished fantasy spell icon foreground for “${input.name || input.englishName || 'Custom Spell'}”.`,
    input.englishName ? `English name: ${input.englishName}.` : '',
    input.school ? `Magic school: ${input.school}.` : '',
    input.damageType ? `Damage or energy type: ${input.damageType}.` : '',
    input.description ? `Spell concept: ${input.description.trim().slice(0, 900)}` : '',
    'Square composition, one centered readable magical subject, strong silhouette, generous empty margin around the subject.',
    'MANDATORY: output only the isolated spell artwork on a fully transparent alpha background. No scenery, backdrop, gradient, vignette, fog layer, colored canvas, square tile, or background glow filling the image.',
    'Do not draw a frame, border, class color panel, text, number, logo, watermark, UI button, or rounded-square container. The application will place this transparent foreground above the class-specific background, ornament, border, and glow.',
  ].filter(Boolean).join('\n')
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality?: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(
    (blob) => blob ? resolve(blob) : reject(new Error('法术图标编码失败。')),
    type,
    quality,
  ))
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function removeGeneratedIconBackdrop(
  context: CanvasRenderingContext2D,
  size: number,
  inset: number,
): void {
  const image = context.getImageData(0, 0, size, size)
  const samples: Array<[number, number, number]> = []
  const patchSize = 18
  const starts = [
    [inset + 2, inset + 2],
    [size - inset - patchSize - 2, inset + 2],
    [inset + 2, size - inset - patchSize - 2],
    [size - inset - patchSize - 2, size - inset - patchSize - 2],
  ]
  for (const [startX, startY] of starts) {
    let red = 0
    let green = 0
    let blue = 0
    let weight = 0
    for (let y = startY; y < startY + patchSize; y += 3) {
      for (let x = startX; x < startX + patchSize; x += 3) {
        const offset = (y * size + x) * 4
        const alpha = image.data[offset + 3] / 255
        if (alpha <= 0.05) continue
        red += image.data[offset] * alpha
        green += image.data[offset + 1] * alpha
        blue += image.data[offset + 2] * alpha
        weight += alpha
      }
    }
    if (weight > 0) samples.push([red / weight, green / weight, blue / weight])
  }
  if (samples.length === 0) return
  const backdrop = samples.reduce<[number, number, number]>(
    (total, sample) => [total[0] + sample[0], total[1] + sample[1], total[2] + sample[2]],
    [0, 0, 0],
  ).map((value) => value / samples.length) as [number, number, number]
  const cornerSpread = Math.max(...samples.map(([red, green, blue]) => Math.hypot(
    red - backdrop[0],
    green - backdrop[1],
    blue - backdrop[2],
  )))
  const confidence = 1 - clamp01((cornerSpread - 18) / 80)
  if (confidence <= 0.05) return

  for (let offset = 0; offset < image.data.length; offset += 4) {
    const originalAlpha = image.data[offset + 3]
    if (originalAlpha === 0) continue
    const red = image.data[offset]
    const green = image.data[offset + 1]
    const blue = image.data[offset + 2]
    const distance = Math.hypot(red - backdrop[0], green - backdrop[1], blue - backdrop[2])
    const chroma = Math.max(red, green, blue) - Math.min(red, green, blue)
    const separated = clamp01((distance - 14) / 58)
    const saturatedSubject = clamp01((chroma - 20) / 74) * 0.9
    const subjectAlpha = Math.max(separated, saturatedSubject)
    const keyedAlpha = 1 - confidence * (1 - subjectAlpha)
    image.data[offset + 3] = Math.round(originalAlpha * keyedAlpha)
  }
  context.putImageData(image, 0, 0)
}

/**
 * Converts an AI-generated square illustration into a transparent-edge foreground layer.
 * This keeps the semantic class backdrop and frame visible in Dnd5eActionIcon.
 */
export async function dnd5eSpellIconAssetFromGeneratedDataUrl(
  spellId: string,
  dataUrl: string,
): Promise<Dnd5ePluginImageAssetDefinition> {
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error('AI 法术图标读取失败。')
  const sourceBlob = await response.blob()
  if (!sourceBlob.type.startsWith('image/')) throw new Error('AI 返回的内容不是图片。')
  const source = await createImageBitmap(sourceBlob)
  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const context = canvas.getContext('2d')
  if (!context) {
    source.close()
    throw new Error('当前浏览器无法处理法术图标。')
  }
  const sourceSide = Math.min(source.width, source.height)
  const sourceX = (source.width - sourceSide) / 2
  const sourceY = (source.height - sourceSide) / 2
  context.clearRect(0, 0, size, size)
  const inset = 8
  context.drawImage(source, sourceX, sourceY, sourceSide, sourceSide, inset, inset, size - inset * 2, size - inset * 2)
  source.close()

  removeGeneratedIconBackdrop(context, size, inset)

  context.globalCompositeOperation = 'destination-in'
  const mask = context.createRadialGradient(size / 2, size / 2, size * 0.34, size / 2, size / 2, size * 0.49)
  mask.addColorStop(0, 'rgba(0,0,0,1)')
  mask.addColorStop(0.68, 'rgba(0,0,0,1)')
  mask.addColorStop(0.88, 'rgba(0,0,0,0.82)')
  mask.addColorStop(1, 'rgba(0,0,0,0)')
  context.fillStyle = mask
  context.fillRect(0, 0, size, size)
  context.globalCompositeOperation = 'source-over'

  const blob = await canvasBlob(canvas, 'image/webp', 0.88)
  return dnd5eSpellIconAssetFromFile(spellId, new File(
    [blob],
    `${localAssetId(spellId)}.webp`,
    { type: 'image/webp', lastModified: Date.now() },
  ))
}
