/**
 * Benchmark 測試共用 helper
 *
 * 建立 mock runCommand、組裝 JSON-lines CLI stdout、建立範例報告。
 * 所有 benchmark 單元測試共用此模組，避免重複程式碼。
 */

import { EventEmitter } from 'node:events'

/**
 * @typedef {Object} MockResponse
 * @property {string} [stdout]
 * @property {string} [stderr]
 * @property {number} [exitCode]
 * @property {string} [error]
 */

/**
 * 建立可追蹤呼叫記錄的 mock runCommand。
 * 每次呼叫消耗 responses 陣列中的一個元素；超過後重複最後一個。
 *
 * @param {MockResponse[]} responses
 * @returns {((command: string, args: string[], options: import('node:child_process').SpawnOptions) => import('node:child_process').ChildProcess) & { calls: Array<{command: string, args: string[], options: import('node:child_process').SpawnOptions}> }}
 */
export function createMockRunCommand(responses) {
  let callIndex = 0
  /** @type {Array<{command: string, args: string[], options: import('node:child_process').SpawnOptions}>} */
  const calls = []

  /**
   * @param {string} command
   * @param {string[]} args
   * @param {import('node:child_process').SpawnOptions} options
   */
  function mock(command, args, options) {
    const resp = responses[callIndex] ?? responses[responses.length - 1]
    callIndex++
    calls.push({ command, args, options })

    const proc = new EventEmitter()
    proc.stdout = new EventEmitter()
    proc.stderr = new EventEmitter()
    proc.kill = () => {}

    setImmediate(() => {
      if (resp?.error) {
        proc.emit('error', new Error(resp.error))
        return
      }
      if (resp?.stdout) {
        proc.stdout.emit('data', resp.stdout)
      }
      if (resp?.stderr) {
        proc.stderr.emit('data', resp.stderr)
      }
      proc.emit('close', resp?.exitCode ?? 0)
    })

    return proc
  }

  mock.calls = calls
  return mock
}

/**
 * 組裝 opencode --format json 的模擬 stdout（step_start → text → step_finish）。
 *
 * @param {string} text - 模型回覆文字
 * @param {number} [inputTokens=10]
 * @param {number} [outputTokens=5]
 * @returns {string}
 */
export function makeJsonLines(text, inputTokens = 10, outputTokens = 5) {
  return [
    JSON.stringify({ type: 'step_start', part: { type: 'step-start' } }),
    JSON.stringify({ type: 'text', part: { type: 'text', text } }),
    JSON.stringify({
      type: 'step_finish',
      part: {
        type: 'step-finish',
        reason: 'stop',
        tokens: {
          input: inputTokens,
          output: outputTokens,
          total: inputTokens + outputTokens,
        },
      },
    }),
  ].join('\n')
}

/**
 * 建立一個最小三階段範例報告（供 reporter 測試使用）。
 *
 * @returns {import('../benchmark-runner.mjs').BenchmarkReport}
 */
export function makeSampleReport() {
  return {
    results: [
      {
        model: 'opencode-go/deepseek-v4-flash',
        phaseId: 'review',
        taskId: 'review-energy-payment',
        elapsedMs: 250,
        inputTokens: 10,
        outputTokens: 3,
        success: true,
        retries: 0,
      },
      {
        model: 'opencode-go/deepseek-v4-pro',
        phaseId: 'implementation',
        taskId: 'implement-draw-discard-effect',
        elapsedMs: 400,
        inputTokens: 10,
        outputTokens: 3,
        success: true,
        retries: 0,
      },
      {
        model: 'opencode-go/deepseek-v4-flash',
        phaseId: 'integration',
        taskId: 'integrate-card-lifecycle',
        elapsedMs: 800,
        inputTokens: 50,
        outputTokens: 30,
        success: false,
        error: 'Pattern mismatch',
        retries: 1,
      },
    ],
    summaries: [
      { phaseId: 'review', phaseName: '審查', totalTasks: 1, passed: 1, avgTimeMs: 250 },
      { phaseId: 'implementation', phaseName: '實作', totalTasks: 1, passed: 1, avgTimeMs: 400 },
      { phaseId: 'integration', phaseName: '整合', totalTasks: 1, passed: 0, avgTimeMs: 800 },
    ],
    elapsedMs: 1500,
  }
}

/**
 * 建立一個空報告。
 *
 * @returns {import('../benchmark-runner.mjs').BenchmarkReport}
 */
export function makeEmptyReport() {
  return { results: [], summaries: [], elapsedMs: 0 }
}
