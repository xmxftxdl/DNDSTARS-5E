export interface Dnd5eMonsterPortraitPromptInput {
  name: string
  englishName: string
  size: string
  creatureType: string
  alignment: string
  description: string
}

export function buildDnd5eMonsterPortraitPrompt(input: Dnd5eMonsterPortraitPromptInput): string {
  const identity = [input.name, input.englishName].map((value) => value.trim()).filter(Boolean).join(' / ') || '原创奇幻怪物'
  const profile = [input.size, input.creatureType, input.alignment].map((value) => value.trim()).filter(Boolean).join('，')
  const description = input.description.trim().slice(0, 1_600)
  return [
    `为“${identity}”创作一张原创奇幻怪物立绘。`,
    profile ? `设定：${profile}。` : '',
    description ? `外观与背景参考：${description}` : '',
    '竖版 3:4，单体，全身或四分之三身，主体居中，头部和上半身清晰，轮廓明确，便于裁切为圆形地图 Token 与窄幅先攻立绘。',
    '高质量奇幻概念美术，简洁背景，无文字、无边框、无徽标、无水印；不得临摹或复现任何现有官方美术。',
  ].filter(Boolean).join('\n')
}
