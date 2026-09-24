export interface AccountQuotaRecord { accountId?: string; storagePlan?: unknown; storageQuotaBytes?: unknown }
export interface AccountQuotaPolicy { plan: 'basic' | 'upgraded'; limitBytes: number }
export const ACCOUNT_STORAGE_PLANS: Readonly<Record<'basic' | 'upgraded', number>>
export function accountStoragePolicy(account?: AccountQuotaRecord | null): AccountQuotaPolicy
export function accountAssetUsage(sharedRoot: string, accountId?: string, currentDirectory?: string): Promise<{ usedBytes: number; assetCount: number }>
export function withAccountAssetBudget<T>(input: { sharedRoot: string; accountId?: string; account?: AccountQuotaRecord | null; imageRoot: string; writes: { id: string; bytes: number }[] }, operation: () => Promise<T>): Promise<T>
export function handleAccountStorageRequest(req: { method: string }, res: unknown, parsed: URL, ctx: { sharedRoot?: string }, dependencies: {
  authenticateAccount: (req: unknown, ctx: unknown) => Promise<AccountQuotaRecord>;
  writeJson: (res: unknown, status: number, data: unknown) => void;
  readJsonRequest: (req: unknown) => Promise<unknown>;
  mutateAccount: (ctx: unknown, accountId: string, updater: (account: AccountQuotaRecord) => AccountQuotaRecord) => Promise<AccountQuotaRecord>;
  RoomProtocolError: new (status: number, code: string) => Error;
}): Promise<boolean>
