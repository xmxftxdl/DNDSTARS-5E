import rollCatalog from './combatLogRollLabels.generated.json'
import effectCatalog from './combatLogEffectLabels.generated.json'
import { SKILLS } from '../../lib/dnd'
import { DND5E_SRD_SPELL_NAMES_ZH } from '../../rulesets/dnd5e/spellNamesZh'

const rollLabels: Record<string, string> = {
  'spell-save-d20': '法术豁免骰', 'spell-attack-d20': '法术攻击骰',
  'prismatic-ray-d8': '虹光颜色骰', 'prismatic-primary-damage-d6': '虹光主要伤害骰',
  'prismatic-extra-ray-a-d8': '虹光额外颜色骰一', 'prismatic-extra-ray-b-d8': '虹光额外颜色骰二',
  'prismatic-extra-damage-a-d6': '虹光额外伤害骰一', 'prismatic-extra-damage-b-d6': '虹光额外伤害骰二',
}
const prismaticRayLabels: Record<number, string> = {
  1: '红色虹光（火焰伤害）', 2: '橙色虹光（强酸伤害）',
  3: '黄色虹光（闪电伤害）', 4: '绿色虹光（毒素伤害）',
  5: '蓝色虹光（冷冻伤害）', 6: '靛色虹光（束缚／石化）',
  7: '紫色虹光（目盲／传送）', 8: '双重虹光（另掷两次决定颜色）',
}
const effectLabels: Record<string, string> = {
  'prismatic-spray-indigo': '靛色光线（束缚与石化）',
  'prismatic-spray-violet': '紫色光线（目盲与传送）',
}
/** Localize display only: saved evidence and player-authored names stay intact. */
export function combatLogChinese(text: string, resolveName: (id: string) => string | undefined = () => undefined): string {
  const ray = text.match(/^Activity (?:骰据|数据)：prismatic-(?:ray|extra-ray-[ab])-d8:([^｜]+)｜.*=\s*([1-8])\s*$/)
  const rayDescription = ray ? `｜${resolveName(ray[1].trim()) ?? '目标'}受到${prismaticRayLabels[Number(ray[2])]}` : ''
  let result = text.replace(/Activity ((?:d20 )?(?:骰据|数据|检定骰据|对抗骰据))(?:：|:)\s*([^｜]+)｜/g, (_, kind: string, id: string) => {
    const [rollId, targetId] = id.trim().split(':')
    const target = targetId ? resolveName(targetId) : undefined
    const sides = rollId.match(/-d(\d+)$/)?.[1]
    const label = `${rollLabels[rollId] ?? (rollCatalog as Record<string,string>)[rollId] ?? '规则投掷'}${sides ? `（${sides} 面骰）` : ''}`
    return `规则${kind.replace(/d20\s*/g, '').replace(/骰据/g, '骰值')}：${label}${target ? `（${target}）` : ''}｜`
  })
  result = result.replace(/activity:([a-z0-9-]+):([a-z0-9-]+)/g, (_, spell: string, effect: string) =>
    effectLabels[effect] ? `${DND5E_SRD_SPELL_NAMES_ZH[spell] ?? '法术'} · ${effectLabels[effect]}`
      : (effectCatalog as Record<string, string>)[`activity:${spell}:${effect}`] ?? `${DND5E_SRD_SPELL_NAMES_ZH[spell] ?? '法术'} · 持续效果`)
  result = result.replace(/\b[a-z]+(?:-[a-z0-9]+)+\b/g, id => DND5E_SRD_SPELL_NAMES_ZH[id] ?? id)
  result = result.replace(/dnd5e-spell-slot-(\d+)/g, '$1 环法术位')
    .replace(/\b(STR|DEX|CON|INT|WIS|CHA)\b/g, key => ({STR:'力量',DEX:'敏捷',CON:'体质',INT:'智力',WIS:'感知',CHA:'魅力'})[key] ?? key)
    .replace(/（([a-z]+)）/g, (match, key: string) => { const skill = SKILLS.find(item => item.key === key); return skill ? `（${skill.label}）` : match })
    .replace(/\bAC\b/g, '护甲等级')
  result += rayDescription
  return result.replace(/\bActivity\b/g, '规则').replace(/\bHeadless\b/g, '自动规则')
    .replace(/\bSRD\b/g, '系统参考文档').replace(/\bID\b/g, '编号').replace(/\bDM\b/g, '主持人')
    .replace(/\bHP\b/g, '生命值').replace(/\bvs\s+DC\b/g, '对抗难度')
    .replace(/\bDC\b/g, '难度').replace(/\bvs\b/g, '对抗')
    .replace(/\bd(4|6|8|10|12|20|100)\b/gi, '$1 面骰')
}
