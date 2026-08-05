import { useEffect, useRef } from 'react'
import { Circle, Group, Line } from 'react-konva'
import Konva from 'konva'
import type { CombatPresentationAttackTargetEffect } from '../../lib/combatPresentation'
import { DND5E_CLASS_ICON_PALETTES } from '../../lib/dnd5eActionIcons'
import type { MapProjectile } from './mapCanvasContracts'
import { ProjectileArrow } from './MapEffectPrimitives'
import { AcidSplashEffect, ChillTouchManifestation, EldritchBlastProjectile, FireBoltProjectile, GuidanceManifestation, NewSpellManifestation, PoisonSprayEffect, ProduceFlameProjectile, RayOfFrostProjectile, ResistanceManifestation, SacredFlameEffect, SanctuaryManifestation, ShockingGraspEffect, SpareTheDyingEffect, StatusSpellManifestation, ViciousMockeryEffect } from './MapCantripEffects'
import { FireballProjectile, MagicMissileProjectile, MaterialAreaSpellEffect, MaterialSpellProjectile, MaterialTargetSpellEffect } from './MapLeveledSpellEffects'
export { ChillTouchPersistentMark } from './MapCantripEffects'
export function AttackTargetEffect({
  effect,
}: {
  effect: CombatPresentationAttackTargetEffect
}) {
  const effectRef = useRef<Konva.Group>(null)
  const symbolRef = useRef<Konva.Group>(null)
  const lockRingRef = useRef<Konva.Circle>(null)
  const palette = DND5E_CLASS_ICON_PALETTES[effect.classId] ??
    DND5E_CLASS_ICON_PALETTES.monster
  const accent = palette?.[0] ?? '#7f1d1d'
  const highlight = palette?.[2] ?? '#fecaca'
  const glow = palette?.[3] ?? '#ef4444'
  // The melee scar belongs on the portrait. A ranged reticle must sit outside
  // the Token frame; otherwise it blends into the class-colour border.
  const radius = effect.attackKind === 'melee'
    ? Math.max(18, effect.radiusPx * 0.86)
    : Math.max(24, effect.radiusPx * 1.28)

  useEffect(() => {
    const root = effectRef.current
    const symbol = symbolRef.current
    const layer = root?.getLayer()
    if (!root || !symbol || !layer) return
    const duration = Math.max(1, effect.durationMs)
    const initialElapsed = Math.max(0, Date.now() - effect.issuedAt)
    const drawFrame = (elapsed: number) => {
      const raw = Math.min(1, elapsed / duration)
      const enterRaw = Math.min(1, raw / 0.18)
      const enter = 1 - Math.pow(1 - enterRaw, 3)
      const fade = raw < 0.7 ? 1 : Math.max(0, (1 - raw) / 0.3)
      const impactPulse = Math.sin(Math.min(1, raw / 0.34) * Math.PI)
      root.position({ x: effect.x, y: effect.y })
      root.opacity(Math.min(1, enterRaw * 1.6) * fade)

      if (effect.attackKind === 'melee') {
        const scale = 0.72 + enter * 0.28 + impactPulse * 0.1
        root.scale({ x: scale, y: scale })
        root.rotation(0)
        symbol.position({ x: 0, y: 0 })
      } else {
        const scale = 1.42 - enter * 0.42 + Math.sin(elapsed * 0.018) * 0.018
        root.scale({ x: scale, y: scale })
        root.rotation(0)
        symbol.position({ x: 0, y: 0 })
        lockRingRef.current?.rotation((1 - enter) * 18 + raw * 12)
      }
      return raw
    }

    drawFrame(initialElapsed)
    layer.batchDraw()
    const animation = new Konva.Animation((frame) => {
      const raw = drawFrame(initialElapsed + (frame?.time ?? 0))
      if (raw >= 1) animation.stop()
    }, layer)
    animation.start()
    return () => {
      animation.stop()
    }
  }, [
    effect.attackKind,
    effect.durationMs,
    effect.issuedAt,
    effect.x,
    effect.y,
  ])

  return (
    <Group
      ref={effectRef}
      x={effect.x}
      y={effect.y}
      listening={false}
    >
      {effect.attackKind === 'melee' ? (
        <Group ref={symbolRef}>
          <Line
            points={[
              -radius * 0.46, radius * 0.62,
              -radius * 0.3, radius * 0.28,
              -radius * 0.36, radius * 0.13,
              -radius * 0.1, -radius * 0.04,
              -radius * 0.14, -radius * 0.19,
              radius * 0.17, -radius * 0.42,
              radius * 0.23, -radius * 0.68,
              radius * 0.37, -radius * 0.8,
              radius * 0.32, -radius * 0.48,
              radius * 0.11, -radius * 0.27,
              radius * 0.15, -radius * 0.13,
              -radius * 0.1, radius * 0.04,
              -radius * 0.06, radius * 0.18,
              -radius * 0.3, radius * 0.36,
              -radius * 0.28, radius * 0.62,
              -radius * 0.4, radius * 0.79,
            ]}
            closed
            fill="#991b1b"
            stroke="#1f0507"
            strokeWidth={Math.max(3.2, radius * 0.13)}
            lineCap="round"
            lineJoin="round"
            shadowColor="#ef4444"
            shadowBlur={radius * 0.42}
            shadowOpacity={0.9}
            perfectDrawEnabled={false}
          />
          <Line
            points={[
              -radius * 0.38, radius * 0.64,
              -radius * 0.25, radius * 0.31,
              -radius * 0.29, radius * 0.17,
              -radius * 0.04, 0,
              -radius * 0.08, -radius * 0.15,
              radius * 0.21, -radius * 0.38,
              radius * 0.3, -radius * 0.7,
            ]}
            stroke="#160305"
            strokeWidth={Math.max(4.8, radius * 0.19)}
            lineCap="round"
            lineJoin="round"
            perfectDrawEnabled={false}
          />
          <Line
            points={[
              -radius * 0.39, radius * 0.61,
              -radius * 0.26, radius * 0.3,
              -radius * 0.3, radius * 0.16,
              -radius * 0.05, -radius * 0.01,
              -radius * 0.09, -radius * 0.16,
              radius * 0.2, -radius * 0.39,
              radius * 0.29, -radius * 0.69,
            ]}
            stroke="#ef4444"
            strokeWidth={Math.max(1.8, radius * 0.065)}
            lineCap="round"
            lineJoin="round"
            opacity={0.9}
            perfectDrawEnabled={false}
          />
          <Line
            x={radius * 0.18}
            y={radius * 0.16}
            points={[
              0, -radius * 0.11,
              radius * 0.1, radius * 0.08,
              radius * 0.03, radius * 0.25,
              -radius * 0.08, radius * 0.09,
            ]}
            closed
            fill="#dc2626"
            stroke="#3f070b"
            strokeWidth={Math.max(1.2, radius * 0.045)}
            lineJoin="round"
            shadowColor="#ef4444"
            shadowBlur={7}
            perfectDrawEnabled={false}
          />
          <Line
            x={-radius * 0.16}
            y={radius * 0.51}
            points={[
              0, -radius * 0.08,
              radius * 0.08, radius * 0.07,
              radius * 0.01, radius * 0.2,
              -radius * 0.07, radius * 0.06,
            ]}
            closed
            fill="#b91c1c"
            stroke="#3f070b"
            strokeWidth={Math.max(1.1, radius * 0.04)}
            lineJoin="round"
            perfectDrawEnabled={false}
          />
          <Circle
            x={radius * 0.4}
            y={radius * 0.38}
            radius={Math.max(1.8, radius * 0.07)}
            fill="#ef4444"
            shadowColor="#ef4444"
            shadowBlur={6}
            perfectDrawEnabled={false}
          />
        </Group>
      ) : (
        <Group ref={symbolRef}>
          <Circle
            radius={radius * 1.02}
            fill={accent}
            opacity={0.08}
            shadowColor={glow}
            shadowBlur={radius * 0.9}
            perfectDrawEnabled={false}
          />
          <Circle
            ref={lockRingRef}
            radius={radius * 0.92}
            stroke={highlight}
            strokeWidth={Math.max(2.6, radius * 0.075)}
            dash={[radius * 0.28, radius * 0.2]}
            shadowColor={glow}
            shadowBlur={16}
            perfectDrawEnabled={false}
          />
          <Circle
            radius={radius * 0.61}
            stroke={glow}
            strokeWidth={Math.max(1.8, radius * 0.05)}
            opacity={0.95}
            shadowColor={glow}
            shadowBlur={8}
            perfectDrawEnabled={false}
          />
          {[0, 90, 180, 270].map((rotation) => (
            <Line
              key={rotation}
              rotation={rotation}
              points={[radius * 0.61, 0, radius * 1.04, 0]}
              stroke={highlight}
              strokeWidth={Math.max(2.6, radius * 0.075)}
              lineCap="round"
              shadowColor={glow}
              shadowBlur={12}
              perfectDrawEnabled={false}
            />
          ))}
          {[45, 135, 225, 315].map((rotation) => (
            <Line
              key={`bracket-${rotation}`}
              rotation={rotation}
              points={[
                radius * 0.82, -radius * 0.12,
                radius * 0.98, 0,
                radius * 0.82, radius * 0.12,
              ]}
              stroke={glow}
              strokeWidth={Math.max(2, radius * 0.055)}
              lineCap="round"
              lineJoin="round"
              shadowColor={glow}
              shadowBlur={9}
              perfectDrawEnabled={false}
            />
          ))}
          {[
            [-radius * 0.3, 0, -radius * 0.11, 0],
            [radius * 0.11, 0, radius * 0.3, 0],
            [0, -radius * 0.3, 0, -radius * 0.11],
            [0, radius * 0.11, 0, radius * 0.3],
          ].map((points, index) => (
            <Line
              key={`crosshair-${index}`}
              points={points}
              stroke={highlight}
              strokeWidth={Math.max(1.8, radius * 0.05)}
              lineCap="round"
              perfectDrawEnabled={false}
            />
          ))}
          <Circle
            radius={Math.max(2.8, radius * 0.1)}
            fill={highlight}
            stroke={accent}
            strokeWidth={1.5}
            shadowColor={glow}
            shadowBlur={10}
            perfectDrawEnabled={false}
          />
        </Group>
      )}
    </Group>
  )
}

export function CombatProjectileEffect({ projectile }: { projectile: MapProjectile }) {
  return projectile.kind === 'fireball'
    ? <FireballProjectile projectile={projectile} />
    : projectile.kind === 'fire-bolt'
      ? <FireBoltProjectile projectile={projectile} />
      : projectile.kind === 'ray-of-frost'
        ? <RayOfFrostProjectile projectile={projectile} />
        : projectile.kind === 'eldritch-blast'
          ? <EldritchBlastProjectile projectile={projectile} />
          : projectile.kind === 'produce-flame'
            ? <ProduceFlameProjectile projectile={projectile} />
            : projectile.kind === 'shocking-grasp'
              ? <ShockingGraspEffect projectile={projectile} />
              : projectile.kind === 'guidance'
                ? <GuidanceManifestation projectile={projectile} />
                : projectile.kind === 'resistance'
                  ? <ResistanceManifestation projectile={projectile} />
              : projectile.kind === 'sanctuary'
                ? <SanctuaryManifestation projectile={projectile} />
                : ['heal', 'mass-cure-wounds', 'mass-heal', 'mass-healing-word', 'prayer-of-healing', 'dancing-lights', 'minor-illusion', 'thaumaturgy', 'shillelagh'].includes(String(projectile.kind))
                  ? <NewSpellManifestation projectile={projectile} />
                : projectile.kind === 'bless' ||
                        projectile.kind === 'bane' ||
                        projectile.kind === 'shield-of-faith' ||
                        projectile.kind === 'mage-armor' ||
                        projectile.kind === 'jump' ||
                        projectile.kind === 'darkvision' ||
                        projectile.kind === 'see-invisibility' ||
                        projectile.kind === 'warding-bond' ||
                        projectile.kind === 'fly' ||
                        projectile.kind === 'heroism' ||
                        projectile.kind === 'enlarge-reduce' ||
                        projectile.kind === 'enhance-ability' ||
                        projectile.kind === 'divine-favor' ||
                        projectile.kind === 'hunters-mark' ||
                        projectile.kind === 'magic-weapon' ||
                        projectile.kind === 'flame-blade' ||
                        projectile.kind === 'invisibility' ||
                        projectile.kind === 'blur' ||
                        projectile.kind === 'barkskin' ||
                        projectile.kind === 'protection-from-poison' ||
                        projectile.kind === 'longstrider' ||
                        projectile.kind === 'protection-from-energy' ||
                        projectile.kind === 'death-ward' ||
                        projectile.kind === 'greater-invisibility' ||
                        projectile.kind === 'charm-person' ||
                        projectile.kind === 'hideous-laughter' ||
                        projectile.kind === 'hold-person' ||
                        projectile.kind === 'blindness-deafness'
                      ? <StatusSpellManifestation projectile={projectile} />
                      : projectile.kind === 'sacred-flame'
                        ? <SacredFlameEffect projectile={projectile} />
                        : projectile.kind === 'spare-the-dying'
                          ? <SpareTheDyingEffect projectile={projectile} />
                          : projectile.kind === 'acid-splash'
                            ? <AcidSplashEffect projectile={projectile} />
                            : projectile.kind === 'poison-spray'
                              ? <PoisonSprayEffect projectile={projectile} />
                              : projectile.kind === 'vicious-mockery'
                                ? <ViciousMockeryEffect projectile={projectile} />
                                : projectile.kind === 'magic-missile'
                                  ? <MagicMissileProjectile projectile={projectile} />
                                  : projectile.kind === 'scorching-ray' ||
                                     projectile.kind === 'guiding-bolt' ||
                                     projectile.kind === 'acid-arrow' ||
                                     projectile.kind === 'chain-lightning' ||
                                     projectile.kind === 'disintegrate' ||
                                     projectile.kind === 'healing-word' ||
                                    projectile.kind === 'inflict-wounds'
                                  ? <MaterialSpellProjectile projectile={projectile} />
                                    : [
                                        'hypnotic-pattern',
                                        'slow',
                                        'phantasmal-killer',
                                        'banishment',
                                        'misty-step',
                                        'hold-monster',
                                        'counterspell',
                                        'dispel-magic',
                                        'shield',
                                        'lesser-restoration',
                                      ].includes(String(projectile.kind))
                                      ? <MaterialTargetSpellEffect projectile={projectile} />
                                    : projectile.kind === 'cure-wounds' ||
                                      projectile.kind === 'hellish-rebuke' ||
                                      projectile.kind === 'blight' ||
                                      projectile.kind === 'finger-of-death' ||
                                      projectile.kind === 'power-word-stun' ||
                                      projectile.kind === 'power-word-kill' ||
                                      projectile.kind === 'false-life'
                                    ? <MaterialTargetSpellEffect projectile={projectile} />
                                    : projectile.kind === 'burning-hands' ||
                                        projectile.kind === 'thunderwave' ||
                                        projectile.kind === 'shatter' ||
                                        projectile.kind === 'lightning-bolt' ||
                                        projectile.kind === 'flame-strike' ||
                                        projectile.kind === 'sunburst'
                                        || projectile.kind === 'cone-of-cold'
                                        || projectile.kind === 'circle-of-death'
                                        || projectile.kind === 'ice-storm'
                                        || projectile.kind === 'freezing-sphere' || projectile.kind === 'meteor-swarm'
                                        || projectile.kind === 'color-spray'
                                        || projectile.kind === 'faerie-fire'
                                        || projectile.kind === 'sleep'
                                        || projectile.kind === 'entangle'
                                        || projectile.kind === 'grease'
                                        || projectile.kind === 'darkness'
                                        || projectile.kind === 'flaming-sphere'
                                        || projectile.kind === 'moonbeam'
                                        || projectile.kind === 'daylight'
                                        || projectile.kind === 'black-tentacles'
                                        || projectile.kind === 'spike-growth'
                                        || projectile.kind === 'mage-hand'
                                        || projectile.kind === 'spiritual-weapon'
                                        || projectile.kind === 'spirit-guardians'
                                        || projectile.kind === 'call-lightning'
                                        || projectile.kind === 'call-lightning-strike'
                                        || projectile.kind === 'insect-plague'
                                        || projectile.kind === 'cloudkill'
                                        || projectile.kind === 'wall-of-fire'
                                        || projectile.kind === 'blade-barrier'
                                      ? <MaterialAreaSpellEffect
                                          projectile={projectile}
                                        />
                                      : projectile.kind === 'chill-touch'
                                        ? <ChillTouchManifestation projectile={projectile} />
                                        : <ProjectileArrow projectile={projectile} />
}
