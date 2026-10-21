import {it,expect,vi,afterEach} from 'vitest'
import {createCampaignTimeReconciliationRetry} from './campaignTimeReconciliationRetry'
afterEach(()=>vi.useRealTimers())
it('retries without a store update and coalesces concurrent conflicts',()=>{
 vi.useFakeTimers();const retry=createCampaignTimeReconciliationRetry(),run=vi.fn()
 retry.schedule(run);retry.schedule(run)
 vi.advanceTimersByTime(499);expect(run).not.toHaveBeenCalled()
 vi.advanceTimersByTime(1);expect(run).toHaveBeenCalledTimes(1)
 retry.schedule(run);vi.advanceTimersByTime(500);expect(run).toHaveBeenCalledTimes(2)
})
it('cancels stale-room and unmounted work while permitting a later room',()=>{
 vi.useFakeTimers();const retry=createCampaignTimeReconciliationRetry(),old=vi.fn(),next=vi.fn()
 retry.schedule(old);retry.cancel();retry.schedule(next)
 vi.advanceTimersByTime(500);expect(old).not.toHaveBeenCalled();expect(next).toHaveBeenCalledTimes(1)
 retry.cancel();expect(vi.getTimerCount()).toBe(0)
})
