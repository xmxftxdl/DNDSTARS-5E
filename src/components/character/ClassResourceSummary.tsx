import { classResourceDefinitions, getClassResource } from '../../lib/classResources'
import type { ClassResourceDefinition } from '../../lib/classDefinitionTypes'
import type { Character } from '../../types/character'

function resourceRuleDetail(definition: ClassResourceDefinition): string {
  const spellSlotMatch = definition.key.match(/^dnd5e-spell-slot-(\d)$/)
  if (spellSlotMatch) {
    return `施放一个${spellSlotMatch[1]}环法术时消耗 1 个对应法术位。`
  }
  const details: Record<string, string> = {
    'dnd5e-pact-slot': '施放契约法术时消耗；所有契约法术位始终使用当前契约环级。',
    'dnd5e-rage': '以附赠动作进入狂暴时消耗 1 次；20级后使用次数不限。',
    'dnd5e-bardic-inspiration': '以附赠动作给予一名生物诗人激励时消耗 1 次；5级前长休恢复，5级起短休或长休恢复。',
    'dnd5e-channel-divinity': '发动引导神力或消耗该资源的职业／子职能力时使用 1 次。',
    'dnd5e-divine-intervention': '尝试神圣干预时使用；成功后进入 7 个战役日的冷却，失败则完成长休后可再次尝试。',
    'dnd5e-wild-shape': '以动作进入荒野形态时消耗 1 次；20级后使用次数不限。',
    'dnd5e-natural-recovery': '完成短休后可使用 1 次恢复法术位；实际选择只在DM短休结算窗口进行。',
    'dnd5e-ki': '施展需要气的武僧能力时按能力标注消耗相应点数。',
    'dnd5e-wholeness-of-body': '以动作使用身心合一、恢复等于武僧等级三倍的生命值时消耗 1 次。',
    'dnd5e-divine-sense': '以动作感知60尺内未受全掩护的天界、邪魔、亡灵以及祝圣／亵渎区域时消耗 1 次。',
    'dnd5e-lay-on-hands': '圣疗池按实际恢复的生命值或能力费用逐点消耗。',
    'dnd5e-cleansing-touch': '使用净化之触结束一个法术效果时消耗 1 次。',
    'dnd5e-holy-nimbus': '以动作启动持续1分钟的30尺神圣光轮时消耗 1 次；敌人回合开始受到10点光耀伤害。',
    'dnd5e-stroke-of-luck': '发动幸运一击将失手改为命中，或将检定结果视为20时消耗 1 次。',
    'dnd5e-sorcery-points': '创造法术位、使用超魔或其他明确标注的术士能力时，按相应费用消耗术法点。',
    'dnd5e-dark-ones-own-luck': '发动黑暗赐福为一次属性检定或豁免增加 d10 时消耗 1 次。',
    'dnd5e-hurl-through-hell': '攻击命中时将目标送过下层位面并在其返回时造成10d10心灵伤害，发动时消耗 1 次。',
    'dnd5e-mystic-arcanum-6': '施放已选择的6环秘法奥秘时消耗 1 次，不消耗契约法术位。',
    'dnd5e-mystic-arcanum-7': '施放已选择的7环秘法奥秘时消耗 1 次，不消耗契约法术位。',
    'dnd5e-mystic-arcanum-8': '施放已选择的8环秘法奥秘时消耗 1 次，不消耗契约法术位。',
    'dnd5e-mystic-arcanum-9': '施放已选择的9环秘法奥秘时消耗 1 次，不消耗契约法术位。',
    'dnd5e-eldritch-master': '花费 1 分钟恳求宗主并恢复所有契约法术位时消耗 1 次。',
    'dnd5e-arcane-recovery': '完成短休后可使用 1 次恢复法术位；实际选择只在DM短休结算窗口进行。',
    'dnd5e-signature-spell-1': '以招牌法术的免费施法次数施放第一个已选3环法术时消耗。',
    'dnd5e-signature-spell-2': '以招牌法术的免费施法次数施放第二个已选3环法术时消耗。',
    fighterSecondWind: '在自己的回合以附赠动作恢复 1d10＋战士等级生命值时消耗 1 次。',
    fighterActionSurge: '在自己的回合获得一个额外动作时消耗 1 次；即使17级后有两次，同一回合也只能使用一次。',
    fighterIndomitable: '重掷一次失败豁免时消耗 1 次，并必须采用新的掷骰结果。',
  }
  return details[definition.key] ?? '使用对应职业或子职能力时，按照能力说明消耗该资源。'
}

export default function ClassResourceSummary({ character }: { character: Character }) {
  const resources = classResourceDefinitions(character)
    .filter((definition) => ![
      'dnd5e-arcane-recovery',
      'dnd5e-natural-recovery',
      'dnd5e-eldritch-master',
    ].includes(definition.key))
    .map((definition) => ({ definition, state: getClassResource(character, definition.key) }))
    .filter((entry) => entry.state)
  if (resources.length === 0) return null

  return <div className="mt-4 rounded-xl border border-white/10 bg-void-900/40 p-4">
    <div>
      <h4 className="text-sm font-semibold text-slate-200">可消耗资源与恢复</h4>
      <p className="mt-1 text-[11px] leading-5 text-slate-500">显示当前剩余与消耗方式；实际消耗和恢复仍由对应动作、法术或休息结算完成。</p>
    </div>
    <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
      {resources.map(({ definition, state }) => {
        const unlimited = definition.unlimited?.(character) ?? false
        return <article key={definition.key} data-testid={`class-resource-${definition.key}`} className="rounded-lg border border-white/8 bg-white/[0.025] px-3 py-3">
          <div className="flex items-start justify-between gap-2">
            <h5 className="text-xs font-semibold text-slate-200">{definition.label}</h5>
            <span className="shrink-0 rounded-full bg-cyan-500/10 px-2 py-0.5 text-[10px] font-semibold text-cyan-100">
              {unlimited ? '不限次数' : `当前 ${state!.current} / ${state!.max}`}
            </span>
          </div>
          <p className="mt-2 text-[11px] leading-5 text-slate-400">{resourceRuleDetail(definition)}</p>
        </article>
      })}
    </div>
  </div>
}
