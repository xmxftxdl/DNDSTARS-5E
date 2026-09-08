export type AppDialogKind =
  | 'alert'
  | 'confirm'
  | 'prompt'
  | 'direction-stepper'
  | 'choice-groups'
  | 'action-choice'

export type AppDialogTone = 'default' | 'danger'

export interface AppDialogOptions {
  title?: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: AppDialogTone
}

export interface AppPromptOptions extends AppDialogOptions {
  defaultValue?: string
  placeholder?: string
}

export type AppDirectionStepperDirection = 'up' | 'down'

export interface AppDirectionStepperResult {
  direction: AppDirectionStepperDirection
  value: number
}

export interface AppDirectionStepperOptions extends AppDialogOptions {
  defaultDirection?: AppDirectionStepperDirection
  defaultValue?: number
  minValue: number
  maxValue: number
  step: number
  unit?: string
  upLabel?: string
  downLabel?: string
}

export interface AppChoiceGroupOption {
  id: string
  label: string
  description?: string
}

export interface AppChoiceGroup {
  id: string
  label: string
  options: readonly AppChoiceGroupOption[]
}

export interface AppChoiceGroupsResult {
  values: Record<string, string>
}

export interface AppChoiceGroupsOptions extends AppDialogOptions {
  groups: readonly AppChoiceGroup[]
  defaultValues?: Readonly<Record<string, string>>
}

export type AppActionChoiceTone = 'violet' | 'emerald' | 'sky' | 'rose'
export type AppActionChoiceLayout = 'grid' | 'list'

export interface AppActionChoiceOption {
  id: string
  label: string
  description?: string
  tone?: AppActionChoiceTone
}

export interface AppActionChoiceOptions extends AppDialogOptions {
  options: readonly AppActionChoiceOption[]
  layout?: AppActionChoiceLayout
  searchable?: boolean
  searchPlaceholder?: string
}

export interface AppDialogRequest extends AppDialogOptions {
  id: number
  kind: AppDialogKind
  defaultValue?: string
  placeholder?: string
  stepperDefaultDirection?: AppDirectionStepperDirection
  stepperDefaultValue?: number
  stepperMinValue?: number
  stepperMaxValue?: number
  stepperStep?: number
  stepperUnit?: string
  stepperUpLabel?: string
  stepperDownLabel?: string
  choiceGroups?: readonly AppChoiceGroup[]
  choiceGroupDefaultValues?: Readonly<Record<string, string>>
  actionChoices?: readonly AppActionChoiceOption[]
  actionChoiceLayout?: AppActionChoiceLayout
  actionChoiceSearchable?: boolean
  actionChoiceSearchPlaceholder?: string
}

export interface AppDialogSnapshot {
  active: AppDialogRequest | null
  queuedCount: number
}

type DialogResult = boolean | string | AppDirectionStepperResult | AppChoiceGroupsResult | null

interface PendingDialog {
  request: AppDialogRequest
  resolve: (result: DialogResult) => void
}

const listeners = new Set<() => void>()
const queue: PendingDialog[] = []
let nextRequestId = 1
let snapshot: AppDialogSnapshot = { active: null, queuedCount: 0 }

function publish() {
  snapshot = {
    active: queue[0]?.request ?? null,
    queuedCount: Math.max(0, queue.length - 1),
  }
  for (const listener of listeners) listener()
}

function normalizeOptions(
  input: string | AppDialogOptions,
  defaults: Pick<AppDialogOptions, 'title' | 'confirmLabel' | 'cancelLabel'>,
): AppDialogOptions {
  const options = typeof input === 'string' ? { message: input } : input
  return {
    ...defaults,
    ...options,
    title: options.title ?? defaults.title,
    confirmLabel: options.confirmLabel ?? defaults.confirmLabel,
    cancelLabel: options.cancelLabel ?? defaults.cancelLabel,
    message: String(options.message ?? ''),
  }
}

function enqueueDialog(request: Omit<AppDialogRequest, 'id'>): Promise<DialogResult> {
  return new Promise((resolve) => {
    queue.push({
      request: { ...request, id: nextRequestId++ },
      resolve,
    })
    publish()
  })
}

export function subscribeToAppDialogs(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getAppDialogSnapshot() {
  return snapshot
}

export function settleAppDialog(id: number, result: DialogResult) {
  const pending = queue[0]
  if (!pending || pending.request.id !== id) return false
  queue.shift()
  pending.resolve(result)
  publish()
  return true
}

export async function showAppAlert(input: string | AppDialogOptions): Promise<void> {
  const options = normalizeOptions(input, {
    title: '提示',
    confirmLabel: '知道了',
  })
  await enqueueDialog({ kind: 'alert', ...options })
}

export async function showAppConfirm(input: string | AppDialogOptions): Promise<boolean> {
  const options = normalizeOptions(input, {
    title: '请确认',
    confirmLabel: '确认',
    cancelLabel: '取消',
  })
  return (await enqueueDialog({ kind: 'confirm', ...options })) === true
}

export async function showAppPrompt(
  input: string | AppPromptOptions,
  defaultValue = '',
): Promise<string | null> {
  const options = normalizeOptions(input, {
    title: '请输入',
    confirmLabel: '确认',
    cancelLabel: '取消',
  })
  const promptOptions: AppPromptOptions | undefined = typeof input === 'string' ? undefined : input
  const result = await enqueueDialog({
    kind: 'prompt',
    ...options,
    defaultValue: promptOptions?.defaultValue ?? defaultValue,
    placeholder: promptOptions?.placeholder,
  })
  return typeof result === 'string' ? result : null
}

function normalizedStepperValue(input: {
  value: number | undefined
  minValue: number
  maxValue: number
  step: number
}) {
  const minValue = Number.isFinite(input.minValue) ? input.minValue : 0
  const maxValue = Number.isFinite(input.maxValue)
    ? Math.max(minValue, input.maxValue)
    : minValue
  const step = Number.isFinite(input.step) && input.step > 0 ? input.step : 1
  const requested = Number.isFinite(input.value) ? input.value! : minValue
  const stepped = minValue + Math.round((requested - minValue) / step) * step
  return {
    minValue,
    maxValue,
    step,
    value: Math.max(minValue, Math.min(maxValue, stepped)),
  }
}

export async function showAppDirectionStepper(
  input: AppDirectionStepperOptions,
): Promise<AppDirectionStepperResult | null> {
  const options = normalizeOptions({
    title: input.title,
    message: input.message,
    confirmLabel: input.confirmLabel,
    cancelLabel: input.cancelLabel,
    tone: input.tone,
  }, {
    title: '调整数值',
    confirmLabel: '确认',
    cancelLabel: '取消',
  })
  const normalized = normalizedStepperValue({
    value: input.defaultValue,
    minValue: input.minValue,
    maxValue: input.maxValue,
    step: input.step,
  })
  const result = await enqueueDialog({
    kind: 'direction-stepper',
    ...options,
    stepperDefaultDirection: input.defaultDirection ?? 'up',
    stepperDefaultValue: normalized.value,
    stepperMinValue: normalized.minValue,
    stepperMaxValue: normalized.maxValue,
    stepperStep: normalized.step,
    stepperUnit: input.unit,
    stepperUpLabel: input.upLabel ?? '上升',
    stepperDownLabel: input.downLabel ?? '下降',
  })
  if (
    typeof result === 'object' &&
    result !== null &&
    'direction' in result &&
    'value' in result &&
    (result.direction === 'up' || result.direction === 'down') &&
    typeof result.value === 'number'
  ) return result
  return null
}

export async function showAppChoiceGroups(
  input: AppChoiceGroupsOptions,
): Promise<AppChoiceGroupsResult | null> {
  const groups = input.groups
    .filter((group) => group.id.trim() && group.options.length > 0)
    .map((group) => ({
      ...group,
      options: group.options.filter((option) => option.id.trim()),
    }))
    .filter((group) => group.options.length > 0)
  if (groups.length < 1) return null
  const defaultValues = Object.fromEntries(groups.map((group) => {
    const requested = input.defaultValues?.[group.id]
    const selected = group.options.some((option) => option.id === requested)
      ? requested!
      : group.options[0]!.id
    return [group.id, selected]
  }))
  const options = normalizeOptions({
    title: input.title,
    message: input.message,
    confirmLabel: input.confirmLabel,
    cancelLabel: input.cancelLabel,
    tone: input.tone,
  }, {
    title: '选择选项',
    confirmLabel: '确认',
    cancelLabel: '取消',
  })
  const result = await enqueueDialog({
    kind: 'choice-groups',
    ...options,
    choiceGroups: groups,
    choiceGroupDefaultValues: defaultValues,
  })
  if (typeof result !== 'object' || result === null || !('values' in result)) return null
  const valid = groups.every((group) =>
    group.options.some((option) => option.id === result.values[group.id]))
  return valid ? result : null
}

export async function showAppActionChoice(
  input: AppActionChoiceOptions,
): Promise<string | null> {
  const actionChoices = input.options.filter((option) => option.id.trim() && option.label.trim())
  if (actionChoices.length < 1) return null
  const options = normalizeOptions({
    title: input.title,
    message: input.message,
    cancelLabel: input.cancelLabel,
    tone: input.tone,
  }, {
    title: '选择操作',
    confirmLabel: '确认',
    cancelLabel: '取消',
  })
  const result = await enqueueDialog({
    kind: 'action-choice',
    ...options,
    actionChoices,
    actionChoiceLayout: input.layout ?? 'grid',
    actionChoiceSearchable: input.searchable === true,
    actionChoiceSearchPlaceholder: input.searchPlaceholder?.trim() || '搜索选项',
  })
  return typeof result === 'string' && actionChoices.some((option) => option.id === result)
    ? result
    : null
}

export function filterAppActionChoices(
  options: readonly AppActionChoiceOption[] | undefined,
  query: string,
): AppActionChoiceOption[] {
  const terms = query
    .normalize('NFKC')
    .trim()
    .toLocaleLowerCase()
    .split(/\s+/)
    .filter(Boolean)
  if (terms.length < 1) return [...(options ?? [])]
  return (options ?? []).filter((option) => {
    const haystack = `${option.label} ${option.description ?? ''} ${option.id}`
      .normalize('NFKC')
      .toLocaleLowerCase()
    return terms.every((term) => haystack.includes(term))
  })
}

export function resetAppDialogsForTests() {
  while (queue.length > 0) {
    const pending = queue.shift()
    if (!pending) break
    pending.resolve(
      pending.request.kind === 'prompt' ||
      pending.request.kind === 'direction-stepper' ||
      pending.request.kind === 'choice-groups' ||
      pending.request.kind === 'action-choice'
        ? null
        : false,
    )
  }
  nextRequestId = 1
  publish()
}
