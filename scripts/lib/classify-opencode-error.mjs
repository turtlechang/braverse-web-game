/**
 * OpenCode Go 錯誤分類器
 *
 * 純函式：輸入原始 CLI 輸出，輸出結構化分類結果。
 * 不呼叫外部 API、不產生副作用。
 *
 * 判斷優先序：
 * 1. parsedBody（結構化 API response）
 * 2. HTTP status code
 * 3. Provider error code（body 內）
 * 4. stderr 關鍵字匹配（表驅動）
 * 5. process exit code（最低優先）
 * 6. 無法判定 → unknown
 */

// ─── ErrorType 列舉 ────────────────────────────────────────────────

/** @typedef {string} ErrorType */

/** @type {Record<ErrorType, { retryable: boolean, description: string }>} */
export const ERROR_TYPE_META = {
  auth_missing: { retryable: false, description: "API key 未設定" },
  auth_invalid: { retryable: false, description: "API key 無效或過期" },
  permission_denied: { retryable: false, description: "權限不足" },
  rate_limit: { retryable: true, description: "短時間請求過多" },
  token_rate_limit: { retryable: true, description: "TPM 超過" },
  concurrency_limit: { retryable: true, description: "同時任務過多" },
  model_capacity: { retryable: true, description: "模型暫時忙碌" },
  quota_exhausted: { retryable: false, description: "帳戶額度用完" },
  billing_limit: { retryable: false, description: "付款或預算限制" },
  model_unavailable: { retryable: false, description: "模型不存在或下線" },
  network: { retryable: true, description: "DNS/HTTPS/TLS 失敗" },
  sandbox: { retryable: false, description: "Codex 沙箱阻擋" },
  session_not_found: { retryable: false, description: "Session 遺失" },
  command_not_found: { retryable: false, description: "opencode.cmd 不存在" },
  invalid_arguments: { retryable: false, description: "CLI 參數錯誤" },
  timeout: { retryable: true, description: "執行逾時" },
  invalid_response: { retryable: false, description: "回應格式不符預期" },
  invalid_config: { retryable: false, description: "設定檔錯誤" },
  environment_error: { retryable: false, description: "環境問題" },
  unknown: { retryable: false, description: "無法判定" },
}

// ─── stderr 關鍵字匹配表 ──────────────────────────────────────────
// 按優先序排列（先匹配先生效）

const STDERR_PATTERNS = [
  // Auth
  { pattern: /invalid[_ ]api[_ ]key/i, errorType: "auth_invalid", confidence: "high" },
  { pattern: /unauthorized/i, errorType: "auth_invalid", confidence: "high" },
  { pattern: /authentication/i, errorType: "auth_invalid", confidence: "medium" },

  // Rate limit (check specific types first)
  { pattern: /token[_ ]rate[_ ]limit/i, errorType: "token_rate_limit", confidence: "high" },
  { pattern: /tpm[_ ]exceeded/i, errorType: "token_rate_limit", confidence: "high" },
  { pattern: /concurrency[_ ]limit/i, errorType: "concurrency_limit", confidence: "high" },
  { pattern: /too[_ ]many[_ ]concurrent/i, errorType: "concurrency_limit", confidence: "medium" },
  { pattern: /rate[_ ]limit[_ ]exceeded/i, errorType: "rate_limit", confidence: "high" },
  { pattern: /rate[_ ]limit/i, errorType: "rate_limit", confidence: "high" },
  { pattern: /too[_ ]many[_ ]requests/i, errorType: "rate_limit", confidence: "high" },
  { pattern: /429/i, errorType: "rate_limit", confidence: "medium" },

  // Model
  { pattern: /model.{0,30}(overloaded|busy|unavailable)/i, errorType: "model_capacity", confidence: "high" },
  { pattern: /model.{0,30}(not\s*found|does\s*not\s*exist|unknown)/i, errorType: "model_unavailable", confidence: "high" },
  { pattern: /model[_ ]access[_ ]denied/i, errorType: "permission_denied", confidence: "high" },

  // Network
  { pattern: /fetch[_ ]failed/i, errorType: "network", confidence: "medium" },
  { pattern: /ECONNREFUSED/i, errorType: "network", confidence: "high" },
  { pattern: /ETIMEDOUT/i, errorType: "network", confidence: "high" },
  { pattern: /ENOTFOUND/i, errorType: "network", confidence: "high" },
  { pattern: /connect[_ ]timeout/i, errorType: "network", confidence: "high" },
  { pattern: /network/i, errorType: "network", confidence: "low" },

  // Sandbox
  { pattern: /restricted[_ ]codex[_ ]environment/i, errorType: "sandbox", confidence: "high" },
  { pattern: /session[_ ]not[_ ]found/i, errorType: "session_not_found", confidence: "medium" },

  // Session
  { pattern: /expected\s+a\s+string\s+starting\s+with\s+"ses"/i, errorType: "session_not_found", confidence: "high" },
  { pattern: /session\s+not\s+found/i, errorType: "session_not_found", confidence: "medium" },

  // Config
  { pattern: /config.{0,30}(invalid|error|missing)/i, errorType: "invalid_config", confidence: "medium" },

  // Command
  { pattern: /not\s+recognized\s+as/i, errorType: "command_not_found", confidence: "high" },
  { pattern: /not\s+found.{0,20}(command|program)/i, errorType: "command_not_found", confidence: "high" },
]

// ─── Structured body provider codes ────────────────────────────────

const PROVIDER_CODE_MAP = {
  // Auth
  invalid_api_key: "auth_invalid",
  authentication_error: "auth_invalid",

  // Rate limit sub-types
  rate_limit_exceeded: "rate_limit",
  token_rate_limit_exceeded: "token_rate_limit",
  concurrency_limit_exceeded: "concurrency_limit",

  // Quota
  quota_exceeded: "quota_exhausted",
  insufficient_quota: "quota_exhausted",

  // Model
  model_overloaded: "model_capacity",
  model_not_found: "model_unavailable",
  model_access_denied: "permission_denied",

  // Permission
  permission_denied: "permission_denied",
  access_denied: "permission_denied",
}

// ─── HTTP status code mapping ──────────────────────────────────────

const HTTP_STATUS_MAP = {
  401: "auth_invalid",
  403: "permission_denied",
  404: "model_unavailable",
  402: "billing_limit",
  429: "rate_limit",
  503: "model_capacity",
}

// ─── 主分類函式 ────────────────────────────────────────────────────

/**
 * @param {Object} raw
 * @param {number} raw.exitCode
 * @param {string} raw.stdout
 * @param {string} raw.stderr
 * @param {Object|null} [raw.parsedBody] — parsed JSON from CLI output or API response
 * @param {number|null} [raw.httpStatus] — HTTP status code if available
 * @param {number|null} [raw.durationMs]
 * @param {boolean} [raw.timedOut]
 * @param {string|null} [raw.exitSignal] — e.g. 'SIGTERM', 'SIGKILL'
 * @returns {{
 *   error_type: ErrorType,
 *   confidence: 'high' | 'medium' | 'low',
 *   retryable: boolean,
 *   detail: string,
 *   http_status: number | null,
 *   provider_code: string | null,
 *   retry_after_ms: number | null,
 *   evidence: string[]
 * }}
 */
export function classifyOpenCodeError(raw) {
  const { exitCode, stdout = "", stderr = "", parsedBody = null, httpStatus = null, timedOut = false, exitSignal = null, durationMs = null } = raw

  const evidence = []
  let errorType = null
  let confidence = "low"
  let providerCode = null
  let retryAfterMs = null
  let derivedHttpStatus = httpStatus

  // ── Step 0: Timeout check ──
  if (timedOut) {
    errorType = "timeout"
    confidence = "high"
    evidence.push("timed_out:true")
  }

  // ── Step 1: Structured body ──
  if (!errorType && parsedBody) {
    const bodyError = parsedBody.error || parsedBody
    const code = bodyError?.code || bodyError?.type || ""
    const message = bodyError?.message || ""

    if (code && PROVIDER_CODE_MAP[code]) {
      errorType = PROVIDER_CODE_MAP[code]
      confidence = "high"
      providerCode = code
      evidence.push(`provider_code:${code}`)
    }

    if (!derivedHttpStatus && parsedBody.httpStatus) {
      derivedHttpStatus = parsedBody.httpStatus
    }
  }

  // ── Step 2: HTTP status ──
  if (!errorType && derivedHttpStatus && HTTP_STATUS_MAP[derivedHttpStatus]) {
    errorType = HTTP_STATUS_MAP[derivedHttpStatus]
    confidence = "high"
    evidence.push(`http_status:${derivedHttpStatus}`)
  }

  // ── Step 3: Provider code from body (if not matched above) ──
  if (!errorType && parsedBody) {
    const bodyError = parsedBody.error || parsedBody
    const code = bodyError?.code || bodyError?.type || ""
    if (code) {
      providerCode = code
      evidence.push(`provider_code_uncategorized:${code}`)
      // Generic categorization for unknown provider codes
      if (code.includes("rate")) {
        errorType = "rate_limit"
        confidence = "medium"
      } else if (code.includes("auth") || code.includes("key")) {
        errorType = "auth_invalid"
        confidence = "medium"
      } else if (code.includes("model")) {
        errorType = "model_unavailable"
        confidence = "medium"
      }
    }
  }

  // ── Step 4: stdout high-confidence patterns (check before stderr) ──
  if (!errorType && stdout) {
    if (/Exporting session:/.test(stdout) && /Session not found/.test(stderr)) {
      errorType = "session_not_found"
      confidence = "high"
      evidence.push("stdout_export_session_not_found")
    }
    if (/Error:/.test(stdout) && /Session not found/.test(stdout)) {
      errorType = "session_not_found"
      confidence = "high"
      evidence.push("stdout_session_not_found")
    }
  }

  // ── Step 5: stderr keyword matching ──
  if (!errorType && stderr) {
    for (const { pattern, errorType: matchedType, confidence: matchedConfidence } of STDERR_PATTERNS) {
      if (pattern.test(stderr)) {
        errorType = matchedType
        confidence = matchedConfidence
        evidence.push(`stderr_pattern:${pattern.source}`)
        break
      }
    }
  }

  // Plain-text quota/billing words are not proof of account exhaustion.
  // OpenCode can emit these words for model routing, plan, or environment
  // messages; only structured provider codes or HTTP 402 may claim billing.
  if (!errorType && /\b(?:quota|credit|billing)\b/i.test(stderr)) {
    evidence.push("ambiguous_quota_text_unverified")
  }

  // ── Step 6: Exit signal ──
  if (!errorType && exitSignal) {
    if (exitSignal === "SIGTERM" || exitSignal === "SIGKILL") {
      errorType = "timeout"
      confidence = "medium"
      evidence.push(`exit_signal:${exitSignal}`)
    }
  }

  // ── Step 7: Exit code (lowest priority) ──
  if (!errorType && exitCode !== 0 && exitCode !== null) {
    if (exitCode === 2) {
      errorType = "invalid_arguments"
      confidence = "medium"
      evidence.push("exit_code:2")
    } else if (exitCode === 127 || exitCode === 9009) {
      errorType = "command_not_found"
      confidence = "medium"
      evidence.push(`exit_code:${exitCode}`)
    }
  }

  // ── Step 8: Fallback ──
  if (!errorType) {
    if (exitCode === 0) {
      // No error
      return null
    }
    errorType = "unknown"
    confidence = "low"
    evidence.push("fallback:unknown")
  }

  // ── Build retry_after_ms ──
  if (parsedBody) {
    const retryAfter = parsedBody.retry_after || parsedBody.retryAfter || parsedBody.error?.retry_after
    if (typeof retryAfter === "number") {
      retryAfterMs = retryAfter * 1000
    } else if (typeof retryAfter === "string") {
      const parsed = parseInt(retryAfter, 10)
      if (!isNaN(parsed)) retryAfterMs = parsed * 1000
    }
  }

  // ── Derive retryable from ERROR_TYPE_META ──
  const meta = ERROR_TYPE_META[errorType]
  const retryable = meta?.retryable ?? false

  // ── Build detail ──
  const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, "")
  let detail = meta?.description || "Unknown error"
  if (parsedBody?.error?.message) {
    detail = stripAnsi(parsedBody.error.message)
  } else if (stderr) {
    // Use first line of stderr as detail
    const firstLine = stderr.split("\n").find((l) => l.trim().length > 0)
    if (firstLine) {
      detail = stripAnsi(firstLine.replace(/^\[91m\[1mError: ?\[0m\s*/, "").trim())
    }
  }

  return {
    error_type: errorType,
    confidence,
    retryable,
    detail,
    http_status: derivedHttpStatus,
    provider_code: providerCode,
    retry_after_ms: retryAfterMs,
    evidence,
  }
}
