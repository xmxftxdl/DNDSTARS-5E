/** Keep a map-token name on one line by fitting it to Konva's fixed label box. */
export function mapTokenLabelFontSize(
  label: string,
  availableWidth: number,
  preferredSize: number,
  minimumSize = 7,
): number {
  const glyphUnits = [...label.trim()].reduce((total, glyph) => {
    if (/\s/u.test(glyph)) return total + 0.35
    if ((glyph.codePointAt(0) ?? 0) <= 0xff) return total + 0.62
    return total + 1
  }, 0)
  if (glyphUnits <= 0) return preferredSize
  const fitted = Math.max(0, availableWidth - 8) * 0.92 / glyphUnits
  return Math.max(minimumSize, Math.min(preferredSize, fitted))
}
