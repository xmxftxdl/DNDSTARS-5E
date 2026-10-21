import { expect, it } from 'vitest'
import { pdfImportAttemptOrder } from './pdfImportAttemptOrder'

it('runs all pending jobs before retrying failures and skips newly successful results', () => {
  const jobs = [{ id: 'saved', done: true }, { id: 'a', done: false }, { id: 'b', done: false }, { id: 'c', done: false }]
  const calls: string[] = []
  for (const job of pdfImportAttemptOrder(jobs, 3, job => !job.done)) {
    calls.push(job.id)
    if (job.id === 'b' || (job.id === 'a' && calls.filter(id => id === 'a').length === 2)) job.done = true
  }
  expect(calls).toEqual(['a', 'b', 'c', 'a', 'c', 'c'])
})

it('does no eager work after cancellation; a resumed pass sees the persisted successes', () => {
  const jobs = [{ id: 'a', done: false }, { id: 'b', done: false }]
  const calls: string[] = []
  for (const job of pdfImportAttemptOrder(jobs, 3, job => !job.done)) {
    job.done = true
    calls.push(job.id)
    break
  }
  expect(calls).toEqual(['a'])
  for (const job of pdfImportAttemptOrder(jobs, 1, job => !job.done)) {
    calls.push(job.id)
    job.done = true
  }
  expect(calls).toEqual(['a', 'b'])
  expect([...pdfImportAttemptOrder(jobs, 3, job => !job.done)]).toEqual([])
  expect(() => [...pdfImportAttemptOrder(jobs, Infinity, () => true)]).toThrow('invalid-pdf-import-pass-count')
})
