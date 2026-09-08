export type PdfWheelPageDirection = 'previous' | 'next'

export function getPdfWheelPageDirection(input: {
  deltaY: number
  scrollTop: number
  clientHeight: number
  scrollHeight: number
}): PdfWheelPageDirection | null {
  const edgeTolerance = 2
  if (input.deltaY > 0 && input.scrollTop + input.clientHeight >= input.scrollHeight - edgeTolerance) return 'next'
  if (input.deltaY < 0 && input.scrollTop <= edgeTolerance) return 'previous'
  return null
}
