export type AppDialogKind = 'alert' | 'confirm' | 'prompt'

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

export interface AppDialogRequest extends AppDialogOptions {
  id: number
  kind: AppDialogKind
  defaultValue?: string
  placeholder?: string
}

export interface AppDialogSnapshot {
  active: AppDialogRequest | null
  queuedCount: number
}

type DialogResult = boolean | string | null

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

export function resetAppDialogsForTests() {
  while (queue.length > 0) {
    const pending = queue.shift()
    if (!pending) break
    pending.resolve(pending.request.kind === 'prompt' ? null : false)
  }
  nextRequestId = 1
  publish()
}
