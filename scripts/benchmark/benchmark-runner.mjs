/**
 * OpenCode Go Benchmark Runner
 *
 * 核心執行器：透過 scripts/opencode-go.cmd CLI 呼叫 OpenCode Go。
 * 解析 CLI 的 --format json 輸出，收集結果與 token 用量。
 * 所有純函式均 export 供測試直接驗證。
 */

import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const CLI_PATH = resolve(__dirname, '../opencode-go.cmd')
const PROJECT_ROOT = resolve(__dirname, '../..')

/* ------------------------------------------------------------------ */
/*  型別定義                                                           */
/* ------------------------------------------------------------------ */

/**
 * @typedef {Object} BenchmarkPhase
 * @property {string} id
 * @property {string} name
 * @property {number} order
 */

/**
 * @typedef {Object} BenchmarkTask
 * @property {string} id
 * @property {string} prompt
 * @property {string[]} [files]
 * @property {RegExp|string} [expectedPattern]
 * @property {number} timeoutMs
 */

/**
 * @typedef {Object} TaskResult
 * @property {string} model
 * @property {string} phaseId
 * @property {string} taskId
 * @property {number} elapsedMs
 * @property {number} inputTokens
 * @property {number} outputTokens
 * @property {boolean} success
 * @property {string} [error]
 * @property {number} retries
 */

/**
 * @typedef {Object} PhaseSummary
 * @property {string} phaseId
 * @property {string} phaseName
 * @property {number} totalTasks
 * @property {number} passed
 * @property {number} avgTimeMs
 */

/**
 * @typedef {Object} BenchmarkConfig
 * @property {BenchmarkPhase[]} phases
 * @property {string[]} models
 * @property {Record<string, BenchmarkTask[]>} tasks
 */

/**
 * @typedef {Object} BenchmarkReport
 * @property {TaskResult[]} results
 * @property {PhaseSummary[]} summaries
 * @property {number} elapsedMs
 */

/**
 * @typedef {Object} CliCallResult
 * @property {string} content
 * @property {number} inputTokens
 * @property {number} outputTokens
 */

/**
 * @typedef {Object} DryRunPlan
 * @property {BenchmarkPhase[]} phases
 * @property {string[]} models
 * @property {Record<string, BenchmarkTask[]>} tasks
 * @property {number} totalCalls
 */

/* ------------------------------------------------------------------ */
/*  常數                                                               */
/* ------------------------------------------------------------------ */

export const SYSTEM_PROMPT =
  '你是 OpenCode Go benchmark 受測模型。請直接完成任務，簡潔回覆，不使用 markdown 格式除非任務明確要求。'

const IDLE_TIMEOUT_MS = 2000
const DEFAULT_MAX_RETRIES = 1
const DEFAULT_RETRY_DELAY_MS = 1000

/* ------------------------------------------------------------------ */
/*  純函式（全部 export）                                              */
/* ------------------------------------------------------------------ */

/**
 * 解析 opencode --format json 的 stdout
 *
 * @param {string} stdout
 * @returns {CliCallResult}
 */
export function parseCliOutput(stdout) {
  const lines = stdout.split('\n').filter((line) => line.trim() !== '')
  /** @type {Array<{type: string, part: Record<string, unknown>}>} */
  const events = []

  for (const line of lines) {
    try {
      events.push(JSON.parse(line))
    } catch {
      // 忽略無法解析的非 JSON 行
    }
  }

  const content = events
    .filter((e) => e.type === 'text' && typeof e.part?.text === 'string')
    .map((e) => /** @type {string} */ (e.part.text))
    .join('')

  const finishEvent = events.find((e) => e.type === 'step_finish' && e.part && typeof e.part === 'object')
  const tokens = finishEvent?.part?.tokens
  const inputTokens = typeof tokens?.input === 'number' ? tokens.input : 0
  const outputTokens = typeof tokens?.output === 'number' ? tokens.output : 0

  return { content, inputTokens, outputTokens }
}

/**
 * 檢查任務結果是否符合預期
 *
 * @param {string} content
 * @param {RegExp|string|undefined} expectedPattern
 * @returns {boolean}
 */
export function checkSuccess(content, expectedPattern) {
  if (!expectedPattern) return true
  if (typeof expectedPattern === 'string') {
    return content.includes(expectedPattern)
  }
  return expectedPattern.test(content)
}

/**
 * 計算階段摘要
 *
 * @param {string} phaseId
 * @param {string} phaseName
 * @param {TaskResult[]} results
 * @returns {PhaseSummary}
 */
export function computeSummary(phaseId, phaseName, results) {
  const passed = results.filter((r) => r.success).length
  const avgTimeMs =
    results.length > 0
      ? Math.round(results.reduce((sum, r) => sum + r.elapsedMs, 0) / results.length)
      : 0
  return { phaseId, phaseName, totalTasks: results.length, passed, avgTimeMs }
}

/**
 * 產生 dry-run 計畫（不實際呼叫 CLI）
 *
 * @param {BenchmarkConfig} config
 * @returns {DryRunPlan}
 */
export function dryRun(config) {
  let totalCalls = 0
  for (const phase of config.phases) {
    const phaseTasks = config.tasks[phase.id]
    if (phaseTasks && phaseTasks.length > 0) {
      totalCalls += config.models.length * phaseTasks.length
    }
  }
  return { phases: config.phases, models: config.models, tasks: config.tasks, totalCalls }
}

/* ------------------------------------------------------------------ */
/*  CLI 呼叫                                                           */
/* ------------------------------------------------------------------ */

/**
 * 預設執行 CLI 的函式（可被測試注入替代）
 *
 * @param {string} command
 * @param {string[]} args
 * @param {import('node:child_process').SpawnOptions} [options]
 * @returns {import('node:child_process').ChildProcess}
 */
function defaultRunCommand(command, args, options) {
  if (process.platform === 'win32') {
    return spawn('cmd.exe', ['/c', command, ...args], options)
  }
  return spawn(command, args, options)
}

/**
 * 透過 opencode-go.cmd CLI 呼叫模型
 *
 * @param {string} model
 * @param {string} prompt
 * @param {string} apiKey
 * @param {number} timeoutMs
 * @param {string[]} [files]
 * @param {typeof defaultRunCommand} [runCommand]
 * @returns {Promise<CliCallResult>}
 */
export async function callOpenCodeGo(model, prompt, apiKey, timeoutMs, files = [], runCommand = defaultRunCommand) {
  if (!apiKey || apiKey.trim() === '') {
    throw new Error('OPENCODE_GO_API_KEY is not set. Set the environment variable before running benchmark.')
  }

  const args = [
    'run',
    '--model',
    model,
    '--format',
    'json',
    '--dir',
    PROJECT_ROOT,
    '--dangerously-skip-permissions',
    prompt,
    ...files.flatMap((file) => [`--file=${file}`]),
  ]

  return new Promise((resolve, reject) => {
    /** @type {string} */
    let stdout = ''
    /** @type {string} */
    let stderr = ''
    /** @type {import('node:child_process').ChildProcess | undefined} */
    let proc
    let finished = false

    const timeoutId = setTimeout(() => {
      if (finished) return
      finished = true
      proc?.kill()
      reject(new Error(`Request timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    /** @type {ReturnType<typeof setTimeout> | undefined} */
    let idleTimeoutId
    function resetIdleTimeout() {
      clearTimeout(idleTimeoutId)
      idleTimeoutId = setTimeout(() => {
        if (finished) return
        finished = true
        clearTimeout(timeoutId)
        proc?.kill()
        resolve(parseCliOutput(stdout))
      }, IDLE_TIMEOUT_MS)
    }

    proc = runCommand(CLI_PATH, args, {
      env: { ...process.env, OPENCODE_GO_API_KEY: apiKey },
      stdio: ['ignore', 'pipe', 'pipe'],
    })

    proc.stdout?.on('data', (data) => {
      stdout += data.toString()
      resetIdleTimeout()
    })

    proc.stderr?.on('data', (data) => {
      stderr += data.toString()
      resetIdleTimeout()
    })

    proc.on('error', (err) => {
      if (finished) return
      finished = true
      clearTimeout(timeoutId)
      clearTimeout(idleTimeoutId)
      reject(err)
    })

    proc.on('close', (code) => {
      if (finished) return
      finished = true
      clearTimeout(timeoutId)
      clearTimeout(idleTimeoutId)
      if (code !== 0) {
        reject(new Error(`CLI exited with code ${code}: ${stderr.slice(0, 200)}`))
        return
      }
      resolve(parseCliOutput(stdout))
    })
  })
}

/* ------------------------------------------------------------------ */
/*  任務執行                                                           */
/* ----------------------------------------------------------------__*/

/**
 * 執行單一任務（含重試）。
 * retryDelayMs 可由測試注入以加速重試驗證。
 *
 * @param {string} model
 * @param {BenchmarkPhase} phase
 * @param {BenchmarkTask} task
 * @param {string} apiKey
 * @param {number} maxRetries
 * @param {number} retryDelayMs
 * @param {typeof defaultRunCommand} [runCommand]
 * @returns {Promise<TaskResult>}
 */
export async function runTask(model, phase, task, apiKey, maxRetries, retryDelayMs, runCommand) {
  /** @type {string|undefined} */
  let lastError = undefined
  const fullPrompt = `${SYSTEM_PROMPT}\n\n${task.prompt}`

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const start = Date.now()
    try {
      const resp = await callOpenCodeGo(model, fullPrompt, apiKey, task.timeoutMs, task.files, runCommand)
      const success = checkSuccess(resp.content, task.expectedPattern)
      return {
        model,
        phaseId: phase.id,
        taskId: task.id,
        elapsedMs: Date.now() - start,
        inputTokens: resp.inputTokens,
        outputTokens: resp.outputTokens,
        success,
        error: success ? undefined : `Pattern mismatch. Response: ${resp.content.slice(0, 120)}`,
        retries: attempt,
      }
    } catch (err) {
      lastError = err.message
      if (attempt < maxRetries) {
        await new Promise((r) => setTimeout(r, retryDelayMs))
      }
    }
  }

  return {
    model,
    phaseId: phase.id,
    taskId: task.id,
    elapsedMs: 0,
    inputTokens: 0,
    outputTokens: 0,
    success: false,
    error: lastError,
    retries: maxRetries,
  }
}

/**
 * @typedef {Object} RunPhaseOptions
 * @property {typeof defaultRunCommand} [runCommand]
 * @property {(model: string, taskId: string, result: TaskResult) => void} [onProgress]
 * @property {number} [retryDelayMs] - 覆寫重試等待（預設 DEFAULT_RETRY_DELAY_MS）
 */

/**
 * 執行單一階段所有模型×任務
 *
 * @param {BenchmarkPhase} phase
 * @param {string[]} models
 * @param {BenchmarkTask[]} phaseTasks
 * @param {string} apiKey
 * @param {RunPhaseOptions} [options]
 * @returns {Promise<TaskResult[]>}
 */
export async function runPhase(phase, models, phaseTasks, apiKey, options) {
  const { runCommand, onProgress, retryDelayMs = DEFAULT_RETRY_DELAY_MS } = options ?? {}

  /** @type {TaskResult[]} */
  const results = []

  for (const model of models) {
    for (const task of phaseTasks) {
      const result = await runTask(
        model,
        phase,
        task,
        apiKey,
        DEFAULT_MAX_RETRIES,
        retryDelayMs,
        runCommand,
      )
      results.push(result)

      if (onProgress) {
        onProgress(model, task.id, result)
      }
    }
  }

  return results
}

/**
 * 執行完整 benchmark（所有階段）
 *
 * @param {BenchmarkConfig} config
 * @param {string} apiKey
 * @param {typeof defaultRunCommand} [runCommand]
 * @param {(model: string, taskId: string, result: TaskResult) => void} [onProgress]
 * @returns {Promise<BenchmarkReport>}
 */
export async function runBenchmark(config, apiKey, runCommand, onProgress) {
  const overallStart = Date.now()
  /** @type {TaskResult[]} */
  const allResults = []
  /** @type {PhaseSummary[]} */
  const summaries = []

  const sortedPhases = [...config.phases].sort((a, b) => a.order - b.order)

  for (const phase of sortedPhases) {
    const phaseTasks = config.tasks[phase.id]
    if (!phaseTasks || phaseTasks.length === 0) continue

    const results = await runPhase(phase, config.models, phaseTasks, apiKey, { runCommand, onProgress })
    allResults.push(...results)
    summaries.push(computeSummary(phase.id, phase.name, results))
  }

  return { results: allResults, summaries, elapsedMs: Date.now() - overallStart }
}
