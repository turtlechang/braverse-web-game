/**
 * OpenCode Go Benchmark Node 測試
 *
 * 以 node:test 與 node:assert 驗證 benchmark 模組正確性。
 * 不依賴真實 CLI 連線，使用 mock runCommand 驗證流程與邊界條件。
 *
 * 執行方式：
 *   node --test scripts/opencode-go-benchmark.test.js
 *
 * 注意：此檔案使用 node:test，已在 package.json 的 vitest script 中以 --exclude 排除。
 */

import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'
import { createMockRunCommand, makeJsonLines, makeSampleReport, makeEmptyReport } from './benchmark/fixtures/helpers.mjs'
import {
  SIMPLE_OK,
  MULTI_TEXT,
  NO_TEXT,
  MALFORMED,
  NO_FINISH,
  BAD_TOKENS,
  EMPTY,
  PASS_REPLY,
  FAIL_REPLY,
  TS_SIGNATURE,
  REPLACEMENT_REPLY,
  IRRELEVANT,
} from './benchmark/fixtures/sample-outputs.mjs'

/* ================================================================== */
/*  1. Config — 三階段契約                                             */
/* ================================================================== */

describe('config — three-phase review/implementation/integration contract', () => {
  /** @type {import('./benchmark/benchmark-config.mjs')} */
  let config

  before(async () => {
    config = await import('./benchmark/benchmark-config.mjs')
  })

  it('exports exactly three phases: review, implementation, integration', () => {
    assert.equal(config.phases.length, 3)
    assert.deepStrictEqual(
      config.phases.map((p) => p.id),
      ['review', 'implementation', 'integration'],
    )
  })

  it('phases have order 0, 1, 2', () => {
    assert.deepStrictEqual(config.phases.map((p) => p.order), [0, 1, 2])
  })

  it('phases have non-empty names', () => {
    for (const phase of config.phases) {
      assert.ok(typeof phase.name === 'string' && phase.name.length > 0, `Phase ${phase.id} needs name`)
    }
  })

  it('phases have ref, timeoutMs, advanceCount, mode fields', () => {
    for (const phase of config.phases) {
      assert.ok(typeof phase.ref === 'string' && phase.ref.length > 0, `Phase ${phase.id} needs ref`)
      assert.ok(typeof phase.timeoutMs === 'number' && phase.timeoutMs > 0, `Phase ${phase.id} needs timeoutMs`)
      assert.ok(
        (typeof phase.advanceCount === 'number' && phase.advanceCount > 0) || phase.advanceCount === null,
        `Phase ${phase.id} needs advanceCount (number > 0 or null)`,
      )
      assert.ok(typeof phase.mode === 'string' && phase.mode.length > 0, `Phase ${phase.id} needs mode`)
    }
  })

  it('exports exactly seven models with opencode-go/ prefix', () => {
    assert.equal(config.models.length, 7)
    for (const model of config.models) {
      assert.match(model, /^opencode-go\//)
    }
  })

  it('models are the expected seven in order (含 minimax-m3/kimi-k2.6，不含 glm/mimo 普通版)', () => {
    assert.deepStrictEqual(config.models, [
      'opencode-go/mimo-v2.5',
      'opencode-go/deepseek-v4-pro',
      'opencode-go/minimax-m3',
      'opencode-go/kimi-k2.6',
      'opencode-go/kimi-k2.7-code',
      'opencode-go/mimo-v2.5-pro',
      'opencode-go/qwen3.7-plus',
    ])
  })

  it('modelOptions exists and covers all seven models', () => {
    assert.ok(typeof config.modelOptions === 'object' && config.modelOptions !== null)
    for (const model of config.models) {
      const opt = config.modelOptions[model]
      assert.ok(opt, `modelOptions missing for ${model}`)
      assert.ok(typeof opt.reasoningEffort === 'string', `${model} needs reasoningEffort`)
    }
  })

  it('each phase has exactly two review/implementation/integration scenarios', () => {
    for (const phase of config.phases) {
      const phaseTasks = config.tasks[phase.id]
      assert.ok(Array.isArray(phaseTasks), `tasks["${phase.id}"] must be array`)
      assert.equal(phaseTasks.length, 2, `tasks["${phase.id}"] must have exactly 2 tasks`)
      for (const task of phaseTasks) {
        assert.ok(typeof task.id === 'string' && task.id.length > 0)
        assert.ok(typeof task.prompt === 'string' && task.prompt.length > 0)
        assert.ok(Array.isArray(task.files) && task.files.length > 0, `${task.id}.files non-empty`)
        assert.ok(typeof task.timeoutMs === 'number' && task.timeoutMs > 0)
      }
    }
  })

  it('task IDs are unique across all phases', () => {
    const allIds = Object.values(config.tasks).flat().map((t) => t.id)
    assert.equal(new Set(allIds).size, allIds.length)
  })
})

/* ================================================================== */
/*  2. parseCliOutput — 純函式                                         */
/* ================================================================== */

describe('parseCliOutput', () => {
  /** @type {typeof import('./benchmark/benchmark-runner.mjs').parseCliOutput} */
  let parseCliOutput

  before(async () => {
    const mod = await import('./benchmark/benchmark-runner.mjs')
    parseCliOutput = mod.parseCliOutput
  })

  it('parses simple OK output with tokens', () => {
    const r = parseCliOutput(SIMPLE_OK)
    assert.equal(r.content, 'OK')
    assert.equal(r.inputTokens, 12)
    assert.equal(r.outputTokens, 7)
  })

  it('concatenates multiple text events', () => {
    const r = parseCliOutput(MULTI_TEXT)
    assert.equal(r.content, 'Hello World')
    assert.equal(r.inputTokens, 5)
    assert.equal(r.outputTokens, 3)
  })

  it('returns empty content when no text events', () => {
    const r = parseCliOutput(NO_TEXT)
    assert.equal(r.content, '')
    assert.equal(r.inputTokens, 0)
  })

  it('skips malformed JSON lines', () => {
    const r = parseCliOutput(MALFORMED)
    assert.equal(r.content, 'OK')
    assert.equal(r.inputTokens, 10)
    assert.equal(r.outputTokens, 5)
  })

  it('defaults tokens to zero when step_finish missing', () => {
    const r = parseCliOutput(NO_FINISH)
    assert.equal(r.content, 'No finish')
    assert.equal(r.inputTokens, 0)
    assert.equal(r.outputTokens, 0)
  })

  it('defaults tokens to zero when tokens object empty', () => {
    const r = parseCliOutput(BAD_TOKENS)
    assert.equal(r.content, 'Bad tokens')
    assert.equal(r.inputTokens, 0)
    assert.equal(r.outputTokens, 0)
  })

  it('handles empty string', () => {
    const r = parseCliOutput(EMPTY)
    assert.equal(r.content, '')
    assert.equal(r.inputTokens, 0)
    assert.equal(r.outputTokens, 0)
  })
})

/* ================================================================== */
/*  3. checkSuccess — 純函式                                           */
/* ================================================================== */

describe('checkSuccess', () => {
  /** @type {typeof import('./benchmark/benchmark-runner.mjs').checkSuccess} */
  let checkSuccess

  before(async () => {
    const mod = await import('./benchmark/benchmark-runner.mjs')
    checkSuccess = mod.checkSuccess
  })

  it('returns true when expectedPattern is undefined', () => {
    assert.equal(checkSuccess('anything', undefined), true)
  })

  it('matches string pattern via inclusion', () => {
    assert.equal(checkSuccess('Hello PASS World', 'PASS'), true)
  })

  it('fails string pattern when not present', () => {
    assert.equal(checkSuccess('Hello FAIL World', 'PASS'), false)
  })

  it('matches RegExp pattern', () => {
    assert.equal(checkSuccess('PASS: ok', /PASS|FAIL:/i), true)
  })

  it('fails RegExp when no match', () => {
    assert.equal(checkSuccess('nothing', /^OK$/), false)
  })

  it('handles empty content with string pattern', () => {
    assert.equal(checkSuccess('', 'PASS'), false)
  })

  it('handles empty content with RegExp matching empty', () => {
    assert.equal(checkSuccess('', /^$/), true)
  })
})

/* ================================================================== */
/*  4. computeSummary — 純函式                                         */
/* ================================================================== */

describe('computeSummary', () => {
  /** @type {typeof import('./benchmark/benchmark-runner.mjs').computeSummary} */
  let computeSummary

  before(async () => {
    const mod = await import('./benchmark/benchmark-runner.mjs')
    computeSummary = mod.computeSummary
  })

  it('returns zeroed summary for empty results', () => {
    const s = computeSummary('p0', 'Phase 0', [])
    assert.equal(s.phaseId, 'p0')
    assert.equal(s.phaseName, 'Phase 0')
    assert.equal(s.totalTasks, 0)
    assert.equal(s.passed, 0)
    assert.equal(s.avgTimeMs, 0)
  })

  it('computes correct passed count and average time', () => {
    const results = [
      { model: 'a', phaseId: 'p0', taskId: 't1', elapsedMs: 200, success: true, retries: 0, inputTokens: 10, outputTokens: 5 },
      { model: 'a', phaseId: 'p0', taskId: 't2', elapsedMs: 400, success: false, error: 'x', retries: 1, inputTokens: 8, outputTokens: 2 },
      { model: 'b', phaseId: 'p0', taskId: 't1', elapsedMs: 100, success: true, retries: 0, inputTokens: 10, outputTokens: 3 },
    ]
    const s = computeSummary('p0', 'Test', results)
    assert.equal(s.totalTasks, 3)
    assert.equal(s.passed, 2)
    assert.equal(s.avgTimeMs, 233)
  })

  it('averages correctly with single result', () => {
    const results = [
      { model: 'a', phaseId: 'p0', taskId: 't1', elapsedMs: 500, success: true, retries: 0, inputTokens: 10, outputTokens: 5 },
    ]
    const s = computeSummary('p0', 'Solo', results)
    assert.equal(s.totalTasks, 1)
    assert.equal(s.passed, 1)
    assert.equal(s.avgTimeMs, 500)
  })
})

/* ================================================================== */
/*  5. dryRun                                                          */
/* ================================================================== */

describe('dryRun', () => {
  /** @type {typeof import('./benchmark/benchmark-runner.mjs').dryRun} */
  let dryRun

  before(async () => {
    const mod = await import('./benchmark/benchmark-runner.mjs')
    dryRun = mod.dryRun
  })

  it('computes totalCalls as models × tasks across phases', () => {
    const config = {
      phases: [
        { id: 'p0', name: 'P0', order: 0 },
        { id: 'p1', name: 'P1', order: 1 },
      ],
      models: ['m1', 'm2', 'm3'],
      tasks: {
        p0: [{ id: 'a', prompt: '', files: [], timeoutMs: 1000 }, { id: 'b', prompt: '', files: [], timeoutMs: 1000 }],
        p1: [{ id: 'c', prompt: '', files: [], timeoutMs: 1000 }],
      },
    }
    const plan = dryRun(config)
    assert.equal(plan.totalCalls, 9)
    assert.equal(plan.phases.length, 2)
    assert.equal(plan.models.length, 3)
  })

  it('skips phases with empty tasks', () => {
    const config = {
      phases: [{ id: 'empty', name: 'E', order: 0 }],
      models: ['m1'],
      tasks: { empty: [] },
    }
    assert.equal(dryRun(config).totalCalls, 0)
  })

  it('produces plan matching the real three-phase config', async () => {
    const config = await import('./benchmark/benchmark-config.mjs')
    const plan = dryRun(config)
    assert.equal(plan.totalCalls, 42) // 7 models × 6 tasks (2 per phase)
    assert.equal(plan.phases.length, 3)
  })
})

/* ================================================================== */
/*  6. callOpenCodeGo — mock CLI                                       */
/* ================================================================== */

describe('callOpenCodeGo', () => {
  /** @type {typeof import('./benchmark/benchmark-runner.mjs').callOpenCodeGo} */
  let callOpenCodeGo

  before(async () => {
    const mod = await import('./benchmark/benchmark-runner.mjs')
    callOpenCodeGo = mod.callOpenCodeGo
  })

  it('calls CLI with correct args and returns content with tokens', async () => {
    const mockRun = createMockRunCommand([{ stdout: SIMPLE_OK }])

    const result = await callOpenCodeGo(
      'opencode-go/mimo-v2.5',
      'test prompt',
      'test-key',
      15000,
      ['src/game/energy.ts'],
      mockRun,
    )

    assert.equal(result.content, 'OK')
    assert.equal(result.inputTokens, 12)
    assert.equal(result.outputTokens, 7)
    assert.equal(mockRun.calls.length, 1)
    assert.match(mockRun.calls[0].command, /opencode-go\.cmd$/)
    assert.ok(mockRun.calls[0].args.includes('opencode-go/mimo-v2.5'))
    assert.ok(mockRun.calls[0].args.includes('test prompt'))
    assert.ok(mockRun.calls[0].args.includes('--file=src/game/energy.ts'))
    assert.equal(mockRun.calls[0].options.env?.OPENCODE_GO_API_KEY, 'test-key')
  })

  it('passes multiple files as separate --file= args', async () => {
    const mockRun = createMockRunCommand([{ stdout: SIMPLE_OK }])
    await callOpenCodeGo('opencode-go/mimo-v2.5', 't', 'k', 15000, ['a.ts', 'b.ts'], mockRun)
    assert.ok(mockRun.calls[0].args.includes('--file=a.ts'))
    assert.ok(mockRun.calls[0].args.includes('--file=b.ts'))
  })

  it('rejects on CLI non-zero exit code', async () => {
    const mockRun = createMockRunCommand([{ stderr: 'auth failed', exitCode: 1 }])
    await assert.rejects(
      () => callOpenCodeGo('opencode-go/mimo-v2.5', 't', 'k', 15000, [], mockRun),
      /CLI exited with code 1/,
    )
  })

  it('rejects empty API key without calling CLI', async () => {
    const mockRun = createMockRunCommand([{ stdout: SIMPLE_OK }])
    await assert.rejects(
      () => callOpenCodeGo('opencode-go/mimo-v2.5', 't', '', 15000, [], mockRun),
      /OPENCODE_GO_API_KEY/,
    )
    assert.equal(mockRun.calls.length, 0)
  })

  it('rejects whitespace-only API key', async () => {
    const mockRun = createMockRunCommand([{ stdout: SIMPLE_OK }])
    await assert.rejects(
      () => callOpenCodeGo('opencode-go/mimo-v2.5', 't', '   ', 15000, [], mockRun),
      /OPENCODE_GO_API_KEY/,
    )
  })
})

/* ================================================================== */
/*  7. runPhase — mock 全程                                            */
/* ================================================================== */

describe('runPhase', () => {
  /** @type {typeof import('./benchmark/benchmark-runner.mjs').runPhase} */
  let runPhase

  before(async () => {
    const mod = await import('./benchmark/benchmark-runner.mjs')
    runPhase = mod.runPhase
  })

  it('iterates models × tasks in correct order', async () => {
    const mockRun = createMockRunCommand([
      { stdout: SIMPLE_OK },
      { stdout: SIMPLE_OK },
      { stdout: SIMPLE_OK },
      { stdout: SIMPLE_OK },
    ])

    const phase = { id: 'test', name: 'T', order: 0 }
    const testModels = ['opencode-go/mimo-v2.5', 'opencode-go/qwen3.7-plus']
    const testTasks = [
      { id: 't1', prompt: 'T1', files: ['a.ts'], timeoutMs: 5000 },
      { id: 't2', prompt: 'T2', files: ['b.ts'], timeoutMs: 5000 },
    ]

    const results = await runPhase(phase, testModels, testTasks, 'test-key', { runCommand: mockRun })

    assert.equal(results.length, 4)
    assert.deepStrictEqual(
      results.map((r) => ({ model: r.model, taskId: r.taskId })),
      [
        { model: 'opencode-go/mimo-v2.5', taskId: 't1' },
        { model: 'opencode-go/mimo-v2.5', taskId: 't2' },
        { model: 'opencode-go/qwen3.7-plus', taskId: 't1' },
        { model: 'opencode-go/qwen3.7-plus', taskId: 't2' },
      ],
    )
  })

  it('captures CLI errors as failed results without throwing', async () => {
    const mockRun = createMockRunCommand([
      { stdout: SIMPLE_OK },
      { stderr: 'rate limited', exitCode: 429 },
    ])

    const phase = { id: 'test', name: 'T', order: 0 }
    const results = await runPhase(
      phase,
      ['opencode-go/mimo-v2.5'],
      [
        { id: 't1', prompt: 'T1', files: [], timeoutMs: 5000 },
        { id: 't2', prompt: 'T2', files: [], timeoutMs: 5000 },
      ],
      'test-key',
      { runCommand: mockRun, retryDelayMs: 0 },
    )

    assert.equal(results.length, 2)
    assert.equal(results[0].success, true)
    assert.equal(results[1].success, false)
    assert.ok(results[1].error)
  })

  it('marks pattern mismatch as failed', async () => {
    const mockRun = createMockRunCommand([{ stdout: IRRELEVANT }])

    const phase = { id: 'test', name: 'T', order: 0 }
    const results = await runPhase(
      phase,
      ['opencode-go/mimo-v2.5'],
      [{ id: 'echo', prompt: '回覆 OK', files: [], timeoutMs: 5000, expectedPattern: /^OK$/ }],
      'test-key',
      { runCommand: mockRun },
    )

    assert.equal(results[0].success, false)
    assert.match(results[0].error ?? '', /Pattern mismatch/)
  })

  it('calls onProgress callback', async () => {
    const mockRun = createMockRunCommand([{ stdout: SIMPLE_OK }])
    const progressCalls = []

    const phase = { id: 'test', name: 'T', order: 0 }
    await runPhase(
      phase,
      ['opencode-go/mimo-v2.5'],
      [{ id: 't0', prompt: 'T0', files: [], timeoutMs: 5000 }],
      'test-key',
      {
        runCommand: mockRun,
        onProgress: (model, taskId) => progressCalls.push({ model, taskId }),
      },
    )

    assert.equal(progressCalls.length, 1)
    assert.equal(progressCalls[0].taskId, 't0')
  })

  it('uses fixture outputs for PASS/FAIL pattern matching', async () => {
    const mockRun = createMockRunCommand([{ stdout: PASS_REPLY }, { stdout: FAIL_REPLY }])

    const phase = { id: 'review', name: '審查', order: 0 }
    const results = await runPhase(
      phase,
      ['opencode-go/mimo-v2.5'],
      [
        { id: 'r1', prompt: '', files: [], timeoutMs: 5000, expectedPattern: /PASS|FAIL:/i },
        { id: 'r2', prompt: '', files: [], timeoutMs: 5000, expectedPattern: /PASS|FAIL:/i },
      ],
      'test-key',
      { runCommand: mockRun },
    )

    assert.equal(results[0].success, true)
    assert.equal(results[1].success, true)
  })
})

/* ================================================================== */
/*  8. runBenchmark — 多階段                                           */
/* ================================================================== */

describe('runBenchmark', () => {
  /** @type {typeof import('./benchmark/benchmark-runner.mjs').runBenchmark} */
  let runBenchmark

  before(async () => {
    const mod = await import('./benchmark/benchmark-runner.mjs')
    runBenchmark = mod.runBenchmark
  })

  it('runs all phases in order', async () => {
    const mockRun = createMockRunCommand([{ stdout: SIMPLE_OK }, { stdout: PASS_REPLY }])

    const config = {
      phases: [
        { id: 'p0', name: 'Phase 0', order: 0 },
        { id: 'p1', name: 'Phase 1', order: 1 },
      ],
      models: ['opencode-go/mimo-v2.5'],
      tasks: {
        p0: [{ id: 't0', prompt: 'T0', files: [], timeoutMs: 5000 }],
        p1: [{ id: 't1', prompt: 'T1', files: [], timeoutMs: 5000 }],
      },
    }

    const report = await runBenchmark(config, 'test-key', mockRun)

    assert.equal(report.results.length, 2)
    assert.equal(report.results[0].phaseId, 'p0')
    assert.equal(report.results[1].phaseId, 'p1')
    assert.equal(report.summaries.length, 2)
    assert.ok(report.elapsedMs >= 0)
  })

  it('computes correct summary statistics', async () => {
    const mockRun = createMockRunCommand([{ stdout: SIMPLE_OK }, { stdout: IRRELEVANT }])

    const config = {
      phases: [{ id: 'p0', name: 'P0', order: 0 }],
      models: ['opencode-go/mimo-v2.5', 'opencode-go/qwen3.7-plus'],
      tasks: {
        p0: [{ id: 'echo', prompt: '', files: [], timeoutMs: 5000, expectedPattern: 'OK' }],
      },
    }

    const report = await runBenchmark(config, 'test-key', mockRun)

    assert.equal(report.summaries[0].totalTasks, 2)
    assert.equal(report.summaries[0].passed, 1)
  })

  it('skips phases with no tasks', async () => {
    const mockRun = createMockRunCommand([{ stdout: SIMPLE_OK }])

    const config = {
      phases: [
        { id: 'has', name: 'Has', order: 0 },
        { id: 'none', name: 'None', order: 1 },
      ],
      models: ['opencode-go/mimo-v2.5'],
      tasks: {
        has: [{ id: 't0', prompt: '', files: [], timeoutMs: 5000 }],
        none: [],
      },
    }

    const report = await runBenchmark(config, 'test-key', mockRun)

    assert.equal(report.results.length, 1)
    assert.equal(report.summaries.length, 1)
    assert.equal(report.summaries[0].phaseId, 'has')
  })
})

/* ================================================================== */
/*  9. Reporter                                                        */
/* ================================================================== */

describe('reporter', () => {
  /** @type {typeof import('./benchmark/benchmark-reporter.mjs').formatReport} */
  let formatReport

  before(async () => {
    const mod = await import('./benchmark/benchmark-reporter.mjs')
    formatReport = mod.formatReport
  })

  it('formats markdown with tables and all three phase names', () => {
    const report = makeSampleReport()
    const md = formatReport(report, 'markdown')
    assert.match(md, /OpenCode Go Benchmark/)
    assert.match(md, /\| 模型/)
    assert.match(md, /mimo-v2\.5/)
    assert.match(md, /審查/)
    assert.match(md, /實作/)
    assert.match(md, /整合/)
    assert.match(md, /總耗時/)
  })

  it('formats markdown with PASS and FAIL', () => {
    const report = makeSampleReport()
    const md = formatReport(report, 'markdown')
    assert.match(md, /FAIL/)
    assert.match(md, /Pattern mismatch/)
  })

  it('formats JSON with valid structure', () => {
    const report = makeSampleReport()
    const parsed = JSON.parse(formatReport(report, 'json'))
    assert.ok(Array.isArray(parsed.results))
    assert.ok(Array.isArray(parsed.summaries))
    assert.equal(parsed.results.length, 3)
    assert.equal(parsed.summaries.length, 3)
  })

  it('formats CSV with header', () => {
    const report = makeSampleReport()
    const csv = formatReport(report, 'csv')
    const lines = csv.trim().split('\n')
    assert.ok(lines.length >= 4)
    assert.ok(lines[0].includes('model'))
    assert.ok(lines[0].includes('phaseId'))
    assert.ok(lines[0].includes('success'))
  })

  it('defaults to markdown', () => {
    const report = makeSampleReport()
    assert.match(formatReport(report), /OpenCode Go Benchmark/)
  })

  it('handles empty report', () => {
    const report = makeEmptyReport()
    assert.match(formatReport(report, 'markdown'), /OpenCode Go Benchmark/)
    assert.equal(JSON.parse(formatReport(report, 'json')).results.length, 0)
    assert.equal(formatReport(report, 'csv').trim().split('\n').length, 1)
  })
})

/* ================================================================== */
/*  10. SYSTEM_PROMPT                                                  */
/* ================================================================== */

describe('SYSTEM_PROMPT', () => {
  it('is a non-empty string', async () => {
    const mod = await import('./benchmark/benchmark-runner.mjs')
    assert.ok(typeof mod.SYSTEM_PROMPT === 'string')
    assert.ok(mod.SYSTEM_PROMPT.length > 0)
  })
})

/* ================================================================== */
/*  11. CLI entry — importable                                         */
/* ================================================================== */

describe('CLI entry', () => {
  it('can be imported without errors', async () => {
    const originalEnv = { ...process.env }
    process.env.OPENCODE_GO_API_KEY = 'dummy'
    try {
      const mod = await import('./opencode-go-benchmark.mjs')
      assert.ok(mod)
    } finally {
      if (originalEnv.OPENCODE_GO_API_KEY === undefined) {
        delete process.env.OPENCODE_GO_API_KEY
      } else {
        process.env.OPENCODE_GO_API_KEY = originalEnv.OPENCODE_GO_API_KEY
      }
    }
  })
})
