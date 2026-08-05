export interface HeadlessResolutionObservation<State, Action, Result> {
  source: State
  action: Action
  result: Result
}

export type HeadlessResolutionObserver<State, Action, Result> = (
  observation: HeadlessResolutionObservation<State, Action, Result>,
) => void

let observer: HeadlessResolutionObserver<unknown, unknown, unknown> | undefined

export function setHeadlessResolutionObserver<State, Action, Result>(
  next: HeadlessResolutionObserver<State, Action, Result> | undefined,
): () => void {
  observer = next as HeadlessResolutionObserver<unknown, unknown, unknown> | undefined
  return () => {
    if (observer === next) observer = undefined
  }
}

/** Observability is fail-open and can never alter an authoritative result. */
export function observeHeadlessResolution<State, Action, Result>(
  observation: HeadlessResolutionObservation<State, Action, Result>,
): void {
  try {
    observer?.(observation)
  } catch {
    // Deliberately isolated from domain settlement.
  }
}
