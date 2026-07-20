export const CHARACTER_PORTRAIT_WIDTH = 480
export const CHARACTER_PORTRAIT_HEIGHT = 640
export const CHARACTER_PORTRAIT_MAX_SOURCE_BYTES = 12 * 1024 * 1024
export const CHARACTER_PORTRAIT_MAX_DATA_URL_LENGTH = 600_000

const SUPPORTED_CHARACTER_PORTRAIT_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

export function isCharacterPortraitDataUrl(value: unknown): value is string {
  return typeof value === 'string' &&
    value.length <= CHARACTER_PORTRAIT_MAX_DATA_URL_LENGTH &&
    /^data:image\/(?:jpeg|png|webp);base64,[a-z0-9+/=\r\n]+$/i.test(value)
}

export function normalizeCharacterPortrait(value: unknown): string | undefined {
  return isCharacterPortraitDataUrl(value) ? value : undefined
}

export function validateCharacterPortraitFile(file: Pick<File, 'size' | 'type'>): string | null {
  if (!SUPPORTED_CHARACTER_PORTRAIT_TYPES.has(file.type.toLowerCase())) {
    return '请选择 PNG、JPG 或 WebP 图片。'
  }
  if (file.size <= 0) return '图片文件为空。'
  if (file.size > CHARACTER_PORTRAIT_MAX_SOURCE_BYTES) return '原图不能超过 12 MB。'
  return null
}

function canvasDataUrl(canvas: HTMLCanvasElement): string {
  const webp = canvas.toDataURL('image/webp', 0.82)
  if (webp.startsWith('data:image/webp')) return webp
  return canvas.toDataURL('image/jpeg', 0.84)
}

export async function createCharacterPortraitDataUrl(file: File): Promise<string> {
  const validationError = validateCharacterPortraitFile(file)
  if (validationError) throw new Error(validationError)

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('无法读取这张图片。'))
      element.src = objectUrl
    })
    if (image.naturalWidth < 1 || image.naturalHeight < 1) throw new Error('图片尺寸无效。')

    const targetRatio = CHARACTER_PORTRAIT_WIDTH / CHARACTER_PORTRAIT_HEIGHT
    const sourceRatio = image.naturalWidth / image.naturalHeight
    const sourceWidth = sourceRatio > targetRatio
      ? image.naturalHeight * targetRatio
      : image.naturalWidth
    const sourceHeight = sourceRatio > targetRatio
      ? image.naturalHeight
      : image.naturalWidth / targetRatio
    const sourceX = (image.naturalWidth - sourceWidth) / 2
    const sourceY = (image.naturalHeight - sourceHeight) / 2

    const canvas = document.createElement('canvas')
    canvas.width = CHARACTER_PORTRAIT_WIDTH
    canvas.height = CHARACTER_PORTRAIT_HEIGHT
    const context = canvas.getContext('2d')
    if (!context) throw new Error('浏览器无法处理这张图片。')
    context.imageSmoothingEnabled = true
    context.imageSmoothingQuality = 'high'
    context.drawImage(
      image,
      sourceX,
      sourceY,
      sourceWidth,
      sourceHeight,
      0,
      0,
      CHARACTER_PORTRAIT_WIDTH,
      CHARACTER_PORTRAIT_HEIGHT,
    )
    const result = canvasDataUrl(canvas)
    if (!isCharacterPortraitDataUrl(result)) throw new Error('压缩后的立绘仍然过大，请换一张图片。')
    return result
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
