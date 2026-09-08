import { describe, expect, it } from 'vitest'
import { resolveDmInventoryDistributorSelection } from './Dnd5eDmInventoryDistributor'

describe('resolveDmInventoryDistributorSelection', () => {
  it('keeps a valid explicit selection', () => {
    expect(resolveDmInventoryDistributorSelection('b', [{ id: 'a' }, { id: 'b' }])).toBe('b')
  })

  it('selects the sole visible option when the current value is unavailable', () => {
    expect(resolveDmInventoryDistributorSelection('', [{ id: 'wizard' }])).toBe('wizard')
    expect(resolveDmInventoryDistributorSelection('healing-potion', [{ id: 'gold-dust' }])).toBe('gold-dust')
  })

  it('requires an explicit choice when multiple options remain', () => {
    expect(resolveDmInventoryDistributorSelection('', [{ id: 'a' }, { id: 'b' }])).toBe('')
  })
})
