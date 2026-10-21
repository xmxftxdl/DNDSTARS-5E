import { expect, it } from 'vitest'
import { dnd5ePathIsStraightLine } from './movementPathStraightness'

it.each([
  { name: 'flat', x: [0, 50, 100], z: [0, 0, 0], straight: true },
  { name: 'slope', x: [0, 50, 100], z: [0, 5, 10], straight: true },
  { name: 'vertical', x: [0, 0, 0], z: [0, 5, 10], straight: true },
  { name: 'hill', x: [0, 50, 100], z: [0, 10, 0], straight: false },
  { name: 'backtrack', x: [0, 75, 50, 100], z: [0, 0, 0, 0], straight: false },
  { name: 'vertical-backtrack', x: [0, 0, 0, 0], z: [0, 7, 5, 10], straight: false },
  { name: 'unknown-height', x: [0, 100], z: [], straight: false },
  { name: 'stationary', x: [0, 0], z: [0, 0], straight: false },
])('requires a monotonic 3D line: $name', ({ x, z, straight }) => {
  expect(dnd5ePathIsStraightLine(x.map(x => ({ x, y: 0 })), z)).toBe(straight)
})
