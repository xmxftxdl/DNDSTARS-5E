import type { AbilityKey } from '../../lib/dnd'
import type { Character } from '../../types/character'

export interface Dnd5eSrdFeatDefinition {
  id: string
  name: string
  summary: string
  description: string
  prerequisite?: {
    minimumLevel?: number
    abilityScores?: Partial<Record<AbilityKey, number>>
  }
  automation: 'full' | 'partial' | 'manual'
  automationReasons?: readonly string[]
}

/**
 * SRD 5.1 唯一公开的通用专长。其“压制擒抱目标”需要一笔对抗检定事务，
 * 在该事务完整接入前保持 partial，不能静默模拟成普通状态按钮。
 */
export const DND5E_SRD_FEATS: readonly Dnd5eSrdFeatDefinition[] = [{
  id: 'srd5.1:grappler',
  name: '擒抱者',
  summary: '擅长近身缠斗，并能尝试压制被你擒抱的生物。',
  description: '前提：力量 13 或更高。你攻击被自己擒抱的生物时具有优势；你也可以用一个动作尝试压制该生物，并再次进行一次擒抱检定。若成功，你与目标都陷入受限状态，直到擒抱结束。',
  prerequisite: {
    abilityScores: { str: 13 },
  },
  automation: 'partial',
  automationReasons: ['压制需要再次进行擒抱检定并同时施加受限状态，当前由 DM 裁定窗口完成。'],
}]

export function dnd5eSrdFeatDefinition(featId: string): Dnd5eSrdFeatDefinition | undefined {
  return DND5E_SRD_FEATS.find((feat) => feat.id === featId)
}

export function dnd5eSrdFeatAvailableForCharacter(
  feat: Dnd5eSrdFeatDefinition,
  character: Pick<Character, 'level' | 'abilities'>,
): boolean {
  if (character.level < (feat.prerequisite?.minimumLevel ?? 1)) return false
  return !Object.entries(feat.prerequisite?.abilityScores ?? {}).some(
    ([ability, score]) => character.abilities[ability as AbilityKey] < (score ?? 0),
  )
}
