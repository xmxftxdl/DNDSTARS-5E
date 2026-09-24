// White emission cores measured in color-spray-sprite-v2.png (1254 × 1254).
// The atlas frames do not share an origin, including during the opening flash.
const cores = [
  [116.1, 158.4], [443.9, 158.7], [711, 158.2], [996.7, 161.3],
  [58.8, 464.5], [352.7, 465.3], [653.1, 466.1], [964.9, 466.8],
  [36.1, 766.4], [337.4, 765.4], [649.3, 768.7], [964.3, 768.7],
  [36, 1066], [334.4, 1065.9], [644, 1066], [957.5, 1066],
] as const

export function colorSpraySpriteAnchor(frame: number) {
  const index = Math.max(0, Math.min(15, Math.floor(frame)))
  const [x, y] = cores[index]
  return { x: x / 313.5 - index % 4, y: y / 313.5 - Math.floor(index / 4) }
}
