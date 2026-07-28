import { createHash } from 'node:crypto'
import { createReadStream } from 'node:fs'
import { copyFile, mkdir, readdir, rename, rm, stat, writeFile } from 'node:fs/promises'
import { spawnSync } from 'node:child_process'
import path from 'node:path'

const root = process.cwd()
const assetRoots = process.argv.slice(2)
const requestedRoots = assetRoots.length > 0
  ? assetRoots
  : ['public/assets/icons', 'public/assets/portraits']

function runGit(args, input) {
  const result = spawnSync('git', args, {
    cwd: root,
    encoding: 'utf8',
    input,
    maxBuffer: 64 * 1024 * 1024,
  })
  if (result.status !== 0) {
    throw new Error(result.stderr || result.stdout || `git ${args.join(' ')} failed`)
  }
  return result.stdout.trim()
}

async function walk(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const files = []
  for (const entry of entries) {
    const absolute = path.join(directory, entry.name)
    if (entry.isDirectory()) files.push(...await walk(absolute))
    else if (entry.isFile() && entry.name.toLowerCase().endsWith('.png')) files.push(absolute)
  }
  return files
}

function sha256File(filename) {
  return new Promise((resolve, reject) => {
    const hash = createHash('sha256')
    const stream = createReadStream(filename)
    stream.on('error', reject)
    stream.on('data', (chunk) => hash.update(chunk))
    stream.on('end', () => resolve(hash.digest('hex')))
  })
}

async function mapWithConcurrency(values, concurrency, worker) {
  const results = new Array(values.length)
  let cursor = 0
  await Promise.all(Array.from({ length: Math.min(concurrency, values.length) }, async () => {
    for (;;) {
      const index = cursor
      cursor += 1
      if (index >= values.length) return
      results[index] = await worker(values[index], index)
    }
  }))
  return results
}

const gitDirectory = path.resolve(root, runGit(['rev-parse', '--git-dir']))
const pointerRoot = path.join(gitDirectory, 'lfs', 'staging-pointers')
await rm(pointerRoot, { recursive: true, force: true })
await mkdir(pointerRoot, { recursive: true })

const files = (await Promise.all(
  requestedRoots.map((entry) => walk(path.resolve(root, entry))),
)).flat().sort((left, right) => left.localeCompare(right))

if (files.length === 0) throw new Error('No PNG assets found')

let completed = 0
const entries = await mapWithConcurrency(files, 8, async (absolute, index) => {
  const [metadata, oid] = await Promise.all([stat(absolute), sha256File(absolute)])
  const lfsObject = path.join(
    gitDirectory,
    'lfs',
    'objects',
    oid.slice(0, 2),
    oid.slice(2, 4),
    oid,
  )
  try {
    await stat(lfsObject)
  } catch {
    await mkdir(path.dirname(lfsObject), { recursive: true })
    const temporary = `${lfsObject}.${process.pid}.${index}.tmp`
    await copyFile(absolute, temporary)
    try {
      await rename(temporary, lfsObject)
    } catch (error) {
      await rm(temporary, { force: true })
      if (error?.code !== 'EEXIST') throw error
    }
  }
  const pointer = [
    'version https://git-lfs.github.com/spec/v1',
    `oid sha256:${oid}`,
    `size ${metadata.size}`,
    '',
  ].join('\n')
  const pointerPath = path.join(pointerRoot, `${String(index).padStart(5, '0')}.pointer`)
  await writeFile(pointerPath, pointer, 'utf8')
  completed += 1
  if (completed % 100 === 0 || completed === files.length) {
    process.stdout.write(`Prepared ${completed}/${files.length} LFS objects\n`)
  }
  return {
    repositoryPath: path.relative(root, absolute).split(path.sep).join('/'),
    pointerPath,
  }
})

const pointerInput = `${entries.map((entry) => entry.pointerPath).join('\n')}\n`
const blobIds = runGit(['hash-object', '-w', '--stdin-paths'], pointerInput).split(/\r?\n/)
if (blobIds.length !== entries.length) {
  throw new Error(`Expected ${entries.length} pointer blobs, received ${blobIds.length}`)
}

const indexInput = entries
  .map((entry, index) => `100644 ${blobIds[index]}\t${entry.repositoryPath}`)
  .join('\n') + '\n'
runGit(['update-index', '--add', '--index-info'], indexInput)
runGit(
  ['update-index', '--assume-unchanged', '--stdin'],
  entries.map((entry) => entry.repositoryPath).join('\n') + '\n',
)
await rm(pointerRoot, { recursive: true, force: true })

process.stdout.write(`Staged ${entries.length} PNG assets as Git LFS pointers.\n`)
