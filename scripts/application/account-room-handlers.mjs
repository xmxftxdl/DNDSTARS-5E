import {handleAccountStorageRequest} from "../account-storage-quota.mjs"
import {mkdir,readFile,rm,writeFile} from "node:fs/promises"
import {createHash,randomBytes,randomUUID} from "node:crypto"
import path from "node:path"
import {applyCampaignPrepPlanPatch} from "../account-campaign-prep-plan.mjs"
import {AI_JOB_LOCAL_LEASE_MS,AI_JOB_MAX_PER_CAMPAIGN,normalizeAiJobCreateRequestV2,normalizePdfCampaignAnalysisArtifact,publicAiJobV2} from "../../shared/ai-job.mjs"
import {analyzeMarketplaceDeclarativePackage,MARKETPLACE_CREATOR_NOTICE_VERSION,MARKETPLACE_CREATOR_POLICY_VERSION,normalizeMarketplacePublication} from "../../shared/marketplace-publication.mjs"
import {MARKETPLACE_PRODUCT_MANIFEST_SCHEMA_VERSION} from "../../shared/marketplace-entitlement.mjs"
import {handleRoomVoiceApi} from "./room-voice-api.mjs"
import {handleLongCastingOwnerApi} from "./long-casting-owner-api.mjs"
import {productionSecurityEnabled} from "./server-security-config.mjs"
import {atomicRename,withWriteLock} from "../adapters/file-atomic-store.mjs"

/** Account and room routes share the same authoritative core services. */
export function createAccountRoomHandlers(dependencies) {
async function handleAccountApi(req, res, parsed, ctx) {
  const {ACCOUNT_CAMPAIGN_LIMIT,ACCOUNT_CAMPAIGN_ROOM_HISTORY_LIMIT,ACCOUNT_CAMPAIGN_SCHEMA_VERSION,ACCOUNT_CHARACTER_LIMIT,ACCOUNT_PLUGIN_TOTAL_BYTES_LIMIT,ACCOUNT_PLUGIN_VERSION_LIMIT,ACCOUNT_SESSION_LIMIT,DND5E_2014_RULESET_ID,RoomProtocolError,STATE_MAX_BYTES,accountAuthCapabilities,accountCampaignListResponse,accountCampaignResponse,accountCampaigns,accountPluginBlobDirectory,accountPluginBlobFile,accountPluginVersionFromUpload,accountPluginVersions,accountPublicProfile,accountSessionResponse,accountSessionToken,aiJobExpectedRevision,aiJobLeaseMatches,applyLobbyRateLimit,assertAccountPluginPackagePolicy,assertAiJobRevision,assertMarketplacePackageEntitlement,authenticateAccount,campaignAiJobs,createAccountRecord,createLobbyRoom,createRegisteredAccount,createRoomSessionToken,decodedPluginMetadataHeader,deleteRegisteredAccount,loginRegisteredAccount,logoutAccount,marketplaceCreatorPublicRecord,marketplacePaidPublishingEnabled,mutateAccount,mutateCampaignAiWorkspace,mutateLobbyRoom,mutatePluginRegistry,normalizeAccountAvatar,normalizeAccountPassword,normalizeAccountRecoveryCode,normalizeCampaignDescription,normalizeCampaignId,normalizeLobbyRoomCode,normalizePluginDistributionPolicy,normalizePushSubscription,normalizeRoomPluginRequirements,normalizedAccountCharacterRecord,normalizedLabel,plainObject,pluginCatalogReviewRequired,randomLobbyCode,readAccount,readBody,readJsonRequest,readLobbyRoomOptional,readPluginRegistry,removeRoomEphemeralPluginStorage,requestAccountVerification,resetRegisteredAccountPassword,roomEphemeralPluginStoragePaths,roomHostIsOnline,roomLobbyFile,roomMemberResponse,roomSessionTokenHash,secretMatches,secretRecord,signMarketplaceProduct,syncMarketplaceAccountInstallation,tokenHash,validClientId,validateDeclarativePackageForPublication,verifiedDmWorkshopOrigin,withoutRoomEphemeralPlugins,writeJson} = dependencies()

  if (!parsed.pathname.startsWith('/api/accounts')) return false
  if (!applyLobbyRateLimit(req, res, ctx)) return true

  if (parsed.pathname === '/api/accounts/auth/config' && req.method === 'GET') {
    writeJson(res, 200, accountAuthCapabilities())
    return true
  }

  if (parsed.pathname === '/api/accounts/auth/verification' && req.method === 'POST') {
    const payload = await readJsonRequest(req)
    const challenge = await requestAccountVerification(ctx, req, payload)
    writeJson(res, 201, challenge)
    return true
  }

  if (parsed.pathname === '/api/accounts/auth/register' && req.method === 'POST') {
    const payload = await readJsonRequest(req)
    const { account, token } = await createRegisteredAccount(ctx, payload)
    writeJson(res, 201, { session: accountSessionResponse(account, token) })
    return true
  }

  if (parsed.pathname === '/api/accounts/auth/reset-password' && req.method === 'POST') {
    await resetRegisteredAccountPassword(ctx, req, await readJsonRequest(req))
    writeJson(res, 200, { ok: true })
    return true
  }

  if (parsed.pathname === '/api/accounts/auth/login' && req.method === 'POST') {
    const payload = await readJsonRequest(req)
    const { account, token } = await loginRegisteredAccount(ctx, req, payload)
    writeJson(res, 200, { session: accountSessionResponse(account, token) })
    return true
  }

  if (parsed.pathname === '/api/accounts/auth/logout' && req.method === 'POST') {
    await logoutAccount(req, ctx)
    writeJson(res, 200, { ok: true })
    return true
  }

  if (parsed.pathname === '/api/accounts' && req.method === 'POST') {
    if (productionSecurityEnabled() && process.env.STARS_ALLOW_LEGACY_ACCOUNT_CREATION !== 'true') {
      throw new RoomProtocolError(410, 'legacy-account-creation-disabled')
    }
    const payload = await readJsonRequest(req)
    const { account, token, recoveryCode } = await createAccountRecord(ctx, payload)
    writeJson(res, 201, { session: accountSessionResponse(account, token), recoveryCode })
    return true
  }

  if (parsed.pathname === '/api/accounts/recover' && req.method === 'POST') {
    const payload = await readJsonRequest(req)
    const recovery = normalizeAccountRecoveryCode(payload?.recoveryCode)
    const clientId = payload?.clientId
    if (!recovery || !validClientId(clientId)) throw new RoomProtocolError(400, 'invalid-recovery-code')
    const account = await readAccount(ctx, recovery.accountId).catch(() => null)
    if (!account || !secretMatches(account.recovery, recovery.secret)) {
      throw new RoomProtocolError(401, 'invalid-recovery-code')
    }
    const token = accountSessionToken(account.accountId)
    const now = Date.now()
    const next = await mutateAccount(ctx, account.accountId, (current) => ({
      ...current,
      sessions: [
        ...(Array.isArray(current.sessions) ? current.sessions : []),
        { tokenHash: tokenHash(token), clientId, createdAt: now, lastSeenAt: now },
      ].slice(-ACCOUNT_SESSION_LIMIT),
      updatedAt: now,
    }))
    writeJson(res, 200, { session: accountSessionResponse(next, token) })
    return true
  }

  if (await handleAccountStorageRequest(req, res, parsed, ctx, { authenticateAccount, writeJson, readJsonRequest, mutateAccount, RoomProtocolError })) return true

  if (parsed.pathname === '/api/accounts/me' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    writeJson(res, 200, accountPublicProfile(account))
    return true
  }

  if (parsed.pathname === '/api/accounts/me' && req.method === 'DELETE') {
    const account = await authenticateAccount(req, ctx)
    const payload = await readJsonRequest(req)
    const currentPassword = normalizeAccountPassword(payload?.currentPassword)
    if (payload?.confirmation !== 'DELETE') {
      throw new RoomProtocolError(400, 'account-deletion-confirmation-required')
    }
    const result = await deleteRegisteredAccount(ctx, account, currentPassword)
    writeJson(res, 200, result)
    return true
  }

  if (parsed.pathname === '/api/accounts/me' && req.method === 'PATCH') {
    const account = await authenticateAccount(req, ctx)
    const payload = await readJsonRequest(req, 512 * 1024)
    const displayName = normalizedLabel(payload?.displayName, 24)
    const avatar = normalizeAccountAvatar(payload?.avatar)
    if (!displayName) throw new RoomProtocolError(400, 'invalid-account-name')
    if (avatar == null) throw new RoomProtocolError(400, 'invalid-account-avatar')
    const now = Date.now()
    const next = await mutateAccount(ctx, account.accountId, (current) => ({
      ...current,
      displayName,
      ...(avatar ? { avatar } : { avatar: undefined }),
      updatedAt: now,
    }))
    writeJson(res, 200, accountPublicProfile(next))
    return true
  }

  if (parsed.pathname === '/api/accounts/me/password' && req.method === 'POST') {
    const account = await authenticateAccount(req, ctx)
    const payload = await readJsonRequest(req)
    const currentPassword = normalizeAccountPassword(payload?.currentPassword)
    const newPassword = normalizeAccountPassword(payload?.newPassword)
    if (!plainObject(account.auth) || !plainObject(account.auth.password)) {
      throw new RoomProtocolError(409, 'registered-account-required')
    }
    if (!currentPassword || !secretMatches(account.auth.password, currentPassword)) {
      throw new RoomProtocolError(401, 'invalid-account-current-password')
    }
    if (!newPassword) throw new RoomProtocolError(400, 'invalid-account-password')
    const presentedToken = req.headers['x-stars-account-token']
    const presentedHash = tokenHash(presentedToken)
    const now = Date.now()
    await mutateAccount(ctx, account.accountId, (current) => ({
      ...current,
      auth: {
        ...current.auth,
        password: secretRecord(newPassword),
      },
      sessions: (Array.isArray(current.sessions) ? current.sessions : []).filter(
        (session) => session?.tokenHash === presentedHash,
      ),
      updatedAt: now,
    }))
    writeJson(res, 200, { ok: true })
    return true
  }

  if (parsed.pathname === '/api/accounts/me/push-subscriptions' && req.method === 'PUT') {
    const account = await authenticateAccount(req, ctx)
    const payload = await readJsonRequest(req)
    const subscription = normalizePushSubscription(payload)
    if (!subscription) throw new RoomProtocolError(400, 'invalid-push-subscription')
    const now = Date.now()
    await mutateAccount(ctx, account.accountId, (current) => ({
      ...current,
      pushSubscriptions: [
        ...(Array.isArray(current.pushSubscriptions)
          ? current.pushSubscriptions.filter((candidate) => candidate?.deviceId !== subscription.deviceId)
          : []),
        { ...subscription, provider: 'expo', enabledAt: now, updatedAt: now },
      ].slice(-12),
      updatedAt: now,
    }))
    writeJson(res, 200, { registered: true, deviceId: subscription.deviceId })
    return true
  }

  if (parsed.pathname === '/api/accounts/me/push-subscriptions' && req.method === 'DELETE') {
    const account = await authenticateAccount(req, ctx)
    const payload = await readJsonRequest(req)
    const deviceId = typeof payload?.deviceId === 'string' ? payload.deviceId.trim() : ''
    if (!/^[a-zA-Z0-9._:-]{8,160}$/.test(deviceId)) {
      throw new RoomProtocolError(400, 'invalid-push-subscription')
    }
    const now = Date.now()
    await mutateAccount(ctx, account.accountId, (current) => ({
      ...current,
      pushSubscriptions: Array.isArray(current.pushSubscriptions)
        ? current.pushSubscriptions.filter((candidate) => candidate?.deviceId !== deviceId)
        : [],
      updatedAt: now,
    }))
    writeJson(res, 200, { registered: false, deviceId })
    return true
  }

  if (parsed.pathname === '/api/accounts/me/campaigns') {
    const account = await authenticateAccount(req, ctx)
    if (req.method === 'GET') {
      writeJson(res, 200, { campaigns: await accountCampaignListResponse(ctx, account) })
      return true
    }
    if (req.method === 'POST') {
      const payload = await readJsonRequest(req)
      const name = normalizedLabel(payload?.name, 60)
      const description = normalizeCampaignDescription(payload?.description)
      const rulesetId = String(payload?.rulesetId ?? '')
      if (!name) throw new RoomProtocolError(400, 'invalid-campaign-name')
      if (description == null) throw new RoomProtocolError(400, 'invalid-campaign-description')
      if (rulesetId !== DND5E_2014_RULESET_ID) throw new RoomProtocolError(400, 'invalid-ruleset')
      const now = Date.now()
      let created = null
      const next = await mutateAccount(ctx, account.accountId, (current) => {
        const campaigns = accountCampaigns(current)
        if (campaigns.length >= ACCOUNT_CAMPAIGN_LIMIT) {
          throw new RoomProtocolError(409, 'account-campaign-limit')
        }
        let campaignId = ''
        for (let attempt = 0; attempt < 32; attempt += 1) {
          const candidate = randomLobbyCode(12)
          if (!campaigns.some((campaign) => campaign.campaignId === candidate)) {
            campaignId = candidate
            break
          }
        }
        if (!campaignId) throw new RoomProtocolError(503, 'campaign-id-exhausted')
        created = {
          schemaVersion: ACCOUNT_CAMPAIGN_SCHEMA_VERSION,
          campaignId,
          ownerAccountId: current.accountId,
          name,
          description,
          rulesetId,
          archived: false,
          roomCount: 0,
          roomHistory: [],
          createdAt: now,
          updatedAt: now,
        }
        return {
          ...current,
          campaigns: [...campaigns, created],
          updatedAt: now,
        }
      })
      const persisted = accountCampaigns(next).find((campaign) => campaign.campaignId === created?.campaignId)
      writeJson(res, 201, await accountCampaignResponse(ctx, persisted))
      return true
    }
    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  const accountCampaignAiJobsMatch = parsed.pathname.match(
    /^\/api\/accounts\/me\/campaigns\/([^/]+)\/ai-jobs$/,
  )
  if (accountCampaignAiJobsMatch) {
    const account = await authenticateAccount(req, ctx)
    const campaignId = normalizeCampaignId(decodeURIComponent(accountCampaignAiJobsMatch[1] ?? ''))
    if (campaignId.length !== 12) throw new RoomProtocolError(400, 'invalid-campaign-id')
    const campaign = accountCampaigns(account).find((candidate) => candidate.campaignId === campaignId)
    if (!campaign) throw new RoomProtocolError(404, 'account-campaign-not-found')
    if (req.method === 'GET') {
      const includeArtifact = parsed.searchParams.get('includeArtifact') === '1'
      writeJson(res, 200, {
        schemaVersion: 2,
        jobs: campaignAiJobs(campaign)
          .sort((left, right) => right.updatedAt - left.updatedAt)
          .map((job) => publicAiJobV2(job, includeArtifact)),
      })
      return true
    }
    if (req.method === 'POST') {
      const payload = await readJsonRequest(req, 128 * 1024)
      const request = normalizeAiJobCreateRequestV2(payload)
      if (!request) throw new RoomProtocolError(400, 'invalid-ai-job-request')
      if (request.executionMode !== 'local-runner') {
        throw new RoomProtocolError(409, 'ai-provider-not-configured')
      }
      let created = null
      let reused = false
      await mutateCampaignAiWorkspace(ctx, account.accountId, campaignId, (jobs, _currentCampaign, now) => {
        const existing = jobs.find((job) => job.idempotencyKey === request.idempotencyKey)
        if (existing) {
          created = existing
          reused = true
          return jobs
        }
        if (jobs.length >= AI_JOB_MAX_PER_CAMPAIGN) {
          throw new RoomProtocolError(409, 'ai-job-limit')
        }
        created = {
          ...request,
          jobId: randomUUID(),
          accountId: account.accountId,
          campaignId,
          status: 'awaiting-local-runner',
          revision: 1,
          progress: { stage: 'awaiting-local-runner', current: 0, total: 0, message: '等待本地模型接管任务' },
          lease: null,
          artifact: null,
          failure: null,
          createdAt: now,
          updatedAt: now,
        }
        return [...jobs, created]
      })
      writeJson(res, reused ? 200 : 201, { job: publicAiJobV2(created, true), reused })
      return true
    }
    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  const accountCampaignAiJobMatch = parsed.pathname.match(
    /^\/api\/accounts\/me\/campaigns\/([^/]+)\/ai-jobs\/([^/]+)(?:\/(lease|progress|failure|result|artifact|cancel))?$/,
  )
  if (accountCampaignAiJobMatch) {
    const account = await authenticateAccount(req, ctx)
    const campaignId = normalizeCampaignId(decodeURIComponent(accountCampaignAiJobMatch[1] ?? ''))
    const jobId = decodeURIComponent(accountCampaignAiJobMatch[2] ?? '')
    const action = accountCampaignAiJobMatch[3] ?? ''
    if (campaignId.length !== 12 || !/^[a-f0-9-]{20,80}$/i.test(jobId)) {
      throw new RoomProtocolError(400, 'invalid-ai-job-id')
    }
    const campaign = accountCampaigns(account).find((candidate) => candidate.campaignId === campaignId)
    if (!campaign) throw new RoomProtocolError(404, 'account-campaign-not-found')
    const currentJob = campaignAiJobs(campaign).find((job) => job.jobId === jobId)
    if (!currentJob) throw new RoomProtocolError(404, 'ai-job-not-found')
    if (!action && req.method === 'GET') {
      writeJson(res, 200, { job: publicAiJobV2(currentJob, true) })
      return true
    }

    if (!action && req.method === 'DELETE') {
      const payload = await readJsonRequest(req)
      const expectedRevision = aiJobExpectedRevision(payload?.expectedRevision)
      await mutateCampaignAiWorkspace(ctx, account.accountId, campaignId, (jobs, _currentCampaign, now) => {
        const target = jobs.find((job) => job.jobId === jobId)
        if (!target) throw new RoomProtocolError(404, 'ai-job-not-found')
        assertAiJobRevision(target, expectedRevision)
        if (target.status === 'running' && target.lease && target.lease.expiresAt > now) {
          throw new RoomProtocolError(409, 'ai-job-active')
        }
        return jobs.filter((job) => job.jobId !== jobId)
      })
      writeJson(res, 200, { deleted: true, jobId })
      return true
    }

    if (action === 'lease' && req.method === 'POST') {
      const payload = await readJsonRequest(req)
      const runnerId = normalizedLabel(payload?.runnerId, 160)
      const expectedRevision = aiJobExpectedRevision(payload?.expectedRevision)
      if (!runnerId) throw new RoomProtocolError(400, 'invalid-ai-runner')
      const leaseToken = randomBytes(32).toString('base64url')
      let updated = null
      await mutateCampaignAiWorkspace(ctx, account.accountId, campaignId, (jobs, _currentCampaign, now) => jobs.map((job) => {
        if (job.jobId !== jobId) return job
        assertAiJobRevision(job, expectedRevision)
        const leaseActive = job.lease && job.lease.expiresAt > now
        const ownedTakeover = job.status === 'running' && leaseActive && payload?.takeoverOwnedLease === true &&
          job.lease.runnerId === runnerId
        if (job.status !== 'awaiting-local-runner' && !(job.status === 'running' && (!leaseActive || ownedTakeover))) {
          throw new RoomProtocolError(409, 'ai-job-not-leasable')
        }
        updated = {
          ...job,
          status: 'running',
          revision: job.revision + 1,
          progress: { ...job.progress, stage: 'running', message: '本地模型正在分析' },
          lease: {
            tokenHash: tokenHash(leaseToken),
            runnerId,
            acquiredAt: now,
            expiresAt: now + AI_JOB_LOCAL_LEASE_MS,
          },
          updatedAt: now,
        }
        return updated
      }))
      writeJson(res, 200, { job: publicAiJobV2(updated, false), leaseToken })
      return true
    }

    if (action === 'progress' && req.method === 'POST') {
      const payload = await readJsonRequest(req)
      const expectedRevision = aiJobExpectedRevision(payload?.expectedRevision)
      let updated = null
      await mutateCampaignAiWorkspace(ctx, account.accountId, campaignId, (jobs, _currentCampaign, now) => jobs.map((job) => {
        if (job.jobId !== jobId) return job
        assertAiJobRevision(job, expectedRevision)
        if (job.status !== 'running' || !aiJobLeaseMatches(job, payload?.leaseToken, now)) {
          throw new RoomProtocolError(409, 'invalid-ai-job-lease')
        }
        const current = Number(payload?.progress?.current)
        const total = Number(payload?.progress?.total)
        updated = {
          ...job,
          revision: job.revision + 1,
          progress: {
            stage: normalizedLabel(payload?.progress?.stage, 80) || 'running',
            current: Number.isSafeInteger(current) && current >= 0 ? current : job.progress.current,
            total: Number.isSafeInteger(total) && total >= 0 ? total : job.progress.total,
            message: normalizedLabel(payload?.progress?.message, 500),
          },
          lease: { ...job.lease, expiresAt: now + AI_JOB_LOCAL_LEASE_MS },
          updatedAt: now,
        }
        return updated
      }))
      writeJson(res, 200, { job: publicAiJobV2(updated, false) })
      return true
    }

    if (action === 'failure' && req.method === 'POST') {
      const payload = await readJsonRequest(req, 64 * 1024)
      const expectedRevision = aiJobExpectedRevision(payload?.expectedRevision)
      const failureCode = normalizedLabel(payload?.failure?.code, 120) || 'ai-job-failed'
      const failureMessage = normalizedLabel(payload?.failure?.message, 1_000)
      let updated = null
      await mutateCampaignAiWorkspace(ctx, account.accountId, campaignId, (jobs, _currentCampaign, now) => jobs.map((job) => {
        if (job.jobId !== jobId) return job
        assertAiJobRevision(job, expectedRevision)
        if (job.status !== 'running' || !aiJobLeaseMatches(job, payload?.leaseToken, now)) {
          throw new RoomProtocolError(409, 'invalid-ai-job-lease')
        }
        updated = {
          ...job,
          status: 'failed',
          revision: job.revision + 1,
          progress: { ...job.progress, stage: 'failed', message: '本地模型分析失败，可重新选择原始 PDF 后重试' },
          lease: null,
          failure: { code: failureCode, message: failureMessage },
          updatedAt: now,
          completedAt: now,
        }
        return updated
      }))
      writeJson(res, 200, { job: publicAiJobV2(updated, false) })
      return true
    }

    if (action === 'result' && req.method === 'POST') {
      const payload = await readJsonRequest(req, 4 * 1024 * 1024)
      const artifact = normalizePdfCampaignAnalysisArtifact(payload?.artifact)
      const expectedRevision = aiJobExpectedRevision(payload?.expectedRevision)
      if (!artifact) throw new RoomProtocolError(400, 'invalid-ai-job-artifact')
      let updated = null
      await mutateCampaignAiWorkspace(ctx, account.accountId, campaignId, (jobs, _currentCampaign, now) => jobs.map((job) => {
        if (job.jobId !== jobId) return job
        assertAiJobRevision(job, expectedRevision)
        if (job.status !== 'running' || !aiJobLeaseMatches(job, payload?.leaseToken, now)) {
          throw new RoomProtocolError(409, 'invalid-ai-job-lease')
        }
        updated = {
          ...job,
          status: 'review-required',
          revision: job.revision + 1,
          progress: { stage: 'review-required', current: 1, total: 1, message: '等待 DM 审阅与编辑' },
          lease: null,
          artifact,
          failure: null,
          updatedAt: now,
          resultAt: now,
        }
        return updated
      }))
      writeJson(res, 200, { job: publicAiJobV2(updated, true) })
      return true
    }

    if (action === 'artifact' && req.method === 'PUT') {
      const payload = await readJsonRequest(req, 4 * 1024 * 1024)
      const artifact = normalizePdfCampaignAnalysisArtifact(payload?.artifact)
      const expectedRevision = aiJobExpectedRevision(payload?.expectedRevision)
      if (!artifact) throw new RoomProtocolError(400, 'invalid-ai-job-artifact')
      let updated = null
      await mutateCampaignAiWorkspace(ctx, account.accountId, campaignId, (jobs, _currentCampaign, now) => jobs.map((job) => {
        if (job.jobId !== jobId) return job
        assertAiJobRevision(job, expectedRevision)
        if (!['review-required', 'completed'].includes(job.status)) {
          throw new RoomProtocolError(409, 'ai-job-artifact-not-editable')
        }
        updated = {
          ...job,
          status: 'review-required',
          revision: job.revision + 1,
          artifact,
          updatedAt: now,
        }
        return updated
      }))
      writeJson(res, 200, { job: publicAiJobV2(updated, true) })
      return true
    }

    if (action === 'cancel' && req.method === 'POST') {
      const payload = await readJsonRequest(req)
      const expectedRevision = aiJobExpectedRevision(payload?.expectedRevision)
      let updated = null
      await mutateCampaignAiWorkspace(ctx, account.accountId, campaignId, (jobs, _currentCampaign, now) => jobs.map((job) => {
        if (job.jobId !== jobId) return job
        assertAiJobRevision(job, expectedRevision)
        if (['completed', 'failed', 'cancelled'].includes(job.status)) {
          throw new RoomProtocolError(409, 'ai-job-not-cancellable')
        }
        updated = {
          ...job,
          status: 'cancelled',
          revision: job.revision + 1,
          lease: null,
          progress: { ...job.progress, stage: 'cancelled', message: '任务已由 DM 取消' },
          updatedAt: now,
          completedAt: now,
        }
        return updated
      }))
      writeJson(res, 200, { job: publicAiJobV2(updated, false) })
      return true
    }
    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  const accountCampaignResumeRoomMatch = parsed.pathname.match(
    /^\/api\/accounts\/me\/campaigns\/([^/]+)\/rooms\/current$/,
  )
  if (accountCampaignResumeRoomMatch) {
    if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
    const account = await authenticateAccount(req, ctx)
    const campaignId = normalizeCampaignId(decodeURIComponent(accountCampaignResumeRoomMatch[1] ?? ''))
    if (campaignId.length !== 12) throw new RoomProtocolError(400, 'invalid-campaign-id')
    const campaign = accountCampaigns(account).find((candidate) => candidate.campaignId === campaignId)
    if (!campaign) throw new RoomProtocolError(404, 'account-campaign-not-found')
    if (campaign.archived === true) throw new RoomProtocolError(409, 'campaign-archived')
    const roomId = normalizeLobbyRoomCode(campaign.lastRoomId)
    if (roomId.length !== 6) throw new RoomProtocolError(404, 'campaign-room-not-found')
    const payload = await readJsonRequest(req)
    const clientId = payload?.clientId
    const activePlugins = normalizeRoomPluginRequirements(payload?.activePlugins ?? [])
    const displayName = normalizedLabel(payload?.displayName, 24) || account.displayName
    if (!validClientId(clientId)) throw new RoomProtocolError(400, 'invalid-client')
    if (!activePlugins) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
    if (!displayName) throw new RoomProtocolError(400, 'invalid-display-name')
    const roomToken = createRoomSessionToken()
    const now = Date.now()
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      if (
        room.campaignId !== campaignId ||
        room.campaignOwnerAccountId !== account.accountId ||
        room.host?.accountId !== account.accountId
      ) {
        return { ok: false, status: 403, error: 'forbidden' }
      }
      const host = {
        ...room.host,
        clientId,
        displayName,
        activePlugins,
        lastSeenAt: now,
        roomTokenHash: roomSessionTokenHash(roomToken),
      }
      return {
        ok: true,
        member: host,
        next: {
          ...room,
          host,
          updatedAt: now,
        },
      }
    })
    writeJson(res, 200, roomMemberResponse(result.room, result.member, 'dm', roomToken))
    return true
  }

  const accountCampaignRoomMatch = parsed.pathname.match(/^\/api\/accounts\/me\/campaigns\/([^/]+)\/rooms$/)
  if (accountCampaignRoomMatch) {
    if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
    const account = await authenticateAccount(req, ctx)
    const campaignId = normalizeCampaignId(decodeURIComponent(accountCampaignRoomMatch[1] ?? ''))
    if (campaignId.length !== 12) throw new RoomProtocolError(400, 'invalid-campaign-id')
    const payload = await readJsonRequest(req)
    if (payload?.accountId != null && payload.accountId !== account.accountId) {
      throw new RoomProtocolError(401, 'invalid-account-session')
    }
    const now = Date.now()
    let createdRoom = null
    let createdMember = null
    let createdRoomToken = null
    try {
      await mutateAccount(ctx, account.accountId, async (current) => {
        const campaigns = accountCampaigns(current)
        const campaignIndex = campaigns.findIndex((campaign) => campaign.campaignId === campaignId)
        if (campaignIndex < 0) throw new RoomProtocolError(404, 'account-campaign-not-found')
        const campaign = campaigns[campaignIndex]
        if (campaign.archived === true) throw new RoomProtocolError(409, 'campaign-archived')
        const previousRoom = await readLobbyRoomOptional(ctx, campaign.lastRoomId)
        if (
          previousRoom &&
          previousRoom.campaignId === campaignId &&
          previousRoom.campaignOwnerAccountId === current.accountId &&
          !previousRoom.closedAt
        ) {
          if (roomHostIsOnline(previousRoom, now)) {
            throw new RoomProtocolError(409, 'campaign-room-active')
          }
          const closed = await mutateLobbyRoom(ctx, previousRoom.id, (room) => {
            const ephemeralStoragePaths = roomEphemeralPluginStoragePaths(ctx, previousRoom.id, room)
            const withoutEphemeral = withoutRoomEphemeralPlugins(room)
            return {
              ok: true,
              ephemeralStoragePaths,
              next: {
                ...withoutEphemeral,
                closedAt: now,
                updatedAt: now,
                host: { ...room.host, lastSeenAt: 0 },
              },
            }
          })
          await removeRoomEphemeralPluginStorage(closed.ephemeralStoragePaths ?? [])
        }
        const roomNumber = (Array.isArray(campaign.roomHistory) ? campaign.roomHistory.length : 0) + 1
        const roomPayload = {
          ...payload,
          roomName: normalizedLabel(payload?.roomName, 40) || `${campaign.name} · 第 ${roomNumber} 场`,
          rulesetId: campaign.rulesetId,
        }
        const created = await createLobbyRoom(ctx, roomPayload, current, now, campaignId)
        createdRoom = created.room
        createdMember = created.member
        createdRoomToken = created.roomToken
        const history = [
          ...(Array.isArray(campaign.roomHistory) ? campaign.roomHistory : []),
          { roomId: created.room.id, createdAt: now },
        ].slice(-ACCOUNT_CAMPAIGN_ROOM_HISTORY_LIMIT)
        const updatedCampaign = {
          ...campaign,
          roomCount: (Number.isSafeInteger(campaign.roomCount)
            ? campaign.roomCount
            : Array.isArray(campaign.roomHistory) ? campaign.roomHistory.length : 0) + 1,
          roomHistory: history,
          lastRoomId: created.room.id,
          updatedAt: now,
        }
        return {
          ...current,
          campaigns: campaigns.map((candidate, index) => index === campaignIndex ? updatedCampaign : candidate),
          updatedAt: now,
        }
      })
    } catch (error) {
      if (createdRoom?.id) await rm(roomLobbyFile(ctx, createdRoom.id), { force: true }).catch(() => {})
      throw error
    }
    writeJson(res, 201, roomMemberResponse(createdRoom, createdMember, 'dm', createdRoomToken))
    return true
  }

  const accountCampaignMatch = parsed.pathname.match(/^\/api\/accounts\/me\/campaigns\/([^/]+)$/)
  if (accountCampaignMatch) {
    const account = await authenticateAccount(req, ctx)
    const campaignId = normalizeCampaignId(decodeURIComponent(accountCampaignMatch[1] ?? ''))
    if (campaignId.length !== 12) throw new RoomProtocolError(400, 'invalid-campaign-id')
    const currentCampaign = accountCampaigns(account).find((campaign) => campaign.campaignId === campaignId)
    if (!currentCampaign) throw new RoomProtocolError(404, 'account-campaign-not-found')
    if (req.method === 'GET') {
      writeJson(res, 200, await accountCampaignResponse(ctx, currentCampaign))
      return true
    }
    if (req.method === 'PATCH') {
      const payload = await readJsonRequest(req)
      const requestedName = payload?.name == null ? null : normalizedLabel(payload.name, 60)
      const requestedDescription = payload?.description == null ? null : normalizeCampaignDescription(payload.description)
      if (payload?.name != null && !requestedName) throw new RoomProtocolError(400, 'invalid-campaign-name')
      if (payload?.description != null && requestedDescription == null) throw new RoomProtocolError(400, 'invalid-campaign-description')
      if (payload?.archived != null && typeof payload.archived !== 'boolean') {
        throw new RoomProtocolError(400, 'invalid-campaign-archive-state')
      }
      const now = Date.now()
      const next = await mutateAccount(ctx, account.accountId, (current) => {
        const campaigns = accountCampaigns(current)
        const storedCampaign = campaigns.find((campaign) => campaign.campaignId === campaignId)
        if (!storedCampaign) {
          throw new RoomProtocolError(404, 'account-campaign-not-found')
        }
        const prepPlanResult = applyCampaignPrepPlanPatch(storedCampaign.prepPlan, payload, now)
        if (!prepPlanResult.ok) throw new RoomProtocolError(prepPlanResult.status, prepPlanResult.error)
        return {
          ...current,
          campaigns: campaigns.map((campaign) => campaign.campaignId === campaignId
            ? {
                ...campaign,
                name: requestedName ?? campaign.name,
                description: requestedDescription ?? campaign.description ?? '',
                archived: payload?.archived ?? campaign.archived === true,
                ...(prepPlanResult.value ? { prepPlan: prepPlanResult.value } : {}),
                updatedAt: now,
              }
            : campaign),
          updatedAt: now,
        }
      })
      const updated = accountCampaigns(next).find((campaign) => campaign.campaignId === campaignId)
      writeJson(res, 200, await accountCampaignResponse(ctx, updated))
      return true
    }
    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  if (parsed.pathname === '/api/accounts/me/characters' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    writeJson(res, 200, { characters: Array.isArray(account.characters) ? account.characters : [] })
    return true
  }

  if (parsed.pathname === '/api/accounts/me/plugins' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    writeJson(res, 200, {
      plugins: accountPluginVersions(account)
        .sort((left, right) => right.updatedAt - left.updatedAt || left.id.localeCompare(right.id)),
      limits: {
        maxVersions: ACCOUNT_PLUGIN_VERSION_LIMIT,
        maxTotalBytes: ACCOUNT_PLUGIN_TOTAL_BYTES_LIMIT,
        maxPackageBytes: STATE_MAX_BYTES,
      },
    })
    return true
  }

  if (parsed.pathname === '/api/accounts/me/creator') {
    const account = await authenticateAccount(req, ctx)
    if (req.method === 'GET') {
      const registry = await readPluginRegistry(ctx)
      const creator = registry.creators.find((candidate) => candidate.accountId === account.accountId)
      writeJson(res, 200, { creator: marketplaceCreatorPublicRecord(account, creator) })
      return true
    }
    if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
    const payload = await readJsonRequest(req)
    const countryOrRegion = normalizedLabel(payload?.countryOrRegion, 80)
    const verificationReference = normalizedLabel(payload?.verificationReference, 200)
    if (
      !countryOrRegion ||
      verificationReference.length < 6 ||
      payload?.acceptedPolicyVersion !== MARKETPLACE_CREATOR_POLICY_VERSION ||
      payload?.acceptedNoticeVersion !== MARKETPLACE_CREATOR_NOTICE_VERSION
    ) throw new RoomProtocolError(400, 'invalid-creator-application')
    const now = Date.now()
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const existing = current.creators.find((candidate) => candidate.accountId === account.accountId)
      if (existing?.status === 'verified' || existing?.status === 'suspended') {
        throw new RoomProtocolError(409, existing.status === 'verified'
          ? 'creator-already-verified'
          : 'creator-account-suspended')
      }
      const creator = {
        schemaVersion: 1,
        accountId: account.accountId,
        displayName: account.auth?.username ?? account.displayName,
        status: 'pending',
        countryOrRegion,
        verificationReference,
        policyVersion: MARKETPLACE_CREATOR_POLICY_VERSION,
        noticeVersion: MARKETPLACE_CREATOR_NOTICE_VERSION,
        appliedAt: now,
      }
      return {
        ...current,
        creators: [...current.creators.filter((candidate) => candidate.accountId !== account.accountId), creator],
      }
    })
    const creator = registry.creators.find((candidate) => candidate.accountId === account.accountId)
    writeJson(res, 202, { creator: marketplaceCreatorPublicRecord(account, creator) })
    return true
  }

  if (parsed.pathname === '/api/accounts/me/entitlements' && req.method === 'GET') {
    const account = await authenticateAccount(req, ctx)
    const registry = await readPluginRegistry(ctx)
    writeJson(res, 200, {
      entitlements: registry.entitlements
        .filter((entitlement) => entitlement.accountId === account.accountId)
        .sort((left, right) => Number(right.grantedAt ?? 0) - Number(left.grantedAt ?? 0)),
    })
    return true
  }

  const accountPluginPublicationMatch = parsed.pathname.match(
    /^\/api\/accounts\/me\/plugins\/([^/]+)\/versions\/([^/]+)\/publication$/,
  )
  if (accountPluginPublicationMatch) {
    if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
    const account = await authenticateAccount(req, ctx)
    const pluginId = decodeURIComponent(accountPluginPublicationMatch[1] ?? '')
    const pluginVersion = decodeURIComponent(accountPluginPublicationMatch[2] ?? '')
    const plugin = accountPluginVersions(account).find((candidate) =>
      candidate.id === pluginId && candidate.version === pluginVersion)
    if (!plugin) throw new RoomProtocolError(404, 'account-plugin-not-found')
    const payload = await readJsonRequest(req)
    const visibility = payload?.visibility
    if (!['public', 'unlisted', 'private'].includes(visibility)) {
      throw new RoomProtocolError(400, 'invalid-plugin-publication')
    }
    const now = Date.now()
    if (visibility === 'private') {
      const registry = await mutatePluginRegistry(ctx, (current) => ({
        ...current,
        entries: current.entries.map((entry) => entry.id === pluginId && entry.publisher?.accountId === account.accountId
          ? {
              ...entry,
              updatedAt: now,
              versions: (Array.isArray(entry.versions) ? entry.versions : []).map((version) =>
                version.version === pluginVersion
                  ? { ...version, status: 'withdrawn', visibility: 'private', moderatedAt: now }
                  : version),
            }
          : entry),
      }))
      const entry = registry.entries.find((candidate) => candidate.id === pluginId)
      writeJson(res, 200, { publication: entry ?? null })
      return true
    }
    if (plugin.distributionPolicy !== 'room-distributable') {
      throw new RoomProtocolError(409, 'plugin-not-publicly-distributable')
    }
    const bytes = await readFile(accountPluginBlobFile(ctx, plugin.integrity))
    const parsedPackage = validateDeclarativePackageForPublication(bytes, plugin)
    const marketplaceResult = normalizeMarketplacePublication(payload, { allowLegacyFree: true })
    if (!marketplaceResult.ok) throw new RoomProtocolError(400, marketplaceResult.error)
    if (Array.isArray(parsedPackage.assets) && parsedPackage.assets.length > 0 && !marketplaceResult.value.rightsManifest?.assets.some((asset) => asset.category === 'art')) throw new RoomProtocolError(400, 'marketplace-art-rights-required')
    const creatorRegistry = await readPluginRegistry(ctx)
    const creator = creatorRegistry.creators.find((candidate) => candidate.accountId === account.accountId)
    if (marketplaceResult.value.pricing.kind === 'paid' && !marketplacePaidPublishingEnabled()) {
      throw new RoomProtocolError(503, 'marketplace-paid-commerce-disabled')
    }
    if (marketplaceResult.value.pricing.kind === 'paid' && creator?.status !== 'verified') {
      throw new RoomProtocolError(403, 'verified-creator-required')
    }
    const automatedAnalysis = analyzeMarketplaceDeclarativePackage(parsedPackage)
    if (automatedAnalysis.riskLevel === 'blocked') {
      throw new RoomProtocolError(400, 'marketplace-automated-analysis-blocked')
    }
    const changelog = normalizedLabel(payload?.changelog, 4_000)
    const storeDescription = normalizedLabel(payload?.storeDescription, 20_000)
    if (payload?.commerce && storeDescription.length < 20) {
      throw new RoomProtocolError(400, 'marketplace-store-description-required')
    }
    const tags = Array.isArray(payload?.tags)
      ? [...new Set(payload.tags.map((tag) => normalizedLabel(tag, 32)).filter(Boolean))].slice(0, 12)
      : []
    const productManifest = {
      schemaVersion: MARKETPLACE_PRODUCT_MANIFEST_SCHEMA_VERSION,
      productId: plugin.id,
      listingId: plugin.id,
      version: plugin.version,
      publisherAccountId: account.accountId,
      integrity: plugin.integrity,
      rulesetId: plugin.rulesetId,
      contentCategory: plugin.contentCategory,
      pricing: {
        kind: marketplaceResult.value.pricing.kind,
        currency: marketplaceResult.value.pricing.currency,
        amountMinor: marketplaceResult.value.pricing.amountMinor,
      },
      issuedAt: now,
    }
    const productSignature = await signMarketplaceProduct(ctx, productManifest)
    const status = pluginCatalogReviewRequired() ? 'pending' : 'published'
    const registry = await mutatePluginRegistry(ctx, (current) => {
      const currentCreator = current.creators.find((candidate) => candidate.accountId === account.accountId)
      if (marketplaceResult.value.pricing.kind === 'paid' && currentCreator?.status !== 'verified') {
        throw new RoomProtocolError(403, 'verified-creator-required')
      }
      const existing = current.entries.find((entry) => entry.id === pluginId)
      if (existing && existing.publisher?.accountId !== account.accountId) {
        throw new RoomProtocolError(409, 'plugin-id-owned-by-other-publisher')
      }
      const versionRecord = {
        ...plugin,
        visibility,
        status,
        changelog,
        storeDescription: storeDescription || plugin.description || '',
        marketplace: marketplaceResult.value,
        automatedAnalysis,
        productManifest,
        productSignature,
        submittedAt: now,
        ...(status === 'published' ? { publishedAt: now } : {}),
      }
      const entry = {
        schemaVersion: 1,
        id: plugin.id,
        name: plugin.name,
        description: plugin.description ?? '',
        publisher: {
          accountId: account.accountId,
          displayName: account.auth?.username ?? account.displayName,
          creatorVerified: currentCreator?.status === 'verified',
        },
        contentCategory: plugin.contentCategory,
        tags,
        versions: [
          ...(Array.isArray(existing?.versions) ? existing.versions : [])
            .filter((candidate) => candidate.version !== plugin.version),
          versionRecord,
        ],
        createdAt: existing?.createdAt ?? now,
        updatedAt: now,
      }
      return {
        ...current,
        entries: [...current.entries.filter((candidate) => candidate.id !== pluginId), entry],
      }
    })
    const entry = registry.entries.find((candidate) => candidate.id === pluginId)
    writeJson(res, status === 'pending' ? 202 : 201, { publication: entry, status })
    return true
  }

  const accountPluginMatch = parsed.pathname.match(
    /^\/api\/accounts\/me\/plugins\/([^/]+)\/versions\/([^/]+)$/,
  )
  if (accountPluginMatch) {
    const account = await authenticateAccount(req, ctx)
    const pluginId = decodeURIComponent(accountPluginMatch[1] ?? '')
    const pluginVersion = decodeURIComponent(accountPluginMatch[2] ?? '')
    if (
      !/^[a-z0-9][a-z0-9._-]{0,99}$/.test(pluginId) ||
      !/^[A-Za-z0-9][A-Za-z0-9._+-]{0,63}$/.test(pluginVersion)
    ) throw new RoomProtocolError(400, 'invalid-account-plugin')

    const currentVersions = accountPluginVersions(account)
    const current = currentVersions.find((candidate) =>
      candidate.id === pluginId && candidate.version === pluginVersion)

    if (req.method === 'PUT') {
      const uploadMetadata = decodedPluginMetadataHeader(req)
      const uploadDistributionPolicy = normalizePluginDistributionPolicy(uploadMetadata.distributionPolicy)
      if (uploadDistributionPolicy === 'local-only') {
        throw new RoomProtocolError(409, 'plugin-local-only')
      }
      if (uploadDistributionPolicy === 'room-ephemeral') {
        throw new RoomProtocolError(409, 'plugin-ephemeral-room-only')
      }
      const bytes = await readBody(req, STATE_MAX_BYTES)
      if (bytes.length < 1) throw new RoomProtocolError(400, 'account-plugin-file-empty')
      assertAccountPluginPackagePolicy(
        bytes,
        pluginId,
        pluginVersion,
        uploadDistributionPolicy ?? 'room-distributable',
      )
      const now = Date.now()
      const workshopOrigin = await verifiedDmWorkshopOrigin(req, ctx, account, now)
      const record = accountPluginVersionFromUpload(
        req,
        pluginId,
        pluginVersion,
        bytes.length,
        workshopOrigin,
        now,
      )
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== record.integrity) {
        throw new RoomProtocolError(409, 'account-plugin-integrity-mismatch')
      }
      const marketplaceProduct = await assertMarketplacePackageEntitlement(
        ctx,
        account.accountId,
        record.integrity,
      )
      if (current) {
        if (current.integrity !== record.integrity) {
          throw new RoomProtocolError(409, 'account-plugin-version-conflict')
        }
        if (marketplaceProduct) {
          await syncMarketplaceAccountInstallation(ctx, {
            accountId: account.accountId,
            integrity: record.integrity,
            active: true,
            timestamp: now,
          })
        }
        writeJson(res, 200, current)
        return true
      }
      if (currentVersions.length >= ACCOUNT_PLUGIN_VERSION_LIMIT) {
        throw new RoomProtocolError(409, 'account-plugin-version-limit')
      }
      const totalBytes = currentVersions.reduce((total, candidate) => total + candidate.sizeBytes, 0)
      if (totalBytes + record.sizeBytes > ACCOUNT_PLUGIN_TOTAL_BYTES_LIMIT) {
        throw new RoomProtocolError(409, 'account-plugin-storage-limit')
      }
      await mkdir(accountPluginBlobDirectory(ctx), { recursive: true })
      const blobPath = accountPluginBlobFile(ctx, record.integrity)
      try {
        await writeFile(blobPath, bytes, { flag: 'wx', mode: 0o600 })
      } catch (error) {
        if (error?.code !== 'EEXIST') throw error
        const stored = await readFile(blobPath)
        const storedIntegrity = `sha256-${createHash('sha256').update(stored).digest('base64')}`
        if (storedIntegrity !== record.integrity) {
          throw new RoomProtocolError(409, 'account-plugin-integrity-mismatch')
        }
      }
      await mutateAccount(ctx, account.accountId, (latest) => {
        const versions = accountPluginVersions(latest)
        const conflict = versions.find((candidate) =>
          candidate.id === pluginId && candidate.version === pluginVersion)
        if (conflict && conflict.integrity !== record.integrity) {
          throw new RoomProtocolError(409, 'account-plugin-version-conflict')
        }
        if (conflict) return latest
        if (versions.length >= ACCOUNT_PLUGIN_VERSION_LIMIT) {
          throw new RoomProtocolError(409, 'account-plugin-version-limit')
        }
        const latestBytes = versions.reduce((total, candidate) => total + candidate.sizeBytes, 0)
        if (latestBytes + record.sizeBytes > ACCOUNT_PLUGIN_TOTAL_BYTES_LIMIT) {
          throw new RoomProtocolError(409, 'account-plugin-storage-limit')
        }
        return {
          ...latest,
          pluginLibrary: [...versions, record],
          updatedAt: now,
        }
      })
      if (marketplaceProduct) {
        await syncMarketplaceAccountInstallation(ctx, {
          accountId: account.accountId,
          integrity: record.integrity,
          active: true,
          timestamp: now,
        })
      }
      writeJson(res, 201, record)
      return true
    }

    if (req.method === 'GET') {
      if (!current) throw new RoomProtocolError(404, 'account-plugin-not-found')
      let bytes
      try {
        bytes = await readFile(accountPluginBlobFile(ctx, current.integrity))
      } catch (error) {
        if (error?.code === 'ENOENT') throw new RoomProtocolError(404, 'account-plugin-file-not-found')
        throw error
      }
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== current.integrity) {
        throw new RoomProtocolError(409, 'account-plugin-integrity-mismatch')
      }
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, no-store',
        'X-Stars-Plugin-Version': current.version,
        'X-Stars-Plugin-Integrity': current.integrity,
        'X-Stars-Plugin-Filename': encodeURIComponent(current.fileName),
        'X-Stars-Plugin-Name': encodeURIComponent(current.name),
        'X-Stars-Plugin-Publisher': encodeURIComponent(current.publisher),
        'X-Stars-Plugin-License': encodeURIComponent(current.license),
        'X-Stars-Plugin-State-Schema': String(current.stateSchemaVersion),
        'X-Stars-Plugin-Api-Version': String(current.apiVersion),
        'X-Stars-Plugin-Ruleset': current.rulesetId,
        'X-Stars-Plugin-Metadata': encodeURIComponent(JSON.stringify({
          manifestSchemaVersion: current.manifestSchemaVersion,
          minimumGameProtocolVersion: current.minimumGameProtocolVersion,
          dependencies: current.dependencies,
          conflicts: current.conflicts,
          declaredCapabilities: current.declaredCapabilities,
          distributionPolicy: current.distributionPolicy,
          contentCategory: current.contentCategory,
        })),
      })
      res.end(bytes)
      return true
    }

    if (req.method === 'DELETE') {
      if (!current) throw new RoomProtocolError(404, 'account-plugin-not-found')
      const usedByCharacter = (Array.isArray(account.characters) ? account.characters : []).some((character) =>
        Array.isArray(character?.compatibility?.requiredPlugins) &&
        character.compatibility.requiredPlugins.some((requirement) =>
          requirement?.id === current.id &&
          requirement?.version === current.version &&
          requirement?.integrity === current.integrity))
      if (usedByCharacter) throw new RoomProtocolError(409, 'account-plugin-in-use')
      const registry = await readPluginRegistry(ctx)
      const marketplaceProduct = registry.entries.flatMap((entry) =>
        (Array.isArray(entry.versions) ? entry.versions : []).map((version) => ({ entry, version })))
        .find(({ version }) =>
          version.integrity === current.integrity &&
          version.status === 'published')
      const usedByPublication = registry.entries.some((entry) =>
        entry.publisher?.accountId === account.accountId &&
        entry.id === current.id &&
        (Array.isArray(entry.versions) ? entry.versions : []).some((version) =>
          version.version === current.version &&
          version.integrity === current.integrity &&
          ['pending', 'published'].includes(version.status)))
      if (usedByPublication) throw new RoomProtocolError(409, 'account-plugin-in-use')
      const now = Date.now()
      await mutateAccount(ctx, account.accountId, (latest) => ({
        ...latest,
        pluginLibrary: accountPluginVersions(latest).filter((candidate) =>
          candidate.id !== pluginId || candidate.version !== pluginVersion),
        updatedAt: now,
      }))
      if (marketplaceProduct) {
        const remainingMarketplaceVersion = currentVersions
          .filter((candidate) =>
            candidate.id !== pluginId || candidate.version !== pluginVersion)
          .find((candidate) =>
            registry.entries.some((entry) =>
              entry.id === marketplaceProduct.entry.id &&
              (Array.isArray(entry.versions) ? entry.versions : []).some((version) =>
                version.integrity === candidate.integrity &&
                version.status === 'published')))
        await syncMarketplaceAccountInstallation(ctx, {
          accountId: account.accountId,
          integrity: remainingMarketplaceVersion?.integrity ?? current.integrity,
          active: Boolean(remainingMarketplaceVersion),
          timestamp: now,
        })
      }
      writeJson(res, 200, { ok: true })
      return true
    }

    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  const characterMatch = parsed.pathname.match(/^\/api\/accounts\/me\/characters\/([^/]+)$/)
  if (characterMatch) {
    const account = await authenticateAccount(req, ctx)
    const characterId = decodeURIComponent(characterMatch[1] ?? '')
    if (!characterId || characterId.length > 128) throw new RoomProtocolError(400, 'invalid-account-character')
    if (req.method === 'PUT') {
      const payload = await readJsonRequest(req, 2 * 1024 * 1024)
      const now = Date.now()
      const record = normalizedAccountCharacterRecord(payload, account.accountId, characterId, now)
      await mutateAccount(ctx, account.accountId, (current) => {
        const characters = Array.isArray(current.characters) ? current.characters : []
        const exists = characters.some((candidate) => candidate?.id === characterId)
        if (!exists && characters.length >= ACCOUNT_CHARACTER_LIMIT) {
          throw new RoomProtocolError(409, 'account-character-limit')
        }
        return {
          ...current,
          characters: [...characters.filter((candidate) => candidate?.id !== characterId), record]
            .sort((left, right) => Number(right.updatedAt ?? 0) - Number(left.updatedAt ?? 0)),
          updatedAt: now,
        }
      })
      writeJson(res, 200, record)
      return true
    }
    if (req.method === 'DELETE') {
      const currentCharacters = Array.isArray(account.characters) ? account.characters : []
      if (!currentCharacters.some((candidate) => candidate?.id === characterId)) {
        throw new RoomProtocolError(404, 'account-character-not-found')
      }
      const now = Date.now()
      await mutateAccount(ctx, account.accountId, (current) => ({
        ...current,
        characters: (Array.isArray(current.characters) ? current.characters : [])
          .filter((candidate) => candidate?.id !== characterId),
        updatedAt: now,
      }))
      writeJson(res, 200, { ok: true })
      return true
    }
    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  throw new RoomProtocolError(404, 'account-not-found')
}

async function handleRoomLobbyApi(req, res, parsed, ctx) {
  const {ROOM_EPHEMERAL_PLUGIN_MAX_BYTES,ROOM_HOST_TTL_MS,ROOM_PLAYER_SLOTS,RoomProtocolError,SHARED_PROTOCOL_VERSION,SHARED_STATE_CHANGED_CHANNEL,STATE_MAX_BYTES,activeRoomPlayers,activeRoomSpectators,applyLobbyRateLimit,assertDeclarativeRoomPluginManifest,assertMarketplacePackageEntitlement,assignRoomPlayer,assignRoomSpectator,authenticateAccount,boundedText,campaignScopedContext,createLobbyRoom,createRoomSessionToken,decodedPluginHeader,lobbyRoomMember,mutateLobbyRoom,mutateRoomPlayerCharacterAssignment,normalizeDnd5eHouseRules,normalizeLobbyRoomCode,normalizeRoomPluginRequirements,normalizedLabel,normalizedPluginState,normalizedRoomPassword,plainObject,publishEventBestEffort,readBody,readCharactersForProjection,readJsonRequest,readLobbyRoomOptional,readSharedStateFile,removeRoomEphemeralPluginStorage,roomEphemeralPluginStoragePaths,roomHostIsOnline,roomHostPresence,roomHostedPluginFile,roomLobbyFile,roomMemberAccountAuthorized,roomMemberCharacterAssignment,roomMemberResponse,roomMemberSessionAuthorized,roomPasswordMatches,roomPasswordRecord,roomPlayerPresence,roomPluginDirectory,roomPluginDistributionPolicy,roomPluginFile,roomPluginReadiness,roomPluginVersionFile,roomRulesResponse,roomSessionTokenHash,samePluginRequirement,scopedContext,validClientId,withoutRoomEphemeralPlugins,writeCampaignSnapshot,writeJson} = dependencies()

  if (!parsed.pathname.startsWith('/api/rooms')) return false
  if (!applyLobbyRateLimit(req, res, ctx)) return true

  if (parsed.pathname === '/api/rooms' && req.method === 'POST') {
    const payload = await readJsonRequest(req)
    if (payload?.campaignId != null) {
      throw new RoomProtocolError(400, 'campaign-room-launch-required')
    }
    const account = await authenticateAccount(req, ctx, !productionSecurityEnabled())
    if (payload?.accountId != null && account?.accountId !== payload.accountId) {
      throw new RoomProtocolError(401, 'invalid-account-session')
    }
    const { room, member, roomToken } = await createLobbyRoom(ctx, payload, account)
    writeJson(res, 201, roomMemberResponse(room, member, 'dm', roomToken))
    return true
  }

  const previewMatch = parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/preview$/)
  if (previewMatch) {
    if (req.method !== 'GET') throw new RoomProtocolError(405, 'method-not-allowed')
    const rawRoomId = String(previewMatch[1] ?? '').toUpperCase()
    const roomId = normalizeLobbyRoomCode(rawRoomId)
    if (roomId !== rawRoomId || roomId.length !== 6) throw new RoomProtocolError(400, 'invalid-room-code')
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      return { ok: true }
    })
    const rules = roomRulesResponse(result.room)
    writeJson(res, 200, {
      roomId: result.room.id,
      roomName: result.room.name,
      rulesetId: result.room.rulesetId,
      dmDisplayName: result.room.host?.displayName ?? 'DM',
      hostOnline: roomHostIsOnline(result.room),
      hostStatus: roomHostPresence(result.room),
      hostLastSeenAt: Number(result.room.host?.lastSeenAt ?? 0),
      hostGraceExpiresAt: Number(result.room.host?.lastSeenAt ?? 0) + ROOM_HOST_TTL_MS,
      gameProtocolVersion: SHARED_PROTOCOL_VERSION,
      locked: result.room.locked === true,
      passwordRequired: plainObject(result.room.joinSecret),
      playerCount: activeRoomPlayers(result.room).length,
      spectatorCount: activeRoomSpectators(result.room).length,
      maxPlayers: Number.isInteger(result.room.maxPlayers) ? result.room.maxPlayers : 3,
      plugins: rules.plugins,
    })
    return true
  }

  if (await handleRoomVoiceApi(req, res, parsed, ctx, { normalizeLobbyRoomCode, roomLobbyFile, lobbyRoomMember, roomMemberSessionAuthorized, roomPlayerPresence, RoomProtocolError, writeJson })) return true
  if (await handleLongCastingOwnerApi(req, res, parsed, ctx, { normalizeLobbyRoomCode, roomLobbyFile, lobbyRoomMember, roomMemberSessionAuthorized, RoomProtocolError, writeJson, readBody, scopedContext, readSharedStateFile })) return true

  const protectedRoomMatch = parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/(.+)$/)
  if (protectedRoomMatch && !['join', 'preview'].includes(protectedRoomMatch[2])) {
    const rawRoomId = String(protectedRoomMatch[1] ?? '').toUpperCase()
    const protectedRoomId = normalizeLobbyRoomCode(rawRoomId)
    if (protectedRoomId !== rawRoomId || protectedRoomId.length !== 6) {
      throw new RoomProtocolError(400, 'invalid-room-code')
    }
    let protectedRoom
    try {
      protectedRoom = JSON.parse(await readFile(roomLobbyFile(ctx, protectedRoomId), 'utf8'))
    } catch (error) {
      if (error?.code === 'ENOENT') throw new RoomProtocolError(404, 'room-not-found')
      throw error
    }
    const requestMember = lobbyRoomMember(protectedRoom, req?.headers?.['x-stars-member'])
    if (!requestMember || !roomMemberSessionAuthorized(requestMember, req?.headers?.['x-stars-room-token'])) {
      throw new RoomProtocolError(403, 'forbidden')
    }
  }

  const stagedPluginMatch = parsed.pathname.match(
    /^\/api\/rooms\/([^/]+)\/plugins\/([^/]+)\/(stage|migration-state|activate)$/,
  )
  if (stagedPluginMatch) {
    const rawRoomId = String(stagedPluginMatch[1] ?? '').toUpperCase()
    const roomId = normalizeLobbyRoomCode(rawRoomId)
    const pluginId = decodeURIComponent(stagedPluginMatch[2] ?? '')
    const operation = stagedPluginMatch[3]
    if (roomId !== rawRoomId || roomId.length !== 6) throw new RoomProtocolError(400, 'invalid-room-code')
    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(pluginId)) throw new RoomProtocolError(400, 'invalid-plugin-manifest')

    if (operation === 'migration-state') {
      if (req.method !== 'GET') throw new RoomProtocolError(405, 'method-not-allowed')
      const memberId = req?.headers?.['x-stars-member']
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        const active = (Array.isArray(room.requiredPlugins) ? room.requiredPlugins : [])
          .find((plugin) => plugin.id === pluginId)
        const stored = room.pluginRuntimeState?.[pluginId]
        const stateSchemaVersion = Number.isInteger(stored?.stateSchemaVersion)
          ? stored.stateSchemaVersion
          : (active?.stateSchemaVersion ?? 1)
        return {
          ok: true,
          active,
          hasState: !!stored || !!active,
          runtime: {
            stateSchemaVersion,
            data: stored?.data == null ? {} : normalizedPluginState(stored.data),
          },
        }
      })
      writeJson(res, 200, {
        installed: !!result.active,
        hasState: result.hasState,
        rulesRevision: Number.isFinite(result.room.rulesRevision) ? result.room.rulesRevision : 1,
        ...(result.active ? { active: result.active } : {}),
        stateSchemaVersion: result.runtime.stateSchemaVersion,
        data: result.runtime.data,
      })
      return true
    }

    if (operation === 'stage') {
      if (req.method !== 'PUT') throw new RoomProtocolError(405, 'method-not-allowed')
      const memberId = req?.headers?.['x-stars-member']
      const version = typeof req?.headers?.['x-stars-plugin-version'] === 'string'
        ? req.headers['x-stars-plugin-version'].trim()
        : ''
      const expectedIntegrity = typeof req?.headers?.['x-stars-plugin-integrity'] === 'string'
        ? req.headers['x-stars-plugin-integrity'].trim()
        : ''
      const stateSchemaVersion = Number(req?.headers?.['x-stars-plugin-state-schema'])
      const encodedFileName = typeof req?.headers?.['x-stars-plugin-filename'] === 'string'
        ? req.headers['x-stars-plugin-filename']
        : ''
      const pluginName = decodedPluginHeader(req, 'x-stars-plugin-name', 100)
      const publisher = decodedPluginHeader(req, 'x-stars-plugin-publisher', 100)
      const license = decodedPluginHeader(req, 'x-stars-plugin-license', 120)
      const distributionPolicy = roomPluginDistributionPolicy(req)
      if (!pluginName || !publisher || !license) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      let fileName = `${pluginId}.dndstars5e`
      try {
        const decoded = decodeURIComponent(encodedFileName)
        if (decoded && decoded.length <= 180 && !/[\\/\0]/.test(decoded)) fileName = decoded
      } catch {
        throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      }
      const requirement = normalizeRoomPluginRequirements([{
        id: pluginId,
        version,
        integrity: expectedIntegrity,
        stateSchemaVersion,
      }])?.[0]
      if (!requirement) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      const authorizedStageRoom = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        return { ok: true }
      })
      const bytes = await readBody(
        req,
        distributionPolicy === 'room-ephemeral' ? ROOM_EPHEMERAL_PLUGIN_MAX_BYTES : STATE_MAX_BYTES,
      )
      if (bytes.length < 1) throw new RoomProtocolError(400, 'plugin-file-empty')
      assertDeclarativeRoomPluginManifest(bytes, pluginId, version, distributionPolicy)
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== requirement.integrity) throw new RoomProtocolError(409, 'plugin-integrity-mismatch')
      await assertMarketplacePackageEntitlement(
        ctx,
        authorizedStageRoom.room.host?.accountId,
        requirement.integrity,
      )
      await mkdir(roomPluginDirectory(ctx, roomId), { recursive: true })
      const storagePath = roomPluginVersionFile(ctx, roomId, pluginId, requirement.integrity)
      await withWriteLock(storagePath, () => atomicRename(storagePath, bytes))
      const now = Date.now()
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        return {
          ok: true,
          member: room.host,
          next: {
            ...room,
            stagedPluginFiles: {
              ...(room.stagedPluginFiles ?? {}),
              [pluginId]: {
                ...requirement,
                name: pluginName,
                publisher,
                license,
                distributionPolicy,
                fileName,
                storageFile: path.basename(storagePath),
                size: bytes.length,
                uploadedAt: now,
              },
            },
            updatedAt: now,
          },
        }
      })
      writeJson(res, 200, roomRulesResponse(result.room, result.member))
      return true
    }

    if (operation === 'activate') {
      if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
      const payload = await readJsonRequest(req)
      const memberId = payload?.memberId
      const expectedRulesRevision = Number(payload?.expectedRulesRevision)
      const stateSchemaVersion = Number(payload?.stateSchemaVersion)
      const stagedVersion = typeof payload?.stagedVersion === 'string' ? payload.stagedVersion : ''
      const stagedIntegrity = typeof payload?.stagedIntegrity === 'string' ? payload.stagedIntegrity : ''
      const expectedActive = payload?.expectedActive == null
        ? null
        : normalizeRoomPluginRequirements([payload.expectedActive])?.[0]
      if (
        !Number.isInteger(expectedRulesRevision) || !Number.isInteger(stateSchemaVersion) ||
        payload?.expectedActive != null && !expectedActive
      ) throw new RoomProtocolError(400, 'invalid-plugin-activation')
      const data = normalizedPluginState(payload?.data)
      await writeCampaignSnapshot(scopedContext(ctx, roomId), 'pre-plugin-change')
      const now = Date.now()
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        const currentRevision = Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1
        if (currentRevision !== expectedRulesRevision) {
          return { ok: false, status: 409, error: 'rules-revision-conflict' }
        }
        const current = (Array.isArray(room.requiredPlugins) ? room.requiredPlugins : [])
          .find((plugin) => plugin.id === pluginId) ?? null
        if (!samePluginRequirement(current, expectedActive)) {
          return { ok: false, status: 409, error: 'plugin-version-conflict' }
        }
        const staged = room.stagedPluginFiles?.[pluginId]
        if (!staged || staged.version !== stagedVersion || staged.integrity !== stagedIntegrity) {
          return { ok: false, status: 409, error: 'staged-plugin-conflict' }
        }
        if ((staged.stateSchemaVersion ?? 1) !== stateSchemaVersion) {
          return { ok: false, status: 409, error: 'plugin-state-schema-mismatch' }
        }
        const previousState = room.pluginRuntimeState?.[pluginId]
        const previousSchema = Number.isInteger(previousState?.stateSchemaVersion)
          ? previousState.stateSchemaVersion
          : (current?.stateSchemaVersion ?? 1)
        if (stateSchemaVersion < previousSchema) {
          return { ok: false, status: 409, error: 'plugin-state-downgrade' }
        }
        const stagedPluginFiles = { ...(room.stagedPluginFiles ?? {}) }
        delete stagedPluginFiles[pluginId]
        const requiredPlugins = [
          ...(Array.isArray(room.requiredPlugins) ? room.requiredPlugins : []).filter((plugin) => plugin.id !== pluginId),
          {
            id: staged.id,
            version: staged.version,
            integrity: staged.integrity,
            stateSchemaVersion: staged.stateSchemaVersion ?? 1,
          },
        ].sort((left, right) => left.id.localeCompare(right.id))
        return {
          ok: true,
          member: room.host,
          next: {
            ...room,
            requiredPlugins,
            pluginFiles: { ...(room.pluginFiles ?? {}), [pluginId]: staged },
            stagedPluginFiles,
            pluginRuntimeState: {
              ...(room.pluginRuntimeState ?? {}),
              [pluginId]: {
                pluginVersion: staged.version,
                stateSchemaVersion,
                data,
                updatedAt: now,
              },
            },
            rulesRevision: currentRevision + 1,
            rulesUpdatedAt: now,
            updatedAt: now,
          },
        }
      })
      publishEventBestEffort(scopedContext(ctx, roomId), SHARED_STATE_CHANGED_CHANNEL, {
        id: `room-rules:plugin-activate:${pluginId}:${now}`,
        name: 'room-rules',
        updatedAt: now,
      })
      writeJson(res, 200, roomRulesResponse(result.room, result.member))
      return true
    }
  }

  const pluginMatch = parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/plugins\/([^/]+)$/)
  if (pluginMatch) {
    const rawRoomId = String(pluginMatch[1] ?? '').toUpperCase()
    const roomId = normalizeLobbyRoomCode(rawRoomId)
    const pluginId = decodeURIComponent(pluginMatch[2] ?? '')
    if (roomId !== rawRoomId || roomId.length !== 6) throw new RoomProtocolError(400, 'invalid-room-code')
    if (!/^[a-z0-9][a-z0-9._-]{0,99}$/.test(pluginId)) throw new RoomProtocolError(400, 'invalid-plugin-manifest')

    if (req.method === 'GET') {
      const memberId = req?.headers?.['x-stars-member']
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        const member = lobbyRoomMember(room, memberId)
        if (!member) return { ok: false, status: 403, error: 'forbidden' }
        if (member !== room.host && !roomHostIsOnline(room)) {
          return { ok: false, status: 409, error: 'room-offline' }
        }
        const requirement = (Array.isArray(room.requiredPlugins) ? room.requiredPlugins : [])
          .find((plugin) => plugin.id === pluginId)
        const hosted = room.pluginFiles?.[pluginId]
        if (!requirement || !hosted || hosted.integrity !== requirement.integrity || hosted.version !== requirement.version) {
          return { ok: false, status: 404, error: 'plugin-file-not-found' }
        }
        return { ok: true, member, requirement, hosted }
      })
      let bytes
      try {
        bytes = await readFile(roomHostedPluginFile(ctx, roomId, pluginId, result.hosted))
      } catch (error) {
        if (error?.code === 'ENOENT') throw new RoomProtocolError(404, 'plugin-file-not-found')
        throw error
      }
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== result.requirement.integrity) {
        throw new RoomProtocolError(409, 'plugin-integrity-mismatch')
      }
      res.writeHead(200, {
        'Content-Type': 'text/javascript; charset=utf-8',
        'Content-Length': String(bytes.length),
        'Cache-Control': 'private, no-store',
        'X-Stars-Plugin-Version': result.requirement.version,
        'X-Stars-Plugin-Integrity': result.requirement.integrity,
        'X-Stars-Plugin-State-Schema': String(result.requirement.stateSchemaVersion ?? 1),
        'X-Stars-Plugin-Filename': encodeURIComponent(result.hosted.fileName ?? `${pluginId}.dndstars5e`),
        'X-Stars-Plugin-Name': encodeURIComponent(result.hosted.name ?? pluginId),
        'X-Stars-Plugin-Publisher': encodeURIComponent(result.hosted.publisher ?? '未知发布者'),
        'X-Stars-Plugin-License': encodeURIComponent(result.hosted.license ?? '未声明'),
        'X-Stars-Plugin-Distribution-Policy': result.hosted.distributionPolicy ?? 'room-distributable',
      })
      res.end(bytes)
      return true
    }

    if (req.method === 'PUT') {
      const memberId = req?.headers?.['x-stars-member']
      const version = typeof req?.headers?.['x-stars-plugin-version'] === 'string'
        ? req.headers['x-stars-plugin-version'].trim()
        : ''
      const expectedIntegrity = typeof req?.headers?.['x-stars-plugin-integrity'] === 'string'
        ? req.headers['x-stars-plugin-integrity'].trim()
        : ''
      const encodedFileName = typeof req?.headers?.['x-stars-plugin-filename'] === 'string'
        ? req.headers['x-stars-plugin-filename']
        : ''
      const pluginName = decodedPluginHeader(req, 'x-stars-plugin-name', 100)
      const publisher = decodedPluginHeader(req, 'x-stars-plugin-publisher', 100)
      const license = decodedPluginHeader(req, 'x-stars-plugin-license', 120)
      const distributionPolicy = roomPluginDistributionPolicy(req)
      if (!pluginName || !publisher || !license) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      let fileName = `${pluginId}.dndstars5e`
      try {
        const decoded = decodeURIComponent(encodedFileName)
        if (decoded && decoded.length <= 180 && !/[\\/\0]/.test(decoded)) fileName = decoded
      } catch {
        throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      }
      const requirement = normalizeRoomPluginRequirements([{
        id: pluginId,
        version,
        integrity: expectedIntegrity,
        stateSchemaVersion: Number(req?.headers?.['x-stars-plugin-state-schema'] ?? 1),
      }])?.[0]
      if (!requirement) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
      const authorizedLegacyRoom = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        return { ok: true, member: room.host }
      })
      const bytes = await readBody(
        req,
        distributionPolicy === 'room-ephemeral' ? ROOM_EPHEMERAL_PLUGIN_MAX_BYTES : STATE_MAX_BYTES,
      )
      if (bytes.length < 1) throw new RoomProtocolError(400, 'plugin-file-empty')
      assertDeclarativeRoomPluginManifest(bytes, pluginId, version, distributionPolicy)
      const actualIntegrity = `sha256-${createHash('sha256').update(bytes).digest('base64')}`
      if (actualIntegrity !== requirement.integrity) throw new RoomProtocolError(409, 'plugin-integrity-mismatch')
      await assertMarketplacePackageEntitlement(
        ctx,
        authorizedLegacyRoom.room.host?.accountId,
        requirement.integrity,
      )
      await writeCampaignSnapshot(scopedContext(ctx, roomId), 'pre-plugin-change')
      await mkdir(roomPluginDirectory(ctx, roomId), { recursive: true })
      await withWriteLock(roomPluginFile(ctx, roomId, pluginId), () =>
        atomicRename(roomPluginFile(ctx, roomId, pluginId), bytes))
      const now = Date.now()
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        const requiredPlugins = [
          ...(Array.isArray(room.requiredPlugins) ? room.requiredPlugins : []).filter((plugin) => plugin.id !== pluginId),
          requirement,
        ].sort((left, right) => left.id.localeCompare(right.id))
        return {
          ok: true,
          member: room.host,
          next: {
            ...room,
            requiredPlugins,
            pluginFiles: {
              ...(room.pluginFiles ?? {}),
              [pluginId]: {
                ...requirement,
                name: pluginName,
                publisher,
                license,
                distributionPolicy,
                fileName,
                size: bytes.length,
                uploadedAt: now,
              },
            },
            rulesRevision: (Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1) + 1,
            rulesUpdatedAt: now,
            updatedAt: now,
          },
        }
      })
      publishEventBestEffort(scopedContext(ctx, roomId), SHARED_STATE_CHANGED_CHANNEL, {
        id: `room-rules:plugin-install:${pluginId}:${now}`,
        name: 'room-rules',
        updatedAt: now,
      })
      writeJson(res, 200, roomRulesResponse(result.room, result.member))
      return true
    }

    if (req.method === 'DELETE') {
      const memberId = req?.headers?.['x-stars-member']
      await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        return { ok: true }
      })
      await writeCampaignSnapshot(scopedContext(ctx, roomId), 'pre-plugin-change')
      const now = Date.now()
      const result = await mutateLobbyRoom(ctx, roomId, (room) => {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
        const ephemeralStoragePaths = roomEphemeralPluginStoragePaths(ctx, roomId, room, pluginId)
        const pluginFiles = { ...(room.pluginFiles ?? {}) }
        delete pluginFiles[pluginId]
        const stagedPluginFiles = { ...(room.stagedPluginFiles ?? {}) }
        delete stagedPluginFiles[pluginId]
        const pluginRuntimeState = { ...(room.pluginRuntimeState ?? {}) }
        delete pluginRuntimeState[pluginId]
        return {
          ok: true,
          member: room.host,
          ephemeralStoragePaths,
          next: {
            ...room,
            requiredPlugins: (Array.isArray(room.requiredPlugins) ? room.requiredPlugins : [])
              .filter((plugin) => plugin.id !== pluginId),
            pluginFiles,
            stagedPluginFiles,
            pluginRuntimeState,
            rulesRevision: (Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1) + 1,
            rulesUpdatedAt: now,
            updatedAt: now,
          },
        }
      })
      await removeRoomEphemeralPluginStorage(result.ephemeralStoragePaths ?? [])
      publishEventBestEffort(scopedContext(ctx, roomId), SHARED_STATE_CHANGED_CHANNEL, {
        id: `room-rules:plugin-remove:${pluginId}:${now}`,
        name: 'room-rules',
        updatedAt: now,
      })
      writeJson(res, 200, roomRulesResponse(result.room, result.member))
      return true
    }
    throw new RoomProtocolError(405, 'method-not-allowed')
  }

  const adminMatch = parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/admin$/)
  if (adminMatch) {
    if (req.method !== 'PATCH') throw new RoomProtocolError(405, 'method-not-allowed')
    const rawRoomId = String(adminMatch[1] ?? '').toUpperCase()
    const roomId = normalizeLobbyRoomCode(rawRoomId)
    if (roomId !== rawRoomId || roomId.length !== 6) throw new RoomProtocolError(400, 'invalid-room-code')
    const payload = await readJsonRequest(req)
    const memberId = payload?.memberId
    const operation = payload?.operation
    const account = await authenticateAccount(req, ctx, true)
    // Account-campaign rooms keep their shared character/map state under the
    // campaign storage scope, while the lobby itself remains keyed by its
    // six-character room code.  Looking up a character assignment in the
    // lobby scope therefore consulted a stale/empty copy and rejected cards
    // that the DM UI had just made available.
    const assignmentRoom = operation === 'assign-character'
      ? await readLobbyRoomOptional(ctx, roomId)
      : null
    const assignmentStateContext = assignmentRoom?.campaignId
      ? campaignScopedContext(
          ctx,
          roomId,
          assignmentRoom.campaignId,
          assignmentRoom.campaignOwnerAccountId,
        )
      : scopedContext(ctx, roomId)
    let assignmentCharacter = null
    if (operation === 'assign-character' && payload?.characterId != null) {
      const characterId = boundedText(payload.characterId, 128)
      if (!characterId) throw new RoomProtocolError(400, 'invalid-character-assignment')
      const characterState = await readCharactersForProjection(assignmentStateContext)
      if (characterState.corrupted) throw new RoomProtocolError(409, 'characters-unavailable')
      assignmentCharacter = (Array.isArray(characterState.value?.characters) ? characterState.value.characters : [])
        .find((character) => character?.id === characterId)
      if (
        !assignmentCharacter ||
        assignmentCharacter.visibleToPlayers === false ||
        assignmentCharacter.roomMemberId !== payload?.targetMemberId
      ) {
        throw new RoomProtocolError(409, 'character-assignment-conflict')
      }
    }
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      if (room.host?.memberId !== memberId || !roomMemberAccountAuthorized(room.host, account)) {
        return { ok: false, status: 403, error: 'forbidden' }
      }
      const now = Date.now()
      const players = Array.isArray(room.players) ? room.players : []
      const activePlayers = activeRoomPlayers(room, now)
      if (operation === 'set-lock') {
        return { ok: true, member: room.host, role: 'dm', next: { ...room, locked: payload.locked === true, updatedAt: now } }
      }
      if (operation === 'set-capacity') {
        const maxPlayers = Number(payload.maxPlayers)
        if (!Number.isInteger(maxPlayers) || maxPlayers < activePlayers.length || maxPlayers > ROOM_PLAYER_SLOTS.length) {
          return { ok: false, status: 400, error: 'invalid-room-capacity' }
        }
        return { ok: true, member: room.host, role: 'dm', next: { ...room, maxPlayers, updatedAt: now } }
      }
      if (operation === 'set-password') {
        const password = normalizedRoomPassword(payload.password)
        if (password.length > 64) return { ok: false, status: 400, error: 'invalid-room-password' }
        return {
          ok: true,
          member: room.host,
          role: 'dm',
          next: { ...room, joinSecret: roomPasswordRecord(password), updatedAt: now },
        }
      }
      if (operation === 'kick') {
        const target = players.find((player) => player.memberId === payload.targetMemberId && !player.removedAt)
        if (!target) return { ok: false, status: 404, error: 'member-not-found' }
        return {
          ok: true,
          member: room.host,
          role: 'dm',
          next: {
            ...room,
            players: players.map((player) => player.memberId === target.memberId
              ? { ...player, lastSeenAt: 0, removedAt: now }
              : player),
            updatedAt: now,
          },
        }
      }
      if (operation === 'restore-member') {
        const target = players.find((player) => player.memberId === payload.targetMemberId && player.removedAt)
        if (!target) return { ok: false, status: 404, error: 'member-not-found' }
        const restored = { ...target, lastSeenAt: 0, leftAt: now }
        delete restored.removedAt
        return {
          ok: true,
          member: room.host,
          role: 'dm',
          next: {
            ...room,
            players: players.map((player) => player.memberId === target.memberId ? restored : player),
            updatedAt: now,
          },
        }
      }
      if (operation === 'assign-character') {
        return mutateRoomPlayerCharacterAssignment(room, {
          targetMemberId: payload.targetMemberId,
          characterId: assignmentCharacter?.id ?? null,
          characterName: assignmentCharacter?.name ?? null,
        }, now)
      }
      if (operation === 'transfer-dm') {
        const target = activePlayers.find((player) => player.memberId === payload.targetMemberId)
        if (!target) return { ok: false, status: 404, error: 'member-not-found' }
        if (!roomPluginReadiness(room.requiredPlugins, target.activePlugins).ready) {
          return { ok: false, status: 409, error: 'target-plugins-not-ready' }
        }
        const nextHost = { ...target, lastSeenAt: now }
        delete nextHost.slot
        delete nextHost.role
        const previousHostAsPlayer = {
          ...room.host,
          role: 'player',
          slot: target.slot,
          joinedAt: room.host.joinedAt ?? room.createdAt,
          lastSeenAt: now,
        }
        return {
          ok: true,
          member: previousHostAsPlayer,
          role: 'player',
          next: {
            ...room,
            host: nextHost,
            players: [...players.filter((player) => player.memberId !== target.memberId), previousHostAsPlayer],
            authorityRevision: Number(room.authorityRevision ?? 1) + 1,
            updatedAt: now,
          },
        }
      }
      return { ok: false, status: 400, error: 'invalid-room-operation' }
    })
    if (operation === 'assign-character') {
      publishEventBestEffort(assignmentStateContext, SHARED_STATE_CHANGED_CHANNEL, {
        id: `room-character-assignment:${payload?.targetMemberId}:${result.room.updatedAt}`,
        name: 'room-character-assignment',
        updatedAt: result.room.updatedAt,
      })
    }
    writeJson(res, 200, roomMemberResponse(result.room, result.member, result.role))
    return true
  }

  const match = parsed.pathname.match(/^\/api\/rooms\/([^/]+)\/(join|heartbeat|leave|close|roster|rules)$/)
  if (!match) throw new RoomProtocolError(404, 'room-not-found')
  const rawRoomId = String(match[1] ?? '').toUpperCase()
  const roomId = normalizeLobbyRoomCode(rawRoomId)
  if (roomId !== rawRoomId || roomId.length !== 6) throw new RoomProtocolError(400, 'invalid-room-code')
  if (match[2] === 'rules') {
    if (req.method !== 'GET' && req.method !== 'PUT') throw new RoomProtocolError(405, 'method-not-allowed')
    const payload = req.method === 'PUT' ? await readJsonRequest(req) : null
    const memberId = req.method === 'GET' ? req?.headers?.['x-stars-member'] : payload?.memberId
    const account = await authenticateAccount(req, ctx, true)
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      const member = lobbyRoomMember(room, memberId)
      if (!member || !roomMemberAccountAuthorized(member, account)) return { ok: false, status: 403, error: 'forbidden' }
      if (req.method === 'GET') return { ok: true, member }
      if (room.host?.memberId !== memberId) return { ok: false, status: 403, error: 'forbidden' }
      const requiredPlugins = normalizeRoomPluginRequirements(payload?.requiredPlugins)
      if (!requiredPlugins) return { ok: false, status: 400, error: 'invalid-plugin-manifest' }
      const houseRules = payload?.houseRules == null
        ? normalizeDnd5eHouseRules(room.dnd5eHouseRules)
        : normalizeDnd5eHouseRules(payload.houseRules)
      const hosted = room.pluginFiles ?? {}
      if (requiredPlugins.some((plugin) =>
        hosted[plugin.id]?.version !== plugin.version || hosted[plugin.id]?.integrity !== plugin.integrity)) {
        return { ok: false, status: 409, error: 'plugin-file-missing' }
      }
      const now = Date.now()
      const host = { ...room.host, activePlugins: requiredPlugins, lastSeenAt: now }
      return {
        ok: true,
        member: host,
        next: {
          ...room,
          host,
          requiredPlugins,
          dnd5eHouseRules: houseRules,
          rulesRevision: (Number.isFinite(room.rulesRevision) ? room.rulesRevision : 1) + 1,
          rulesUpdatedAt: now,
          updatedAt: now,
        },
      }
    })
    if (req.method === 'PUT') publishEventBestEffort(scopedContext(ctx, roomId), SHARED_STATE_CHANGED_CHANNEL, {
      id: `room-rules:update:${result.room.rulesRevision}:${result.room.rulesUpdatedAt}`,
      name: 'room-rules',
      updatedAt: result.room.rulesUpdatedAt,
    })
    writeJson(res, 200, roomRulesResponse(result.room, result.member))
    return true
  }
  if (match[2] === 'roster') {
    if (req.method !== 'GET') throw new RoomProtocolError(405, 'method-not-allowed')
    const memberId = req?.headers?.['x-stars-member']
    const account = await authenticateAccount(req, ctx, true)
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      if (
        typeof memberId !== 'string' || room.host?.memberId !== memberId ||
        !roomMemberAccountAuthorized(room.host, account)
      ) {
        return { ok: false, status: 403, error: 'forbidden' }
      }
      return { ok: true }
    })
    const now = Date.now()
    writeJson(res, 200, {
      roomId: result.room.id,
      locked: result.room.locked === true,
      passwordRequired: plainObject(result.room.joinSecret),
      maxPlayers: Number.isInteger(result.room.maxPlayers) ? result.room.maxPlayers : 3,
      players: (Array.isArray(result.room.players) ? result.room.players : []).map((player) => ({
        memberId: player.memberId,
        accountId: player.accountId,
        displayName: player.displayName,
        role: player.role === 'spectator' ? 'spectator' : 'player',
        slot: player.slot,
        joinedAt: player.joinedAt,
        lastSeenAt: player.lastSeenAt,
        status: roomPlayerPresence(player, now),
        online: roomPlayerPresence(player, now) === 'online',
        activeCharacterId: normalizedLabel(player.activeCharacterId, 128) || null,
        activeCharacterName: normalizedLabel(player.activeCharacterName, 80) || null,
        characterAssignment: roomMemberCharacterAssignment(player),
        ...roomPluginReadiness(result.room.requiredPlugins, player.activePlugins),
      })),
    })
    return true
  }

  if (req.method !== 'POST') throw new RoomProtocolError(405, 'method-not-allowed')
  const payload = await readJsonRequest(req)

  if (match[2] === 'join') {
    const displayName = normalizedLabel(payload?.displayName, 24)
    const clientId = payload?.clientId
    const resumeMemberId = payload?.resumeMemberId
    const activePlugins = normalizeRoomPluginRequirements(payload?.activePlugins ?? [])
    const requestedRole = payload?.role === 'spectator' ? 'spectator' : 'player'
    const account = await authenticateAccount(req, ctx, !productionSecurityEnabled())
    const roomToken = createRoomSessionToken()
    const roomTokenHash = roomSessionTokenHash(roomToken)
    if (!displayName) throw new RoomProtocolError(400, 'invalid-display-name')
    if (!validClientId(clientId)) throw new RoomProtocolError(400, 'invalid-client')
    if (resumeMemberId != null && (typeof resumeMemberId !== 'string' || resumeMemberId.length < 8 || resumeMemberId.length > 128)) {
      throw new RoomProtocolError(400, 'invalid-resume-member')
    }
    if (!activePlugins) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (account && room.host?.accountId === account.accountId) {
        if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
        const now = Date.now()
        const member = {
          ...room.host,
          clientId,
          displayName,
          activePlugins,
          lastSeenAt: now,
          leftAt: undefined,
          roomTokenHash,
        }
        return { ok: true, member, role: 'dm', next: { ...room, host: member, updatedAt: now } }
      }
      if (!roomPasswordMatches(room, payload?.password)) return { ok: false, status: 403, error: 'invalid-room-password' }
      const assign = requestedRole === 'spectator' ? assignRoomSpectator : assignRoomPlayer
      return assign(room, {
        clientId,
        displayName,
        memberId: resumeMemberId ?? randomUUID(),
        accountId: account?.accountId,
        activePlugins,
        roomTokenHash,
      })
    })
    writeJson(res, 200, roomMemberResponse(result.room, result.member, result.role ?? requestedRole, roomToken))
    return true
  }

  const memberId = payload?.memberId
  if (typeof memberId !== 'string' || memberId.length < 8) throw new RoomProtocolError(400, 'member-not-found')
  const account = await authenticateAccount(req, ctx, true)

  if (match[2] === 'heartbeat') {
    const now = Date.now()
    const activePlugins = normalizeRoomPluginRequirements(payload?.activePlugins ?? [])
    if (!activePlugins) throw new RoomProtocolError(400, 'invalid-plugin-manifest')
    const characterPresenceProvided = Object.prototype.hasOwnProperty.call(payload ?? {}, 'activeCharacterId') ||
      Object.prototype.hasOwnProperty.call(payload ?? {}, 'activeCharacterName')
    const presencePatch = (member) => {
      const assignment = roomMemberCharacterAssignment(member)
      if (assignment.enforced) {
        return {
          activeCharacterId: assignment.characterId,
          activeCharacterName: assignment.characterName,
        }
      }
      return characterPresenceProvided
        ? {
            activeCharacterId: normalizedLabel(payload?.activeCharacterId, 128) || null,
            activeCharacterName: normalizedLabel(payload?.activeCharacterName, 80) || null,
          }
        : {
            activeCharacterId: member?.activeCharacterId ?? null,
            activeCharacterName: member?.activeCharacterName ?? null,
          }
    }
    const result = await mutateLobbyRoom(ctx, roomId, (room) => {
      if (room.closedAt) return { ok: false, status: 409, error: 'room-closed' }
      if (room.host?.memberId === memberId) {
        if (!roomMemberAccountAuthorized(room.host, account)) return { ok: false, status: 403, error: 'forbidden' }
        const member = {
          ...room.host,
          activePlugins,
          lastSeenAt: now,
          leftAt: undefined,
          ...presencePatch(room.host),
        }
        return { ok: true, member, role: 'dm', next: { ...room, host: member, updatedAt: now } }
      }
      if (!roomHostIsOnline(room, now)) return { ok: false, status: 409, error: 'room-offline' }
      const players = Array.isArray(room.players) ? room.players : []
      const member = players.find((player) => player.memberId === memberId)
      if (!member) return { ok: false, status: 404, error: 'member-not-found' }
      if (!roomMemberAccountAuthorized(member, account)) return { ok: false, status: 403, error: 'forbidden' }
      if (roomPlayerPresence(member, now) === 'removed') return { ok: false, status: 403, error: 'member-removed' }
      const memberRole = member.role === 'spectator' ? 'spectator' : 'player'
      const assign = memberRole === 'spectator' ? assignRoomSpectator : assignRoomPlayer
      const resumed = assign(room, {
        memberId: member.memberId,
        accountId: member.accountId,
        clientId: member.clientId,
        displayName: member.displayName,
        activePlugins,
      }, now)
      if (!resumed.ok) return resumed
      const refreshed = {
        ...resumed.member,
        ...presencePatch(member),
      }
      return {
        ok: true,
        member: refreshed,
        role: memberRole,
        next: {
          ...resumed.next,
          players: resumed.next.players.map((player) => player.memberId === refreshed.memberId ? refreshed : player),
        },
      }
    })
    writeJson(res, 200, roomMemberResponse(result.room, result.member, result.role))
    return true
  }

  const leavingClosesRoom = match[2] === 'close'
  const leaveResult = await mutateLobbyRoom(ctx, roomId, (room) => {
    const now = Date.now()
    if (room.host?.memberId === memberId) {
      if (!roomMemberAccountAuthorized(room.host, account)) return { ok: false, status: 403, error: 'forbidden' }
      if (!leavingClosesRoom) {
        return {
          ok: true,
          next: {
            ...room,
            updatedAt: now,
            host: { ...room.host, lastSeenAt: 0, leftAt: now },
          },
        }
      }
      const ephemeralStoragePaths = roomEphemeralPluginStoragePaths(ctx, roomId, room)
      const withoutEphemeral = withoutRoomEphemeralPlugins(room)
      return {
        ok: true,
        ephemeralStoragePaths,
        next: {
          ...withoutEphemeral,
          closedAt: now,
          updatedAt: now,
          host: { ...room.host, lastSeenAt: 0 },
        },
      }
    }
    if (leavingClosesRoom) return { ok: false, status: 403, error: 'forbidden' }
    const players = Array.isArray(room.players) ? room.players : []
    if (!players.some((player) => player.memberId === memberId)) {
      return { ok: false, status: 404, error: 'member-not-found' }
    }
    const leaving = players.find((player) => player.memberId === memberId)
    if (!roomMemberAccountAuthorized(leaving, account)) return { ok: false, status: 403, error: 'forbidden' }
    return {
      ok: true,
      // 离开只结束当前在线状态，保留房间成员身份供同一浏览器恢复角色归属。
      // DM“踢出”仍会彻底删除成员记录，因此不会绕过锁房或踢人操作。
      next: {
        ...room,
        players: players.map((player) => player.memberId === memberId
          ? { ...player, lastSeenAt: 0, leftAt: now }
          : player),
        updatedAt: now,
      },
    }
  })
  await removeRoomEphemeralPluginStorage(leaveResult.ephemeralStoragePaths ?? [])
  writeJson(res, 200, { ok: true })
  return true
}
return {handleAccountApi,handleRoomLobbyApi}
}
