import type { CameraState } from '../../../../packages/mobile-protocol/src'

export interface MobileTouchPoint {
  pageX: number
  pageY: number
  locationX?: number
  locationY?: number
}

export interface MobileTouchMetrics {
  centerX: number
  centerY: number
  distance: number
}

function localCoordinate(touch: MobileTouchPoint, axis: 'X' | 'Y') {
  const local = touch[`location${axis}`]
  return typeof local === 'number' && Number.isFinite(local) ? local : touch[`page${axis}`]
}

export function mobileTouchMetrics(touches: readonly MobileTouchPoint[]): MobileTouchMetrics {
  const a = touches[0]
  if (!a) return { centerX: 0, centerY: 0, distance: 0 }
  const ax = localCoordinate(a, 'X')
  const ay = localCoordinate(a, 'Y')
  const b = touches[1]
  if (!b) return { centerX: ax, centerY: ay, distance: 0 }
  const bx = localCoordinate(b, 'X')
  const by = localCoordinate(b, 'Y')
  return {
    centerX: (ax + bx) / 2,
    centerY: (ay + by) / 2,
    distance: Math.hypot(ax - bx, ay - by),
  }
}

/** Preserve the world point under the pinch centre while zooming and panning. */
export function cameraForPinch(
  camera: CameraState,
  origin: MobileTouchMetrics,
  next: MobileTouchMetrics,
  minimumScale = 0.035,
  maximumScale = 1.8,
): CameraState {
  if (origin.distance <= 0 || next.distance <= 0) return camera
  const scale = Math.max(minimumScale, Math.min(maximumScale, camera.scale * next.distance / origin.distance))
  const worldX = (origin.centerX - camera.x) / camera.scale
  const worldY = (origin.centerY - camera.y) / camera.scale
  return {
    scale,
    x: next.centerX - worldX * scale,
    y: next.centerY - worldY * scale,
  }
}
