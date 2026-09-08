export interface Dnd5eActivityChoiceOptionLike {
  id: string
  label: string
  description?: string
}

interface Dnd5eDirectionStepperResult {
  direction: 'up' | 'down'
  value: number
}

interface Dnd5eDirectionStepperOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  defaultDirection?: 'up' | 'down'
  defaultValue?: number
  minValue: number
  maxValue: number
  step: number
  unit?: string
  upLabel?: string
  downLabel?: string
}

interface Dnd5eChoiceGroupsResult {
  values: Record<string, string>
}

interface Dnd5eChoiceGroupsOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  groups: readonly {
    id: string
    label: string
    options: readonly {
      id: string
      label: string
      description?: string
    }[]
  }[]
  defaultValues?: Readonly<Record<string, string>>
}

interface Dnd5eActionChoiceOptions {
  title?: string
  message: string
  cancelLabel?: string
  layout?: 'grid' | 'list'
  searchable?: boolean
  searchPlaceholder?: string
  options: readonly {
    id: string
    label: string
    description?: string
    tone?: 'violet' | 'emerald' | 'sky' | 'rose'
  }[]
}

const LEVITATE_HEIGHT_OPTION_IDS = [
  'up-5',
  'up-10',
  'up-15',
  'up-20',
  'down-5',
  'down-10',
  'down-15',
  'down-20',
] as const

const MAGIC_CIRCLE_OPTION_IDS = [
  'celestial-enter',
  'celestial-exit',
  'elemental-enter',
  'elemental-exit',
  'fey-enter',
  'fey-exit',
  'fiend-enter',
  'fiend-exit',
  'undead-enter',
  'undead-exit',
] as const

const SENSE_ORIGIN_OPTION_IDS = ['projection', 'source'] as const
const NONDETECTION_TARGET_OPTION_IDS = ['willing-creature', 'place-or-mapped-object'] as const
const PLANE_SHIFT_MODE_OPTION_IDS = ['willing-travel', 'hostile-banishment'] as const

export function dnd5eActivityChoiceUsesLevitateHeightStepper(
  options: readonly Dnd5eActivityChoiceOptionLike[],
) {
  if (options.length !== LEVITATE_HEIGHT_OPTION_IDS.length) return false
  const optionIds = new Set(options.map((option) => option.id))
  return LEVITATE_HEIGHT_OPTION_IDS.every((optionId) => optionIds.has(optionId))
}

export function dnd5eActivityChoiceUsesMagicCircleGroups(
  options: readonly Dnd5eActivityChoiceOptionLike[],
) {
  if (options.length !== MAGIC_CIRCLE_OPTION_IDS.length) return false
  const optionIds = new Set(options.map((option) => option.id))
  return MAGIC_CIRCLE_OPTION_IDS.every((optionId) => optionIds.has(optionId))
}

export function dnd5eActivityChoiceUsesSenseOriginActions(
  options: readonly Dnd5eActivityChoiceOptionLike[],
) {
  if (options.length !== SENSE_ORIGIN_OPTION_IDS.length) return false
  const optionIds = new Set(options.map((option) => option.id))
  return SENSE_ORIGIN_OPTION_IDS.every((optionId) => optionIds.has(optionId))
}

export function dnd5eActivityChoiceUsesNondetectionTargetActions(
  options: readonly Dnd5eActivityChoiceOptionLike[],
) {
  if (options.length !== NONDETECTION_TARGET_OPTION_IDS.length) return false
  const optionIds = new Set(options.map((option) => option.id))
  return NONDETECTION_TARGET_OPTION_IDS.every((optionId) => optionIds.has(optionId))
}

export function dnd5eActivityChoiceUsesPlaneShiftModeActions(
  options: readonly Dnd5eActivityChoiceOptionLike[],
) {
  if (options.length !== PLANE_SHIFT_MODE_OPTION_IDS.length) return false
  const optionIds = new Set(options.map((option) => option.id))
  return PLANE_SHIFT_MODE_OPTION_IDS.every((optionId) => optionIds.has(optionId))
}

function parseLevitateHeightOptionId(optionId: string | undefined) {
  const match = optionId?.match(/^(up|down)-(5|10|15|20)$/)
  if (!match) return null
  return {
    direction: match[1] as 'up' | 'down',
    value: Number(match[2]),
  }
}

export async function promptSearchableDnd5eActivityChoice(input: {
  ownerLabel: string
  choiceLabel: string
  options: readonly Dnd5eActivityChoiceOptionLike[]
  actionChoice: (options: Dnd5eActionChoiceOptions) => Promise<string | null>
}): Promise<Dnd5eActivityChoiceOptionLike | null> {
  if (input.options.length < 1) return null
  const selectedOptionId = await input.actionChoice({
    title: input.ownerLabel,
    message: `${input.choiceLabel}：请选择一个选项。`,
    cancelLabel: '取消',
    layout: 'list',
    searchable: true,
    searchPlaceholder: `搜索${input.choiceLabel}`,
    options: input.options.map((option) => ({
      id: option.id,
      label: option.label,
      description: option.description,
    })),
  })
  if (!selectedOptionId) return null
  return input.options.find((option) => option.id === selectedOptionId) ?? null
}

export async function promptDnd5eActivityChoice(input: {
  ownerLabel: string
  choiceLabel: string
  options: readonly Dnd5eActivityChoiceOptionLike[]
  defaultOptionId?: string
  prompt: (message: string, defaultValue: string) => Promise<string | null>
  directionStepper: (
    options: Dnd5eDirectionStepperOptions,
  ) => Promise<Dnd5eDirectionStepperResult | null>
  choiceGroups: (options: Dnd5eChoiceGroupsOptions) => Promise<Dnd5eChoiceGroupsResult | null>
  actionChoice: (options: Dnd5eActionChoiceOptions) => Promise<string | null>
  notifyInvalid: (message: string) => Promise<unknown> | unknown
  pageSize?: number
}): Promise<Dnd5eActivityChoiceOptionLike | null> {
  if (dnd5eActivityChoiceUsesSenseOriginActions(input.options)) {
    const selectedOptionId = await input.actionChoice({
      title: input.ownerLabel,
      message: `${input.choiceLabel}：选择本次视听来源。`,
      cancelLabel: '取消',
      options: input.options.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description ?? (option.id === 'projection'
          ? '通过投影视听，本体暂时无法视听。'
          : '恢复使用本体视听。'),
        tone: option.id === 'projection' ? 'violet' : 'sky',
      })),
    })
    if (!selectedOptionId) return null
    return input.options.find((option) => option.id === selectedOptionId) ?? null
  }
  if (dnd5eActivityChoiceUsesNondetectionTargetActions(input.options)) {
    const selectedOptionId = await input.actionChoice({
      title: input.ownerLabel,
      message: `${input.choiceLabel}：选择人物或物件。`,
      cancelLabel: '取消',
      options: input.options.map((option) => ({
        id: option.id,
        label: option.label,
        description: option.description,
        tone: option.id === 'willing-creature' ? 'sky' : 'violet',
      })),
    })
    if (!selectedOptionId) return null
    return input.options.find((option) => option.id === selectedOptionId) ?? null
  }
  if (dnd5eActivityChoiceUsesPlaneShiftModeActions(input.options)) {
    const selectedOptionId = await input.actionChoice({
      title: input.ownerLabel,
      message: `${input.choiceLabel}：选择友方传送或敌方传送。`,
      cancelLabel: '取消',
      options: input.options.map((option) => ({
        id: option.id,
        label: option.label,
        tone: option.id === 'willing-travel' ? 'sky' : 'rose',
      })),
    })
    if (!selectedOptionId) return null
    return input.options.find((option) => option.id === selectedOptionId) ?? null
  }
  if (dnd5eActivityChoiceUsesMagicCircleGroups(input.options)) {
    const parsedDefault = input.defaultOptionId?.match(
      /^(celestial|elemental|fey|fiend|undead)-(enter|exit)$/,
    )
    const selected = await input.choiceGroups({
      title: input.ownerLabel,
      message: '分别选择法阵针对的生物类型和阻挡方向，然后确认。',
      groups: [{
        id: 'creature',
        label: '生物类型',
        options: [
          { id: 'celestial', label: '天界生物' },
          { id: 'elemental', label: '元素生物' },
          { id: 'fey', label: '精类' },
          { id: 'fiend', label: '邪魔' },
          { id: 'undead', label: '亡灵' },
        ],
      }, {
        id: 'boundary',
        label: '法阵方向',
        options: [
          { id: 'enter', label: '阻止进入', description: '保护法阵内部，所选生物无法进入。' },
          { id: 'exit', label: '阻止离开', description: '反转法阵，所选生物无法离开。' },
        ],
      }],
      defaultValues: {
        creature: parsedDefault?.[1] ?? 'celestial',
        boundary: parsedDefault?.[2] ?? 'enter',
      },
    })
    if (!selected) return null
    const optionId = `${selected.values.creature}-${selected.values.boundary}`
    return input.options.find((option) => option.id === optionId) ?? null
  }
  if (!dnd5eActivityChoiceUsesLevitateHeightStepper(input.options)) {
    return promptSearchableDnd5eActivityChoice({
      ownerLabel: input.ownerLabel,
      choiceLabel: input.choiceLabel,
      options: input.options,
      actionChoice: input.actionChoice,
    })
  }
  const parsedDefault = parseLevitateHeightOptionId(input.defaultOptionId) ?? {
    direction: 'up' as const,
    value: 5,
  }
  const selected = await input.directionStepper({
    title: input.ownerLabel,
    message: `${input.choiceLabel}：选择上升或下降，再以 5 尺为单位调整距离。`,
    defaultDirection: parsedDefault.direction,
    defaultValue: parsedDefault.value,
    minValue: 5,
    maxValue: 20,
    step: 5,
    unit: '尺',
    upLabel: '上升',
    downLabel: '下降',
  })
  if (!selected) return null
  return input.options.find((option) => option.id === `${selected.direction}-${selected.value}`) ?? null
}
