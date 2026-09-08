import { describe, expect, it } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Dnd5eSpellTargetingSession } from '../../application/combat/spells/SpellTargetingContracts'
import { moveEarthSquareTargetingPatch } from './moveEarthTargeting'
import { WallOfFireTargetingControls } from './WallOfFireTargetingControls'

describe('Move Earth area size controls', () => {
  it('keeps both planar dimensions on one 5-foot stepped side length', () => {
    expect(moveEarthSquareTargetingPatch(23)).toEqual({
      areaTargetWidthFeet: 25,
      areaTargetHeightFeet: 25,
    })
    expect(moveEarthSquareTargetingPatch(0)).toEqual({
      areaTargetWidthFeet: 5,
      areaTargetHeightFeet: 5,
    })
    expect(moveEarthSquareTargetingPatch(80)).toEqual({
      areaTargetWidthFeet: 40,
      areaTargetHeightFeet: 40,
    })
  })

  it('renders Programmed Illusion size controls without declaration questions', () => {
    const targeting: Dnd5eSpellTargetingSession = {
      characterId: 'wizard', spellId: 'programmed-illusion', slotLevel: 6,
      maximumTargets: 256, allowDuplicateTargets: false, targetTokenIds: [],
      overchannel: false, empowered: false, draconicResistance: false,
      repellingBlast: false, canSculpt: false, maximumSculptedTargets: 0,
      sculptedTargetIds: [], sculpting: false, maximumCarefulTargets: 0,
      carefulTargetIds: [], carefulSelecting: false, heightenedSelecting: false,
      area: {
        shape: 'rect', origin: 'point', widthFeet: 30, heightFeet: 30,
        minimumWidthFeet: 5, minimumHeightFeet: 5, gridAligned: true,
        placeRangeFeet: 120, rotatable: false,
      },
    }
    const html = renderToStaticMarkup(createElement(WallOfFireTargetingControls, {
      targeting,
      setTargeting: () => undefined,
    }))

    expect(html).toContain('adjustable-area-targeting-controls')
    expect(html).toContain('法术范围宽度')
    expect(html).toContain('法术范围长度')
    expect(html).not.toContain('幻影形态')
    expect(html).not.toContain('触发条件依据')
  })
})
