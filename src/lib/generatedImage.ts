export async function generatedImageDataUrlToFile(
  dataUrl: string,
  fileName: string,
): Promise<File> {
  const response = await fetch(dataUrl)
  if (!response.ok) throw new Error('AI 生成图片读取失败。')
  const blob = await response.blob()
  if (!blob.type.startsWith('image/')) throw new Error('AI 返回的内容不是图片。')
  return new File([blob], fileName, { type: blob.type, lastModified: Date.now() })
}
