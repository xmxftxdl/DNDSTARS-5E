// Ambient types for @3d-dice/dice-box-threejs (the package ships no .d.ts).
// Derived from dist/dice-box-threejs.es.js (v0.0.12). Spike: T-P2-395.
declare module '@3d-dice/dice-box-threejs' {
  export interface DiceColorset {
    name: string
    foreground?: string | string[]
    background?: string | string[]
    outline?: string
    texture?: string // "none" => no image asset is fetched
    material?: 'none' | 'metal' | 'wood' | 'glass' | 'plastic'
    description?: string
  }

  export interface DiceBoxThreeConfig {
    framerate?: number
    sounds?: boolean
    volume?: number
    color_spotlight?: number
    shadows?: boolean
    theme_surface?: string
    sound_dieMaterial?: string
    theme_customColorset?: DiceColorset | null
    theme_colorset?: string
    theme_texture?: string
    theme_material?: 'none' | 'metal' | 'wood' | 'glass' | 'plastic'
    gravity_multiplier?: number
    light_intensity?: number
    baseScale?: number
    strength?: number
    dimensions?: { x: number; y: number }
    assetPath?: string
    onRollComplete?: (results: DiceRollResults) => void
  }

  export interface DieRoll {
    type: string // e.g. "d20"
    sides: number
    id: number
    value: number // the face value that is shown up (forced or natural)
    label?: string
    reason?: 'natural' | 'forced' | 'reroll' | 'remove' | string
  }

  export interface DiceSet {
    num: number
    type: string
    sides: number
    rolls: DieRoll[]
    total: number
  }

  export interface DiceRollResults {
    notation: string
    sets: DiceSet[]
    modifier: number
    total: number
  }

  export default class DiceBox {
    constructor(container: string | HTMLElement, config?: DiceBoxThreeConfig)
    initScene?(): Promise<void>
    init?(): Promise<void>
    initialize?(): Promise<void> // real async-init entrypoint in dist v0.0.12 (T-P2-395)
    roll(notation: string): Promise<DiceRollResults>
    add(notation: string): Promise<DieRoll[]>
    reroll(indices: number[]): Promise<DieRoll[]>
    updateConfig(config: DiceBoxThreeConfig): Promise<void>
    clearDice(): void
  }
}
