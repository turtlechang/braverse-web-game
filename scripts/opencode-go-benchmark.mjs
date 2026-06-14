#!/usr/bin/env node
/**
 * OpenCode Go Benchmark CLI
 *
 * 使用方式：
 *   node scripts/opencode-go-benchmark.mjs [options]
 *
 * 選項：
 *   --phase <id>        只執行指定階段（review / implementation / integration）
 *   --model <name>      只執行名稱包含此字串的模型
 *   --format <fmt>      輸出格式：markdown（預設）、json、csv
 *   --dry-run           列出執行計畫，不實際呼叫 CLI
 *   --output-dir <dir>  將報告寫入指定目錄（自動建立）
 *
 * 環境需求：
 *   - Node.js 18+
 *   - 環境變數 OPENCODE_GO_API_KEY 已設定
 *   - opencode-go.cmd 可透過 scripts/ 目錄找到
 */

import { runBenchmark, dryRun } from './benchmark/benchmark-runner.mjs'
import { formatReport } from './benchmark/benchmark-reporter.mjs'
import { phases, models, tasks } from './benchmark/benchmark-config.mjs'
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'

/**
 * @param {string[]} argv
 * @returns {{ phase?: string, model?: string, format?: string, dryRun?: boolean, outputDir?: string }}
 */
function parseArgs(argv) {
  /** @type {{ phase?: string, model?: string, format?: string, dryRun?: boolean, outputDir?: string }} */
  const opts = {}
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--phase' && i + 1 < argv.length) {
      opts.phase = argv[++i]
    } else if (argv[i] === '--model' && i + 1 < argv.length) {
      opts.model = argv[++i]
    } else if (argv[i] === '--format' && i + 1 < argv.length) {
      opts.format = argv[++i]
    } else if (argv[i] === '--dry-run') {
      opts.dryRun = true
    } else if (argv[i] === '--output-dir' && i + 1 < argv.length) {
      opts.outputDir = argv[++i]
    }
  }
  return opts
}

async function main() {
  const opts = parseArgs(process.argv.slice(2))
  const apiKey = process.env.OPENCODE_GO_API_KEY

  const filteredPhases = opts.phase
    ? phases.filter((p) => p.id === opts.phase)
    : phases

  if (filteredPhases.length === 0) {
    console.error(`[benchmark] Unknown phase: ${opts.phase}`)
    console.error(`Available phases: ${phases.map((p) => p.id).join(', ')}`)
    process.exit(1)
  }

  const filteredModels = opts.model
    ? models.filter((m) => m.includes(opts.model))
    : models

  if (filteredModels.length === 0) {
    console.error(`[benchmark] No model matches: ${opts.model}`)
    process.exit(1)
  }

  const outputFormat = opts.format ?? 'markdown'

  const config = {
    phases: filteredPhases,
    models: filteredModels,
    tasks,
  }

  if (opts.dryRun) {
    const plan = dryRun(config)
    console.log('[benchmark] Dry-run plan:')
    console.log(`  Phases: ${plan.phases.map((p) => p.id).join(', ')}`)
    console.log(`  Models: ${plan.models.map((m) => m.replace('opencode-go/', '')).join(', ')}`)
    for (const phase of plan.phases) {
      const phaseTasks = plan.tasks[phase.id]
      if (phaseTasks) {
        console.log(`  Phase "${phase.id}": ${phaseTasks.length} task(s)`)
        for (const t of phaseTasks) {
          console.log(`    - ${t.id}: ${t.files?.join(', ') ?? '(no files)'}`)
        }
      }
    }
    console.log(`  Total CLI calls: ${plan.totalCalls}`)
    return
  }

  if (!apiKey) {
    console.error('[benchmark] OPENCODE_GO_API_KEY is not set.')
    process.exit(2)
  }

  console.log(`[benchmark] Phases: ${filteredPhases.map((p) => p.id).join(', ')}`)
  console.log(`[benchmark] Models: ${filteredModels.map((m) => m.replace('opencode-go/', '')).join(', ')}`)
  console.log('[benchmark] Starting...')
  console.log()

  const report = await runBenchmark(config, apiKey, undefined, (model, taskId, result) => {
    const short = model.replace('opencode-go/', '')
    const status = result.success ? 'PASS' : 'FAIL'
    const errorHint = result.error ? ` - ${result.error.split('\n')[0].slice(0, 120)}` : ''
    console.log(`  [${status}] ${short} / ${result.phaseId} / ${taskId} (${result.elapsedMs}ms)${errorHint}`)
  })

  const formatted = formatReport(report, outputFormat)

  if (opts.outputDir) {
    const dir = resolve(opts.outputDir)
    mkdirSync(dir, { recursive: true })
    const ext = outputFormat === 'json' ? 'json' : outputFormat === 'csv' ? 'csv' : 'md'
    const filePath = resolve(dir, `benchmark-report.${ext}`)
    writeFileSync(filePath, formatted, 'utf-8')
    console.log(`\n[benchmark] Report written to ${filePath}`)
  } else {
    console.log()
    console.log(formatted)
  }
}

const isMain = process.argv[1] && (
  process.argv[1].endsWith('opencode-go-benchmark.mjs') ||
  process.argv[1].endsWith('opencode-go-benchmark')
)
if (isMain) {
  main().catch((error) => {
    console.error('[benchmark] Fatal error:', error.message)
    process.exit(1)
  })
}
