export const CHARACTER_EXCEL_AI_SCHEMA_VERSION = 1

export const CHARACTER_EXCEL_AI_OUTPUT_SCHEMA = Object.freeze({
  type: 'object',
  additionalProperties: false,
  required: ['schemaVersion', 'skills', 'spellNames', 'notes', 'uncertain'],
  properties: {
    schemaVersion: { type: 'integer', const: 1 },
    name: { type: 'string', maxLength: 160 },
    player: { type: 'string', maxLength: 160 },
    race: { type: 'string', maxLength: 160 },
    charClass: { type: 'string', maxLength: 160 },
    level: { type: 'integer', minimum: 1, maximum: 20 },
    background: { type: 'string', maxLength: 160 },
    alignment: { type: 'string', maxLength: 80 },
    experience: { type: 'integer', minimum: 0, maximum: 99_999_999 },
    abilities: {
      type: 'object',
      additionalProperties: false,
      properties: Object.fromEntries(['str', 'dex', 'con', 'int', 'wis', 'cha'].map((key) => [
        key,
        { type: 'integer', minimum: 1, maximum: 30 },
      ])),
    },
    currentHp: { type: 'integer', minimum: 0, maximum: 9_999 },
    maxHp: { type: 'integer', minimum: 1, maximum: 9_999 },
    tempHp: { type: 'integer', minimum: 0, maximum: 9_999 },
    speed: { type: 'integer', minimum: 0, maximum: 300 },
    saveDC: { type: 'integer', minimum: 1, maximum: 40 },
    passivePerception: { type: 'integer', minimum: 1, maximum: 50 },
    skills: { type: 'array', maxItems: 18, items: { type: 'string', maxLength: 80 } },
    spellNames: { type: 'array', maxItems: 200, items: { type: 'string', maxLength: 160 } },
    backstory: { type: 'string', maxLength: 40_000 },
    notes: { type: 'array', maxItems: 80, items: { type: 'string', maxLength: 500 } },
    uncertain: { type: 'array', maxItems: 80, items: { type: 'string', maxLength: 500 } },
  },
})

export const CHARACTER_EXCEL_AI_SYSTEM_PROMPT = [
  '你是 D&D 5e 2014 人物卡数据提取器。',
  '只提取文档明确存在的值；严禁根据职业、种族或等级猜测缺失内容。',
  '不要执行或解释公式，不要把说明文字误当作角色已选择的技能、专长或法术。',
  '技能使用中文标准名称；法术保留表内名称。无法确认的内容写入 uncertain。',
].join('\n')

export const CHARACTER_EXCEL_AI_USER_PROMPT = '补全本地解析未识别的人物卡字段。返回严格符合 schema 的 JSON。'

function boundedInteger(value, minimum, maximum) {
  return Number.isInteger(value) && Number(value) >= minimum && Number(value) <= maximum
    ? Number(value)
    : undefined
}

export function validateCharacterExcelAiPatch(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false
  const patch = value
  if (
    patch.schemaVersion !== CHARACTER_EXCEL_AI_SCHEMA_VERSION ||
    !Array.isArray(patch.skills) ||
    !Array.isArray(patch.spellNames) ||
    !Array.isArray(patch.notes) ||
    !Array.isArray(patch.uncertain)
  ) return false
  if (![...patch.skills, ...patch.spellNames, ...patch.notes, ...patch.uncertain]
    .every((entry) => typeof entry === 'string')) return false
  for (const [key, minimum, maximum] of [
    ['level', 1, 20], ['experience', 0, 99_999_999], ['currentHp', 0, 9_999], ['maxHp', 1, 9_999],
    ['tempHp', 0, 9_999], ['speed', 0, 300], ['saveDC', 1, 40], ['passivePerception', 1, 50],
  ]) {
    if (patch[key] != null && boundedInteger(patch[key], minimum, maximum) == null) return false
  }
  if (patch.abilities != null) {
    if (typeof patch.abilities !== 'object' || Array.isArray(patch.abilities)) return false
    for (const score of Object.values(patch.abilities)) {
      if (boundedInteger(score, 1, 30) == null) return false
    }
  }
  return true
}

