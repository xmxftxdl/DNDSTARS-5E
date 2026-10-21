import { dnd5eShareKnownLanguage } from '../sharedLanguage'

/** Host facts only: automatic success still resolves the Activity and its costs. */
export function dnd5eActivityCommunicationSaveSucceeds(
  check: { automaticSuccessIfCannotHearSource?: true; automaticSuccessIfNoSharedLanguage?: true },
  actor: { languages?: readonly string[] },
  target: { languages?: readonly string[]; canHearActivitySource?: boolean } | undefined,
): boolean {
  if (!target) return false
  return (check.automaticSuccessIfCannotHearSource === true && target.canHearActivitySource === false) ||
    (check.automaticSuccessIfNoSharedLanguage === true && !dnd5eShareKnownLanguage(actor.languages, target.languages))
}
