#!/usr/bin/env node

import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { pathToFileURL } from 'node:url'
import { chromium } from '@playwright/test'
import { createServer } from 'vite'

function parseArguments(argv) {
  const values = new Map()
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index]
    if (!argument.startsWith('--')) continue
    values.set(argument.slice(2), argv[index + 1])
    index += 1
  }
  const corpus = values.get('corpus')
  if (!corpus) throw new Error('Usage: node scripts/map-image-benchmark.mjs --corpus <directory> [--output report.json] [--runs 3] [--overlays directory]')
  return {
    corpus: path.resolve(corpus),
    output: path.resolve(values.get('output') ?? 'map-image-benchmark.json'),
    overlays: values.has('overlays') ? path.resolve(values.get('overlays')) : undefined,
    runs: Math.max(1, Number.parseInt(values.get('runs') ?? '3', 10) || 3),
    darknessThreshold: Math.max(0, Math.min(255, Number(values.get('darkness-threshold') ?? 68))),
    minimumRunRatio: Math.max(0.005, Math.min(0.25, Number(values.get('minimum-run-ratio') ?? 0.025))),
  }
}

async function filesUnder(directory) {
  const entries = await readdir(directory, { withFileTypes: true })
  const nested = await Promise.all(entries.map((entry) => {
    const absolute = path.join(directory, entry.name)
    return entry.isDirectory() ? filesUnder(absolute) : [absolute]
  }))
  return nested.flat()
}

function uvttPoint(value) {
  return value && Number.isFinite(value.x) && Number.isFinite(value.y)
    ? { x: Number(value.x), y: Number(value.y) }
    : undefined
}

function uvttSegments(raw, imageWidth, imageHeight) {
  const resolution = raw?.resolution
  const origin = uvttPoint(resolution?.map_origin) ?? { x: 0, y: 0 }
  const mapSize = uvttPoint(resolution?.map_size)
  const pixelsPerGrid = Number(resolution?.pixels_per_grid)
  if (!mapSize || !Number.isFinite(pixelsPerGrid) || pixelsPerGrid <= 0) return []
  const sourceWidth = mapSize.x * pixelsPerGrid
  const sourceHeight = mapSize.y * pixelsPerGrid
  const scaleX = sourceWidth > 0 ? imageWidth / sourceWidth : 1
  const scaleY = sourceHeight > 0 ? imageHeight / sourceHeight : 1
  const convert = (point) => ({
    x: (point.x - origin.x) * pixelsPerGrid * scaleX,
    y: (point.y - origin.y) * pixelsPerGrid * scaleY,
  })
  const lines = [
    ...(Array.isArray(raw.line_of_sight) ? raw.line_of_sight : []),
    ...(Array.isArray(raw.objects_line_of_sight) ? raw.objects_line_of_sight : []),
  ]
  return lines.flatMap((line) => {
    if (!Array.isArray(line)) return []
    const points = line.map(uvttPoint).filter(Boolean).map(convert)
    return points.slice(0, -1).flatMap((a, index) => {
      const b = points[index + 1]
      return Math.hypot(b.x - a.x, b.y - a.y) >= 1 ? [{ a, b }] : []
    })
  })
}

function dataUrlExtension(dataUrl) {
  const match = /^data:image\/([a-zA-Z0-9.+-]+);base64,/.exec(dataUrl)
  const mime = match?.[1]
  if (mime?.includes('png') || dataUrl.startsWith('iVBORw0KGgo')) return 'png'
  if (mime?.includes('webp') || dataUrl.startsWith('UklGR')) return 'webp'
  if (!mime && !dataUrl.startsWith('/9j/')) return undefined
  return 'jpg'
}

async function embeddedImageFile(raw, sourceFile, scratchDirectory) {
  if (typeof raw?.image !== 'string') throw new Error(`${sourceFile} has no embedded image`)
  const extension = dataUrlExtension(raw.image)
  const separator = raw.image.indexOf(',')
  if (!extension) throw new Error(`${sourceFile} has an invalid embedded image`)
  const base64 = separator >= 0 ? raw.image.slice(separator + 1) : raw.image
  const destination = path.join(
    scratchDirectory,
    `${path.basename(sourceFile).replace(/[^a-zA-Z0-9._-]/g, '_')}.${extension}`,
  )
  await writeFile(destination, Buffer.from(base64, 'base64'))
  return destination
}

function distanceToSegment(point, segment) {
  const dx = segment.b.x - segment.a.x
  const dy = segment.b.y - segment.a.y
  const denominator = dx * dx + dy * dy
  const t = denominator <= 1e-9
    ? 0
    : Math.max(0, Math.min(1, ((point.x - segment.a.x) * dx + (point.y - segment.a.y) * dy) / denominator))
  return Math.hypot(point.x - (segment.a.x + dx * t), point.y - (segment.a.y + dy * t))
}

function segmentIndex(segments, tolerance) {
  const cellSize = Math.max(24, tolerance * 3)
  const buckets = new Map()
  for (const segment of segments) {
    const minX = Math.floor((Math.min(segment.a.x, segment.b.x) - tolerance) / cellSize)
    const maxX = Math.floor((Math.max(segment.a.x, segment.b.x) + tolerance) / cellSize)
    const minY = Math.floor((Math.min(segment.a.y, segment.b.y) - tolerance) / cellSize)
    const maxY = Math.floor((Math.max(segment.a.y, segment.b.y) + tolerance) / cellSize)
    for (let x = minX; x <= maxX; x += 1) {
      for (let y = minY; y <= maxY; y += 1) {
        const key = `${x}:${y}`
        const bucket = buckets.get(key)
        if (bucket) bucket.push(segment)
        else buckets.set(key, [segment])
      }
    }
  }
  return {
    near(point) {
      return buckets.get(`${Math.floor(point.x / cellSize)}:${Math.floor(point.y / cellSize)}`) ?? []
    },
  }
}

function coverage(source, target, tolerance) {
  if (source.length === 0) return { matched: 0, total: 0, ratio: 0 }
  const index = segmentIndex(target, tolerance)
  const sampleStep = Math.max(3, tolerance / 2)
  let matched = 0
  let total = 0
  for (const segment of source) {
    const length = Math.hypot(segment.b.x - segment.a.x, segment.b.y - segment.a.y)
    const steps = Math.max(1, Math.ceil(length / sampleStep))
    for (let step = 0; step <= steps; step += 1) {
      const t = step / steps
      const point = {
        x: segment.a.x + (segment.b.x - segment.a.x) * t,
        y: segment.a.y + (segment.b.y - segment.a.y) * t,
      }
      total += 1
      if (index.near(point).some((candidate) => distanceToSegment(point, candidate) <= tolerance)) matched += 1
    }
  }
  return { matched, total, ratio: total > 0 ? matched / total : 0 }
}

function scoreSegments(truth, candidates, tolerance) {
  const precision = coverage(candidates, truth, tolerance)
  const recall = coverage(truth, candidates, tolerance)
  const denominator = precision.ratio + recall.ratio
  return {
    tolerancePx: tolerance,
    precision: precision.ratio,
    recall: recall.ratio,
    f1: denominator > 0 ? 2 * precision.ratio * recall.ratio / denominator : 0,
    precisionSamples: precision.total,
    recallSamples: recall.total,
    matchedPrecisionSamples: precision.matched,
    matchedRecallSamples: recall.matched,
  }
}

function median(values) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

async function analyzeFile(page, input, detectorOptions, runs, overlayPath) {
  await page.locator('#benchmark-file').setInputFiles(input.imageFile)
  const result = await page.evaluate(async ({ detectorOptions, runs }) => {
    const fileInput = document.querySelector('#benchmark-file')
    const file = fileInput?.files?.[0]
    if (!file) throw new Error('Benchmark image was not attached')
    const bitmap = await createImageBitmap(file)
    const width = bitmap.width
    const height = bitmap.height
    bitmap.close()
    const module = await import('/src/lib/mapImageGeometryDetection.ts')
    const durationsMs = []
    let candidates = []
    for (let run = 0; run < runs; run += 1) {
      const startedAt = performance.now()
      candidates = await module.detectWallsFromImageFile(file, { width, height }, detectorOptions)
      durationsMs.push(performance.now() - startedAt)
    }
    return { width, height, candidates, durationsMs }
  }, { detectorOptions, runs })
  if (overlayPath) {
    await page.evaluate(async ({ candidates }) => {
      document.querySelector('#benchmark-overlay')?.remove()
      const file = document.querySelector('#benchmark-file')?.files?.[0]
      if (!file) return
      const bitmap = await createImageBitmap(file)
      const scale = Math.min(1, 1_400 / Math.max(bitmap.width, bitmap.height))
      const canvas = document.createElement('canvas')
      canvas.id = 'benchmark-overlay'
      canvas.width = Math.round(bitmap.width * scale)
      canvas.height = Math.round(bitmap.height * scale)
      const context = canvas.getContext('2d')
      context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      bitmap.close()
      context.scale(scale, scale)
      context.strokeStyle = '#00e5ff'
      context.lineWidth = 3 / scale
      context.globalAlpha = 0.85
      for (const candidate of candidates) {
        context.beginPath()
        context.moveTo(candidate.a.x, candidate.a.y)
        context.lineTo(candidate.b.x, candidate.b.y)
        context.stroke()
      }
      document.body.append(canvas)
    }, { candidates: result.candidates })
    await page.locator('#benchmark-overlay').screenshot({ path: overlayPath })
  }
  return result
}

async function main() {
  const options = parseArguments(process.argv.slice(2))
  const scratchDirectory = path.join(options.corpus, '.decoded')
  await mkdir(scratchDirectory, { recursive: true })
  if (options.overlays) await mkdir(options.overlays, { recursive: true })
  const files = (await filesUnder(options.corpus))
    .filter((file) => !file.includes(`${path.sep}.decoded${path.sep}`))
    .filter((file) => /\.(?:dd2vtt|uvtt|df2vtt|png|jpe?g|webp)$/i.test(file))
    .sort()
  const server = await createServer({
    root: process.cwd(),
    logLevel: 'error',
    plugins: [{
      name: 'map-image-benchmark-page',
      configureServer(viteServer) {
        viteServer.middlewares.use('/__map-image-benchmark', (_request, response) => {
          response.setHeader('Content-Type', 'text/html; charset=utf-8')
          response.end('<!doctype html><html><body><input id="benchmark-file" type="file"></body></html>')
        })
      },
    }],
    server: { host: '127.0.0.1', port: 0 },
  })
  await server.listen()
  const baseUrl = server.resolvedUrls?.local[0]
  if (!baseUrl) throw new Error('Vite did not expose a local benchmark URL')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()
  await page.goto(new URL('/__map-image-benchmark', baseUrl).href)
  const results = []
  try {
    for (const file of files) {
      const category = path.basename(path.dirname(file))
      const isUvtt = /\.(?:dd2vtt|uvtt|df2vtt)$/i.test(file)
      const raw = isUvtt ? JSON.parse(await readFile(file, 'utf8')) : undefined
      const imageFile = isUvtt ? await embeddedImageFile(raw, file, scratchDirectory) : file
      const overlayPath = options.overlays && category === 'scanned'
        ? path.join(options.overlays, `${path.basename(file)}.overlay.png`)
        : undefined
      const analyzed = await analyzeFile(page, { imageFile }, {
        darknessThreshold: options.darknessThreshold,
        minimumRunRatio: options.minimumRunRatio,
      }, options.runs, overlayPath)
      const truth = raw ? uvttSegments(raw, analyzed.width, analyzed.height) : []
      const pixelsPerGrid = Number(raw?.resolution?.pixels_per_grid)
      const tolerance = Math.max(6, Math.min(18, Number.isFinite(pixelsPerGrid) ? pixelsPerGrid * 0.08 : 10))
      const score = truth.length > 0
        ? scoreSegments(truth, analyzed.candidates, tolerance)
        : undefined
      const item = {
        category,
        name: path.basename(file),
        bytes: (await readFile(file)).byteLength,
        width: analyzed.width,
        height: analyzed.height,
        truthSegments: truth.length,
        candidateSegments: analyzed.candidates.length,
        durationsMs: analyzed.durationsMs,
        medianDurationMs: median(analyzed.durationsMs),
        score,
      }
      results.push(item)
      process.stdout.write(`${category}/${item.name}: ${item.candidateSegments} candidates, ${item.medianDurationMs.toFixed(1)} ms${score ? `, F1 ${(score.f1 * 100).toFixed(1)}%` : ''}\n`)
    }
  } finally {
    await browser.close()
    await server.close()
    await rm(scratchDirectory, { recursive: true, force: true })
  }
  const scored = results.filter((result) => result.score)
  const precisionMatched = scored.reduce((sum, result) => sum + result.score.matchedPrecisionSamples, 0)
  const precisionTotal = scored.reduce((sum, result) => sum + result.score.precisionSamples, 0)
  const recallMatched = scored.reduce((sum, result) => sum + result.score.matchedRecallSamples, 0)
  const recallTotal = scored.reduce((sum, result) => sum + result.score.recallSamples, 0)
  const precision = precisionTotal > 0 ? precisionMatched / precisionTotal : 0
  const recall = recallTotal > 0 ? recallMatched / recallTotal : 0
  const report = {
    generatedAt: new Date().toISOString(),
    detector: {
      darknessThreshold: options.darknessThreshold,
      minimumRunRatio: options.minimumRunRatio,
      maximumDimension: 1_600,
      runsPerMap: options.runs,
    },
    aggregate: {
      scoredMaps: scored.length,
      precision,
      recall,
      f1: precision + recall > 0 ? 2 * precision * recall / (precision + recall) : 0,
      medianDurationMs: median(results.map((result) => result.medianDurationMs)),
      maximumDurationMs: Math.max(...results.flatMap((result) => result.durationsMs)),
    },
    results,
  }
  await mkdir(path.dirname(options.output), { recursive: true })
  await writeFile(options.output, `${JSON.stringify(report, null, 2)}\n`)
  process.stdout.write(`Report: ${options.output}\n`)
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((error) => {
    console.error(error)
    process.exitCode = 1
  })
}
