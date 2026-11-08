/** Pure room-policy boundaries. Inputs remain untrusted until runtime validation. */
export function armorNativeExtendedScAtomicEnvelope(writes: unknown, transactionId: unknown): boolean;
export function validArmorNativeParentJournal(journal: unknown): boolean;
export function armorNativeRawTransitionAllowed(before: unknown, after: unknown, allowConsumed?: boolean): boolean;
export function isArmorNativeChoice(row: unknown): boolean;
export function validArmorNativeChoice(row: unknown): boolean;
export function armorNativeChoicesUnchanged(before: unknown, after: unknown): boolean;
export function armorNativeChoiceBinding(parent: Record<string, unknown>): Record<string, unknown>;
export type ArmorNativePolicyResult = { ok: false; status: number; error: string } | { ok: true; changed: boolean; next: unknown };
export function lockArmorNativeRaw(journal: unknown, snapshot: unknown, identity: unknown, payload: unknown, now: number): ArmorNativePolicyResult;
export function lockArmorNativeDecision(journal: unknown, snapshot: unknown, identity: unknown, payload: unknown, now: number): ArmorNativePolicyResult;
export function lockArmorNativeDecisionFromChoice(journal: unknown, snapshot: unknown, identity: unknown, payload: unknown, now: number): ArmorNativePolicyResult;
export function armorNativeScReverseConsumptionAllowed(journal: unknown, current: unknown, incoming: unknown, writes?: unknown[], transactionId?: unknown, originalWorld?: unknown): boolean;
export function armorNativeConsumptionPaired(before: unknown, after: unknown, currentCombat: unknown, writes: unknown, transactionId: unknown, world: unknown): boolean;
