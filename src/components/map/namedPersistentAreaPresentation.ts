import type { Dnd5ePersistentAreaVisualPreset } from '../../rulesets/dnd5e/persistentAreaTypes'

export type Dnd5eNamedPersistentAreaPreset = Extract<
  Dnd5ePersistentAreaVisualPreset,
  'silent-image' | 'major-image' | 'unseen-servant' | 'mislead' | 'project-image'
>

export interface Dnd5eNamedPersistentAreaPresentation {
  label: string
  glyph: string
  iconAsset: string
  fill: string
  border: string
  glow: string
  labelFill: string
  kind: 'illusion' | 'servant' | 'projection'
  projectionStyle?: 'echo' | 'remote-beacon'
}

const PRESENTATIONS: Readonly<Record<
  Dnd5eNamedPersistentAreaPreset,
  Dnd5eNamedPersistentAreaPresentation
>> = {
  'silent-image': {
    label: '无声幻影',
    glyph: '幻',
    iconAsset: '/assets/icons/silent-image-spell-action.png',
    fill: '#5b21b6',
    border: '#c4b5fd',
    glow: '#a78bfa',
    labelFill: 'rgba(30,15,60,0.9)',
    kind: 'illusion',
  },
  'major-image': {
    label: '高等幻影',
    glyph: '幻',
    iconAsset: '/assets/icons/major-image-spell-action.png',
    fill: '#4c1d95',
    border: '#ddd6fe',
    glow: '#c4b5fd',
    labelFill: 'rgba(35,18,70,0.92)',
    kind: 'illusion',
  },
  'unseen-servant': {
    label: '隐形仆役',
    glyph: '仆',
    iconAsset: '/assets/icons/unseen-servant-spell-action.png',
    fill: '#155e75',
    border: '#a5f3fc',
    glow: '#22d3ee',
    labelFill: 'rgba(4,35,44,0.92)',
    kind: 'servant',
  },
  mislead: {
    label: '假象术',
    glyph: '影',
    iconAsset: '/assets/icons/mislead-spell-action.png',
    fill: '#312e81',
    border: '#a78bfa',
    glow: '#7dd3fc',
    labelFill: 'rgba(23,20,66,0.9)',
    kind: 'projection',
    projectionStyle: 'echo',
  },
  'project-image': {
    label: '投影术',
    glyph: '映',
    iconAsset: '/assets/icons/project-image-spell-action.png',
    fill: '#083344',
    border: '#a5f3fc',
    glow: '#22d3ee',
    labelFill: 'rgba(3,30,40,0.92)',
    kind: 'projection',
    projectionStyle: 'remote-beacon',
  },
}

export function dnd5eNamedPersistentAreaPresentation(
  preset: string,
): Dnd5eNamedPersistentAreaPresentation | undefined {
  return PRESENTATIONS[preset as Dnd5eNamedPersistentAreaPreset]
}
