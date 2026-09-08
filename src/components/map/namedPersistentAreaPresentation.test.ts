import { describe, expect, it } from 'vitest'
import { dnd5eNamedPersistentAreaPresentation } from './namedPersistentAreaPresentation'

describe('named persistent-area presentation', () => {
  it('keeps illusion and servant areas visually and semantically distinct', () => {
    expect(dnd5eNamedPersistentAreaPresentation('silent-image')).toMatchObject({
      label: '无声幻影',
      glyph: '幻',
      iconAsset: '/assets/icons/silent-image-spell-action.png',
      kind: 'illusion',
    })
    expect(dnd5eNamedPersistentAreaPresentation('unseen-servant')).toMatchObject({
      label: '隐形仆役',
      glyph: '仆',
      iconAsset: '/assets/icons/unseen-servant-spell-action.png',
      kind: 'servant',
    })
    expect(dnd5eNamedPersistentAreaPresentation('major-image')).toMatchObject({
      label: '高等幻影',
      glyph: '幻',
      iconAsset: '/assets/icons/major-image-spell-action.png',
      kind: 'illusion',
    })
    expect(dnd5eNamedPersistentAreaPresentation('mislead')).toMatchObject({
      label: '假象术',
      iconAsset: '/assets/icons/mislead-spell-action.png',
      kind: 'projection',
    })
    expect(dnd5eNamedPersistentAreaPresentation('project-image')).toMatchObject({
      label: '投影术',
      glyph: '映',
      iconAsset: '/assets/icons/project-image-spell-action.png',
      kind: 'projection',
      projectionStyle: 'remote-beacon',
    })
    expect(dnd5eNamedPersistentAreaPresentation('silent-image')).not.toEqual(
      dnd5eNamedPersistentAreaPresentation('unseen-servant'),
    )
  })
})
