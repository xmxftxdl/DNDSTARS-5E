export const DEFAULT_CHARACTER_AVATAR = '🧝'

type GraphemeSegmenter = {
  segment: (input: string) => Iterable<{ segment: string }>
}

type GraphemeSegmenterConstructor = new (
  locale?: string,
  options?: { granularity: 'grapheme' },
) => GraphemeSegmenter

/**
 * Token 头像只保存一个可见字素。这样既支持普通 Emoji，也不会拆开带肤色、
 * 变体选择符或 ZWJ 的组合 Emoji；旧浏览器则安全退回到首个码点。
 */
export function normalizeCharacterAvatar(
  value: unknown,
  fallback: string = DEFAULT_CHARACTER_AVATAR,
): string {
  if (typeof value !== 'string' || !value.trim()) return fallback
  const trimmed = value.trim()
  const Segmenter = (Intl as unknown as { Segmenter?: GraphemeSegmenterConstructor }).Segmenter
  if (!Segmenter) return Array.from(trimmed)[0] ?? fallback
  const first = new Segmenter('zh-CN', { granularity: 'grapheme' }).segment(trimmed)[Symbol.iterator]().next()
  return first.done ? fallback : first.value.segment
}
