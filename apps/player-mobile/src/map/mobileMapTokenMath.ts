export function mobileTokenScreenRadius(tokenRadius: number, cameraScale: number) {
  return Math.max(2, tokenRadius * cameraScale)
}
