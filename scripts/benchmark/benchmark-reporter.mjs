/**
 * OpenCode Go Benchmark Reporter
 *
 * 產生多格式 benchmark 報告（markdown / JSON / CSV）。
 * 報告包含三階段摘要、詳細結果與模型總體表現。
 */

/**
 * @param {import('./benchmark-runner.mjs').BenchmarkReport} report
 * @returns {string}
 */
function toMarkdown(report) {
  const lines = []

  lines.push('# OpenCode Go Benchmark 報告')
  lines.push('')
  lines.push(`總耗時: ${report.elapsedMs}ms (${(report.elapsedMs / 1000).toFixed(1)}s)`)
  lines.push('')

  // 階段摘要
  lines.push('## 階段摘要')
  lines.push('')
  lines.push('| 階段 | 總任務數 | 通過 | 成功率 | 平均耗時 |')
  lines.push('|------|----------|------|--------|----------|')

  for (const s of report.summaries) {
    const rate = s.totalTasks > 0 ? ((s.passed / s.totalTasks) * 100).toFixed(0) : '0'
    lines.push(`| ${s.phaseName} (${s.phaseId}) | ${s.totalTasks} | ${s.passed} | ${rate}% | ${s.avgTimeMs}ms |`)
  }

  lines.push('')

  // 詳細結果
  lines.push('## 詳細結果')
  lines.push('')
  lines.push('| 模型 | 階段 | 任務 | 耗時 | 輸入 Token | 輸出 Token | 結果 |')
  lines.push('|------|------|------|------|-----------|-----------|------|')

  for (const r of report.results) {
    const modelShort = r.model.replace('opencode-go/', '')
    const status = r.success
      ? 'PASS'
      : `FAIL${r.error ? ': ' + r.error.split('\n')[0].slice(0, 80) : ''}`
    lines.push(
      `| ${modelShort} | ${r.phaseId} | ${r.taskId} | ${r.elapsedMs}ms | ${r.inputTokens} | ${r.outputTokens} | ${status} |`,
    )
  }

  lines.push('')

  // 模型總體表現
  lines.push('## 模型總體表現')
  lines.push('')

  const modelStats = new Map()
  for (const r of report.results) {
    const entry = modelStats.get(r.model) ?? {
      total: 0,
      passed: 0,
      totalTime: 0,
      totalInputT: 0,
      totalOutputT: 0,
    }
    entry.total++
    if (r.success) entry.passed++
    entry.totalTime += r.elapsedMs
    entry.totalInputT += r.inputTokens
    entry.totalOutputT += r.outputTokens
    modelStats.set(r.model, entry)
  }

  lines.push('| 模型 | 總任務 | 通過 | 成功率 | 總耗時 | 平均耗時 | 總輸入 Token | 總輸出 Token |')
  lines.push('|------|--------|------|--------|--------|----------|-------------|-------------|')

  for (const [model, stats] of [...modelStats.entries()].sort(
    (a, b) => b[1].passed - a[1].passed,
  )) {
    const short = model.replace('opencode-go/', '')
    const rate = ((stats.passed / stats.total) * 100).toFixed(0)
    const avg = Math.round(stats.totalTime / stats.total)
    lines.push(
      `| ${short} | ${stats.total} | ${stats.passed} | ${rate}% | ${stats.totalTime}ms | ${avg}ms | ${stats.totalInputT} | ${stats.totalOutputT} |`,
    )
  }

  return lines.join('\n')
}

/**
 * @param {import('./benchmark-runner.mjs').BenchmarkReport} report
 * @returns {string}
 */
function toJSON(report) {
  return JSON.stringify(report, null, 2)
}

/**
 * @param {import('./benchmark-runner.mjs').BenchmarkReport} report
 * @returns {string}
 */
function toCSV(report) {
  const lines = []
  const header = ['model', 'phaseId', 'taskId', 'elapsedMs', 'inputTokens', 'outputTokens', 'success', 'error', 'retries']
  lines.push(header.join(','))

  for (const r of report.results) {
    const error = r.error ? `"${r.error.replace(/"/g, '""')}"` : ''
    const row = [r.model, r.phaseId, r.taskId, r.elapsedMs, r.inputTokens, r.outputTokens, r.success, error, r.retries]
    lines.push(row.join(','))
  }

  return lines.join('\n')
}

/**
 * 格式化 benchmark 報告
 *
 * @param {import('./benchmark-runner.mjs').BenchmarkReport} report
 * @param {'markdown'|'json'|'csv'} [format='markdown']
 * @returns {string}
 */
export function formatReport(report, format = 'markdown') {
  switch (format) {
    case 'json':
      return toJSON(report)
    case 'csv':
      return toCSV(report)
    case 'markdown':
    default:
      return toMarkdown(report)
  }
}
