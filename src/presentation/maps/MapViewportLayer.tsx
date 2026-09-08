import { memo, useMemo } from 'react'
import type { SpellStatusTokenMark, StandardConditionTokenMark } from '../../components/map/MapCanvas'
import { spellStatusTokenTooltip, standardConditionTokenTooltip } from '../../components/map/tokenStatusTooltip'
import { useBrowserSceneWorldMinute } from '../../composition/browserSceneClock'
import { realignTokensToGrid } from '../../lib/gridCombat'
import { isDnd5eTokenBanished, tokenPresentationHitPoints } from '../../lib/combatTokens'
import { dnd5eCharacterPresentationColors } from '../dnd5e/characterPresentation'
import {
  dnd5eActiveStandardConditions,
  dnd5eConditionsFromActiveEffects,
  normalizeDnd5eActiveEffects,
} from '../../application/combat/dnd5eCombatRules'
import { dnd5eTokenStatusMarkersFromActiveEffects } from '../../rulesets/dnd5e/tokenStatusMarkers'
import { dnd5eActiveEmittedLight } from '../../rulesets/dnd5e/activeEffects'
import { dnd5eTokenIntersectsPersistentAreaAt } from '../../rulesets/dnd5e/persistentAreaGeometry'
import type { BattleMap, Token } from '../../store/maps'
import { projectCharacterTokenPresentations } from '../../store/maps'
import { useSceneOrchestrationStore } from '../../store/sceneOrchestration'
import { buildDnd5eConcentrationTokenMarks } from '../../pages/maps/concentrationTokenMarks'
import {
  buildDnd5eMonsterStatusTokenMarks,
  buildDnd5eMonsterTraitTokenStatusMarks,
} from '../../pages/maps/monsterStatusTokenMarks'
import {
  buildDnd5eTokenBorderPresentations,
} from '../../pages/maps/tokenBorderPresentation'
import {
  hasBanePresentationEffect,
  hasBarkskinPresentationEffect,
  hasBlessPresentationEffect,
  hasBlindnessDeafnessPresentationEffect,
  hasBlurPresentationEffect,
  hasCharmPersonPresentationEffect,
  hasDarkvisionPresentationEffect,
  hasDeathWardPresentationEffect,
  hasDivineFavorPresentationEffect,
  hasEnhanceAbilityPresentationEffect,
  hasEnlargeReducePresentationEffect,
  hasFlameBladePresentationEffect,
  hasFlyPresentationEffect,
  hasGuidancePresentationEffect,
  hasHeroismPresentationEffect,
  hasHideousLaughterPresentationEffect,
  hasHoldPersonPresentationEffect,
  hasHuntersMarkPresentationEffect,
  hasJumpPresentationEffect,
  hasLongstriderPresentationEffect,
  hasMageArmorPresentationEffect,
  hasMagicWeaponPresentationEffect,
  hasProtectionFromEnergyPresentationEffect,
  hasProtectionFromPoisonPresentationEffect,
  hasResistancePresentationEffect,
  hasSanctuaryPresentationEffect,
  hasSeeInvisibilityPresentationEffect,
  hasShieldOfFaithPresentationEffect,
  hasWardingBondPresentationEffect,
  spellPresentationEffectSourceActorId,
} from '../../pages/maps/spellSettlementCoordinator'
import SceneCanvas, { type SceneCanvasProps } from './SceneCanvas'
import { useMapViewportCharacters } from './mapViewportCharacters'
import SceneWeatherLayer from '../../components/map/SceneWeatherLayer'

type ViewportOwnedSceneCanvasProps =
  | 'map'
  | 'worldMinute'
  | 'tokenBorderPresentations'
  | 'hpByToken'
  | 'dnd5eConditionsByToken'
  | 'dnd5eTokenStatusMarkersByToken'
  | 'standardConditionTokenMarks'
  | 'shillelaghTokenIds'
  | 'shillelaghEffectIdsByToken'
  | 'chillTouchTokenIds'
  | 'sanctuaryTokenIds'
  | 'spellStatusTokenMarks'
  | 'concentrationTokenMarks'
  | 'tokenHoverLabels'
  | 'defeatedTokenIds'
  | 'etherealTokenIds'

export interface MapViewportGridCalibrationDraft {
  mapId: string
  gridSize: number
  gridOffsetX: number
  gridOffsetY: number
}

export interface MapViewportLayerProps
  extends Omit<SceneCanvasProps, ViewportOwnedSceneCanvasProps> {
  map: BattleMap
  gridCalibrationDraft?: MapViewportGridCalibrationDraft | null
  rulesRevision?: unknown
}

export interface MapViewportPresentation {
  map: BattleMap
  tokenBorderPresentations: NonNullable<SceneCanvasProps['tokenBorderPresentations']>
  hpByToken: NonNullable<SceneCanvasProps['hpByToken']>
  dnd5eConditionsByToken: NonNullable<SceneCanvasProps['dnd5eConditionsByToken']>
  dnd5eTokenStatusMarkersByToken: NonNullable<SceneCanvasProps['dnd5eTokenStatusMarkersByToken']>
  standardConditionTokenMarks: StandardConditionTokenMark[]
  shillelaghTokenIds: string[]
  shillelaghEffectIdsByToken: Record<string, string>
  chillTouchTokenIds: string[]
  sanctuaryTokenIds: string[]
  spellStatusTokenMarks: SpellStatusTokenMark[]
  concentrationTokenMarks: NonNullable<SceneCanvasProps['concentrationTokenMarks']>
  defeatedTokenIds: string[]
  etherealTokenIds: string[]
}

function linkedCharacter(
  token: Token,
  charactersById: ReadonlyMap<string, ReturnType<typeof useMapViewportCharacters>[number]>,
) {
  return token.characterId ? charactersById.get(token.characterId) : undefined
}

function statusIdsForCombatState(combatState: Token['dnd5eCombatState'] | undefined) {
  return ([
    hasGuidancePresentationEffect(combatState) ? 'guidance' : undefined,
    hasResistancePresentationEffect(combatState) ? 'resistance' : undefined,
    hasSanctuaryPresentationEffect(combatState) ? 'sanctuary' : undefined,
    hasBlessPresentationEffect(combatState) ? 'bless' : undefined,
    hasBanePresentationEffect(combatState) ? 'bane' : undefined,
    hasShieldOfFaithPresentationEffect(combatState) ? 'shield-of-faith' : undefined,
    hasMageArmorPresentationEffect(combatState) ? 'mage-armor' : undefined,
    hasJumpPresentationEffect(combatState) ? 'jump' : undefined,
    hasDarkvisionPresentationEffect(combatState) ? 'darkvision' : undefined,
    hasSeeInvisibilityPresentationEffect(combatState) ? 'see-invisibility' : undefined,
    hasWardingBondPresentationEffect(combatState) ? 'warding-bond' : undefined,
    hasFlyPresentationEffect(combatState) ? 'fly' : undefined,
    hasHeroismPresentationEffect(combatState) ? 'heroism' : undefined,
    hasEnlargeReducePresentationEffect(combatState) ? 'enlarge-reduce' : undefined,
    hasEnhanceAbilityPresentationEffect(combatState) ? 'enhance-ability' : undefined,
    hasDivineFavorPresentationEffect(combatState) ? 'divine-favor' : undefined,
    hasHuntersMarkPresentationEffect(combatState) ? 'hunters-mark' : undefined,
    hasMagicWeaponPresentationEffect(combatState) ? 'magic-weapon' : undefined,
    hasFlameBladePresentationEffect(combatState) ? 'flame-blade' : undefined,
    hasBlurPresentationEffect(combatState) ? 'blur' : undefined,
    hasBarkskinPresentationEffect(combatState) ? 'barkskin' : undefined,
    hasProtectionFromPoisonPresentationEffect(combatState) ? 'protection-from-poison' : undefined,
    hasLongstriderPresentationEffect(combatState) ? 'longstrider' : undefined,
    hasProtectionFromEnergyPresentationEffect(combatState) ? 'protection-from-energy' : undefined,
    hasDeathWardPresentationEffect(combatState) ? 'death-ward' : undefined,
    hasCharmPersonPresentationEffect(combatState) ? 'charm-person' : undefined,
    hasHideousLaughterPresentationEffect(combatState) ? 'hideous-laughter' : undefined,
    hasHoldPersonPresentationEffect(combatState) ? 'hold-person' : undefined,
    hasBlindnessDeafnessPresentationEffect(combatState) ? 'blindness-deafness' : undefined,
  ] as const).filter((statusId): statusId is NonNullable<typeof statusId> => statusId != null)
}

// eslint-disable-next-line react-refresh/only-export-components
export function buildMapViewportPresentation(
  map: BattleMap,
  characters: ReturnType<typeof useMapViewportCharacters>,
  gridCalibrationDraft?: MapViewportGridCalibrationDraft | null,
): MapViewportPresentation {
  const charactersById = new Map(characters.map((character) => [character.id, character]))
  const projectedTokens = projectCharacterTokenPresentations(map.tokens, characters)
  const displayMap = projectedTokens === map.tokens ? map : { ...map, tokens: projectedTokens }
  const canvasMap = gridCalibrationDraft?.mapId === displayMap.id
    ? (() => {
        const previewMap: BattleMap = {
          ...displayMap,
          gridSize: gridCalibrationDraft.gridSize,
          gridOffsetX: gridCalibrationDraft.gridOffsetX,
          gridOffsetY: gridCalibrationDraft.gridOffsetY,
        }
        return { ...previewMap, tokens: realignTokensToGrid(displayMap.tokens, previewMap) }
      })()
    : displayMap

  const hpByToken: MapViewportPresentation['hpByToken'] = {}
  const dnd5eConditionsByToken: MapViewportPresentation['dnd5eConditionsByToken'] = {}
  const dnd5eTokenStatusMarkersByToken: MapViewportPresentation['dnd5eTokenStatusMarkersByToken'] = {}
  const shillelaghTokenIds: string[] = []
  const shillelaghEffectIdsByToken: Record<string, string> = {}
  const chillTouchTokenIds: string[] = []
  const standardConditionTokenMarks: StandardConditionTokenMark[] = []
  const spellEffectStatusTokenMarks: SpellStatusTokenMark[] = []
  const emittedLightByTokenId: Record<string, NonNullable<Token['lightSource']>> = {}
  const etherealTokenIds: string[] = []

  for (const token of map.tokens) {
    const character = linkedCharacter(token, charactersById)
    if (isDnd5eTokenBanished(token, characters)) etherealTokenIds.push(token.id)
    const hitPoints = tokenPresentationHitPoints(token, character)
    if (hitPoints) hpByToken[token.id] = hitPoints

    const effects = normalizeDnd5eActiveEffects([
      ...(character?.dnd5eCombatState?.activeEffects ?? []),
      ...(token.dnd5eCombatState?.activeEffects ?? []),
    ])
    const conditions = dnd5eActiveStandardConditions({
      conditions: dnd5eConditionsFromActiveEffects(effects),
    })
    if (conditions.length > 0) dnd5eConditionsByToken[token.id] = conditions
    const emittedLight = dnd5eActiveEmittedLight(effects)
    if (emittedLight) {
      const existing = token.lightSource
      const existingOuter = existing?.enabled
        ? existing.brightRadiusFeet + existing.dimRadiusFeet
        : 0
      const emittedOuter = emittedLight.brightRadiusFeet + emittedLight.dimRadiusFeet
      const brightRadiusFeet = Math.max(existing?.enabled ? existing.brightRadiusFeet : 0, emittedLight.brightRadiusFeet)
      emittedLightByTokenId[token.id] = {
        enabled: true,
        brightRadiusFeet,
        dimRadiusFeet: Math.max(existingOuter, emittedOuter) - brightRadiusFeet,
        color: existingOuter >= emittedOuter && existing?.enabled ? existing.color : emittedLight.color,
        sourceKind: 'spell',
        ...(emittedLight.sunlight === true || existing?.sunlight === true ? { sunlight: true as const } : {}),
      }
    }
    const visibleStatusEffects = effects.filter((effect) => {
      if (
        effect.definitionId !== 'srd-5.1:spell:zone-of-truth:failed-save' ||
        effect.source.rulesId !== 'zone-of-truth'
      ) return true
      const areaTag = effect.tags?.find((tag) => tag.startsWith('persistent-area:'))
      const areaId = areaTag?.slice('persistent-area:'.length)
      const area = areaId
        ? map.dnd5ePluginAreas?.find((candidate) =>
            candidate.id === areaId && candidate.coreSpellId === 'zone-of-truth')
        : undefined
      return !!area && dnd5eTokenIntersectsPersistentAreaAt(token, map, area, token)
    })
    const statusMarkers = dnd5eTokenStatusMarkersFromActiveEffects(visibleStatusEffects).map((marker) => {
      const sourceToken = marker.sourceActorId
        ? map.tokens.find((candidate) => candidate.id === marker.sourceActorId)
        : undefined
      const sourceCharacter = sourceToken?.characterId
        ? charactersById.get(sourceToken.characterId)
        : marker.sourceActorId ? charactersById.get(marker.sourceActorId) : undefined
      if (!sourceCharacter) return marker
      const colors = dnd5eCharacterPresentationColors(sourceCharacter)
      return {
        ...marker,
        sourceLabel: marker.sourceLabel ?? sourceCharacter.name ?? sourceToken?.label,
        backgroundColor: colors.statusBackgroundColor,
        // Tactical spell badges are small enough that the palette's very pale
        // status-frame color reads as white (wizard: #DBEAFE). Use the source
        // class primary accent for the visible perimeter so the caster remains
        // identifiable at map scale; keep the deep background and glow slots.
        borderColor: colors.accentColor,
        glowColor: colors.glowColor,
      }
    })
    if (statusMarkers.length > 0) dnd5eTokenStatusMarkersByToken[token.id] = statusMarkers
    const shillelaghEffect = effects.find((effect) =>
      effect.definitionId === 'srd-5.1:spell:shillelagh' && effect.source.rulesId === 'shillelagh')
    if (shillelaghEffect) {
      shillelaghTokenIds.push(token.id)
      shillelaghEffectIdsByToken[token.id] = shillelaghEffect.id
    }
    if (effects.some((effect) => effect.definitionId === 'srd-5.1:spell:chill-touch:no-healing')) {
      chillTouchTokenIds.push(token.id)
    }

    const combatState = character?.dnd5eCombatState ?? token.dnd5eCombatState
    for (const statusId of statusIdsForCombatState(combatState)) {
      const activeEffect = effects.find((effect) =>
        effect.source.rulesId === statusId || effect.definitionId === `srd-5.1:spell:${statusId}`)
      const sourceActorId = activeEffect?.source.actorId ??
        spellPresentationEffectSourceActorId(combatState, statusId)
      const sourceToken = map.tokens.find((candidate) => candidate.id === sourceActorId)
      const sourceCharacter = sourceToken?.characterId
        ? charactersById.get(sourceToken.characterId)
        : sourceActorId ? charactersById.get(sourceActorId) : undefined
      const colors = dnd5eCharacterPresentationColors(sourceCharacter)
      const tooltip = spellStatusTokenTooltip(statusId)
      spellEffectStatusTokenMarks.push({
        instance: {
          id: activeEffect?.id ?? `spell-effect:${token.id}:${statusId}:${sourceActorId ?? 'unknown'}`,
          tokenId: token.id,
          kind: 'spell-effect',
          title: activeEffect?.label ?? tooltip.title,
          description: tooltip.description,
          statusId,
          activeEffectId: activeEffect?.id,
          sourceActorId,
          sourceLabel: activeEffect?.source.actorName ?? activeEffect?.source.label ??
            sourceCharacter?.name ?? sourceToken?.label ?? activeEffect?.source.rulesId,
          authority: 'headless',
        },
        tokenId: token.id,
        statusId,
        backgroundHighlightColor: colors.statusBackgroundHighlightColor,
        backgroundColor: colors.statusBackgroundColor,
        // Every source-attributed Token marker uses the granting class's
        // primary banner color for its visible perimeter.
        borderColor: colors.accentColor,
        glowColor: colors.glowColor,
        classId: colors.classId,
      })
    }

    for (const effect of effects) {
      const condition = effect.standardCondition
      if (!condition || (effect.suspendedBy?.length ?? 0) > 0) continue
      const sourceActorId = effect.source.actorId
      const sourceToken = map.tokens.find((candidate) => candidate.id === sourceActorId)
      const sourceCharacter = sourceToken?.characterId
        ? charactersById.get(sourceToken.characterId)
        : sourceActorId ? charactersById.get(sourceActorId) : undefined
      const colors = dnd5eCharacterPresentationColors(sourceCharacter)
      const tooltip = standardConditionTokenTooltip(condition)
      standardConditionTokenMarks.push({
        instance: {
          id: effect.id,
          tokenId: token.id,
          kind: 'active-effect',
          title: effect.label || tooltip.title,
          description: tooltip.description,
          statusId: condition,
          activeEffectId: effect.id,
          sourceActorId,
          sourceLabel: effect.source.actorName ?? effect.source.label ??
            sourceCharacter?.name ?? sourceToken?.label ?? effect.source.rulesId,
          authority: 'headless',
        },
        tokenId: token.id,
        condition,
        backgroundColor: colors.statusBackgroundColor,
        borderColor: colors.accentColor,
        glowColor: colors.glowColor,
      })
    }
  }

  for (const { tokenId, marker } of buildDnd5eMonsterTraitTokenStatusMarks(map.tokens, characters)) {
    dnd5eTokenStatusMarkersByToken[tokenId] = [
      ...(dnd5eTokenStatusMarkersByToken[tokenId] ?? []),
      marker,
    ]
  }

  const spellStatusTokenMarks = [
    ...spellEffectStatusTokenMarks,
    ...buildDnd5eMonsterStatusTokenMarks(map.tokens, [...characters]),
  ]
  return {
    map: Object.keys(emittedLightByTokenId).length > 0
      ? {
          ...canvasMap,
          tokens: canvasMap.tokens.map((token) => emittedLightByTokenId[token.id]
            ? { ...token, lightSource: emittedLightByTokenId[token.id] }
            : token),
        }
      : canvasMap,
    tokenBorderPresentations: buildDnd5eTokenBorderPresentations(displayMap.tokens, [...characters]),
    hpByToken,
    dnd5eConditionsByToken,
    dnd5eTokenStatusMarkersByToken,
    standardConditionTokenMarks,
    shillelaghTokenIds,
    shillelaghEffectIdsByToken,
    chillTouchTokenIds,
    sanctuaryTokenIds: spellStatusTokenMarks
      .filter((mark) => mark.statusId === 'sanctuary')
      .map((mark) => mark.tokenId),
    spellStatusTokenMarks,
    concentrationTokenMarks: buildDnd5eConcentrationTokenMarks(map.tokens, [...characters]),
    defeatedTokenIds: map.tokens.flatMap((token) => {
      const hitPoints = hpByToken[token.id]
      return hitPoints && hitPoints.hp <= 0 ? [token.id] : []
    }),
    etherealTokenIds,
  }
}

function MapViewportLayerComponent({
  map,
  gridCalibrationDraft,
  rulesRevision,
  ...canvasProps
}: MapViewportLayerProps) {
  const worldMinute = useBrowserSceneWorldMinute()
  const characters = useMapViewportCharacters(map.tokens, rulesRevision)
  const orchestratedScene = useSceneOrchestrationStore((state) =>
    state.shared.scenes.find((candidate) => candidate.mapId === map.id))
  const presentation = useMemo(
    () => buildMapViewportPresentation(map, characters, gridCalibrationDraft),
    [characters, gridCalibrationDraft, map],
  )

  return (
    <div
      className="relative h-full w-full overflow-hidden rounded-2xl"
      data-testid="map-viewport-layer"
      data-map-id={map.id}
    >
      <SceneCanvas
        {...canvasProps}
        map={presentation.map}
        worldMinute={worldMinute}
        tokenBorderPresentations={presentation.tokenBorderPresentations}
        hpByToken={presentation.hpByToken}
        dnd5eConditionsByToken={presentation.dnd5eConditionsByToken}
        dnd5eTokenStatusMarkersByToken={presentation.dnd5eTokenStatusMarkersByToken}
        standardConditionTokenMarks={presentation.standardConditionTokenMarks}
        shillelaghTokenIds={presentation.shillelaghTokenIds}
        shillelaghEffectIdsByToken={presentation.shillelaghEffectIdsByToken}
        chillTouchTokenIds={presentation.chillTouchTokenIds}
        sanctuaryTokenIds={presentation.sanctuaryTokenIds}
        spellStatusTokenMarks={presentation.spellStatusTokenMarks}
        concentrationTokenMarks={presentation.concentrationTokenMarks}
        defeatedTokenIds={presentation.defeatedTokenIds}
        etherealTokenIds={presentation.etherealTokenIds}
      />
      {orchestratedScene ? (
        <SceneWeatherLayer
          sceneId={orchestratedScene.id}
          weather={orchestratedScene.weather}
          mapWidth={presentation.map.width}
          mapHeight={presentation.map.height}
        />
      ) : null}
    </div>
  )
}

const MapViewportLayer = memo(MapViewportLayerComponent)

export default MapViewportLayer
