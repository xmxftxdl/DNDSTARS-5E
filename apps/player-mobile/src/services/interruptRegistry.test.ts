import { describe, expect, it } from 'vitest'
import type { MobileInterruptView } from '../../../../packages/mobile-protocol/src'
import { buildMobileInterruptRegistry, resolveMobileInterruptDescriptor, safeInterruptOptions } from './interruptRegistry'

function interrupt(kind: string, payload: Record<string, unknown>): MobileInterruptView {
  return { id: 'interrupt-1', mapId: 'map', kind, status: 'open', payload, updatedAt: 1 }
}

describe('mobile interrupt registry', () => {
  const registry = buildMobileInterruptRegistry()

  it('projects builtin response keys from the closed registry', () => {
    expect(resolveMobileInterruptDescriptor(registry, interrupt('shield-spell', {}))).toMatchObject({
      mode: 'boolean', responseKey: 'useShieldSpell', useLabel: '施放护盾术',
    })
  })

  it('supports Host-declared option interrupts with bounded pure data', () => {
    const current = interrupt('homebrew-choice', {
      mobilePresentation: { schemaVersion: 1, mode: 'option-list', optionIdKey: 'choiceId', optionsPayloadKey: 'choices' },
      choices: [{ id: 'one', label: '选项一', description: '由 Host 再验证' }, { id: 2, label: '非法' }],
    })
    const descriptor = resolveMobileInterruptDescriptor(registry, current)
    expect(descriptor).toMatchObject({ mode: 'option-list', optionIdKey: 'choiceId' })
    expect(safeInterruptOptions(current, descriptor)).toEqual([{ id: 'one', label: '选项一', description: '由 Host 再验证' }])
  })

  it('rejects dangerous response keys and fails closed', () => {
    const descriptor = resolveMobileInterruptDescriptor(registry, interrupt('unsafe', {
      mobilePresentation: { schemaVersion: 1, mode: 'boolean', responseKey: '__proto__', useLabel: '运行' },
    }))
    expect(descriptor.mode).toBe('host-only')
  })
})

