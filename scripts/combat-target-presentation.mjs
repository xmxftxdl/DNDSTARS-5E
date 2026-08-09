import {
  isCombatPresentationProjectileSpellId,
  isCombatPresentationTargetEffectSpellId,
} from '../shared/combat-presentation-contract.mjs'

const invalid = () => ({ ok: false, status: 400, error: 'invalid-combat-presentation-event' })

/** Normalize projectile and single-target spell visuals without granting state mutation authority. */
export function normalizeCombatTargetPresentationEvent({
  common,
  payload,
  now,
  normalizedLabel,
  lifetimeMs,
}) {
  if (common.type === 'spell-projectile' && isCombatPresentationProjectileSpellId(common.spellId)) {
    const targetTokenId = normalizedLabel(payload?.targetTokenId, 160)
    const outcome = payload?.outcome
    const accentColor = payload?.accentColor
    const glowColor = payload?.glowColor
    if (
      !targetTokenId || (outcome != null && outcome !== 'hit' && outcome !== 'miss') ||
      (accentColor != null && (typeof accentColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accentColor))) ||
      (glowColor != null && (typeof glowColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(glowColor)))
    ) return invalid()
    return {
      ok: true,
      event: {
        ...common,
        targetTokenId,
        ...(outcome ? { outcome } : {}),
        ...(accentColor ? { accentColor } : {}),
        ...(glowColor ? { glowColor } : {}),
        createdAt: now,
        expiresAt: now + lifetimeMs,
      },
    }
  }
  if (common.type === 'spell-target-effect' && isCombatPresentationTargetEffectSpellId(common.spellId)) {
    const targetTokenId = normalizedLabel(payload?.targetTokenId, 160)
    const accentColor = payload?.accentColor
    const glowColor = payload?.glowColor
    if (
      !targetTokenId || ['resistance', 'spare-the-dying'].includes(common.spellId) && (
        typeof accentColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accentColor) ||
        typeof glowColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(glowColor)
      ) ||
      (accentColor != null && (typeof accentColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(accentColor))) ||
      (glowColor != null && (typeof glowColor !== 'string' || !/^#[0-9a-fA-F]{6}$/.test(glowColor)))
    ) return invalid()
    return {
      ok: true,
      event: {
        ...common,
        targetTokenId,
        ...(accentColor ? { accentColor } : {}),
        ...(glowColor ? { glowColor } : {}),
        createdAt: now,
        expiresAt: now + lifetimeMs,
      },
    }
  }
  if (common.type === 'spell-persistent-target-effect' && common.spellId === 'chill-touch') {
    const targetTokenId = normalizedLabel(payload?.targetTokenId, 160)
    if (!targetTokenId) return invalid()
    return { ok: true, event: { ...common, targetTokenId, createdAt: now, expiresAt: now + lifetimeMs } }
  }
  if (common.type === 'spell-save-target-effect' && common.spellId === 'sacred-flame') {
    const targetTokenId = normalizedLabel(payload?.targetTokenId, 160)
    const outcome = payload?.outcome
    if (!targetTokenId || (outcome != null && outcome !== 'failed-save' && outcome !== 'successful-save')) return invalid()
    return {
      ok: true,
      event: { ...common, targetTokenId, ...(outcome ? { outcome } : {}), createdAt: now, expiresAt: now + lifetimeMs },
    }
  }
  return undefined
}
