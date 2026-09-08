import { describe, expect, it } from 'vitest'
import {
  dnd5eCreationDurationMinutes,
  dnd5eCreationMaximumEdgeFeet,
  normalizeDnd5eCreationDeclarationV1,
} from './creation'

describe('Creation', () => {
  it('scales the enclosing cube edge by five feet for each higher slot', () => {
    expect([5, 6, 7, 8, 9].map(dnd5eCreationMaximumEdgeFeet)).toEqual([5, 10, 15, 20, 25])
    expect(dnd5eCreationMaximumEdgeFeet(4)).toBe(0)
  })

  it('uses the shortest duration for a mixed-material object', () => {
    expect(dnd5eCreationDurationMinutes(['plant'])).toBe(1_440)
    expect(dnd5eCreationDurationMinutes(['stone-or-crystal'])).toBe(720)
    expect(dnd5eCreationDurationMinutes(['plant', 'gemstone'])).toBe(10)
    expect(dnd5eCreationDurationMinutes(['precious-metal', 'adamantine-or-mithral'])).toBe(1)
  })

  it('normalizes only bounded, unique declarations', () => {
    const declaration = {
      schemaVersion: 1,
      objectDescription: '  宝石镶嵌木箱  ',
      materials: ['plant', 'gemstone'],
      edgeFeet: 10,
      targetCell: { col: 4, row: 7 },
    }
    expect(normalizeDnd5eCreationDeclarationV1(declaration)).toEqual({
      ...declaration,
      objectDescription: '宝石镶嵌木箱',
    })
    expect(normalizeDnd5eCreationDeclarationV1({ ...declaration, materials: ['plant', 'plant'] })).toBeUndefined()
    expect(normalizeDnd5eCreationDeclarationV1({ ...declaration, edgeFeet: 26 })).toBeUndefined()
  })
})
