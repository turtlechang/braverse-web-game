#!/usr/bin/env node
/**
 * OpenCode Go Wrapper
 *
 * 承擔參數解析、環境設定、preflight、日誌、分類與 JSON 輸出。
 * opencode-go.cmd 僅作薄啟動器呼叫本檔案。
 *
 * 重要：本檔案直接呼叫底層 OpenCode CLI 絕對路徑，
 *        不得再次呼叫 scripts/opencode-go.cmd（防遞迴）。
 */

import { spawn } from "node:child_process"
import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs"
import { resolve, dirname, normalize, basename } from "node:path"
import { fileURLToPath } from "node:url"
import { createHealthChecker } from "./opencode-go-health-check.mjs"
import { classifyOpenCodeError } from "./lib/classify-opencode-error.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, "..")

// ─── Recursion Detection ───────────────────────────────────────────

function normalizePath(p) {
  return normalize(resolve(p)).toLowerCase()
}

function findWrapperPath() {
  return normalizePath(fileURLToPath(import.meta.url))
}

function findUnderlyingCli() {
  // Check PATH first
  const pathDirs = (process.env.PATH || "").split(";").filter(Boolean)
  for (const dir of pathDirs) {
    const candidate = resolve(dir, "opencode.cmd")
    if (existsSync(candidate)) return candidate
  }

  // Check %APPDATA%\npm
  const appdataCmd = resolve(process.env.APPDATA || "", "npm", "opencode.cmd")
  if (existsSync(appdataCmd)) return appdataCmd

  return null
}

function assertNoRecursion(cliPath) {
  const wrapperPath = findWrapperPath()
  const normalizedCli = normalizePath(cliPath)

  if (normalizedCli === wrapperPath) {
    throw new Error(
      "Wrapper recursion detected: underlying CLI resolves to opencode-go-wrapper.mjs. " +
      "Ensure the wrapper calls the real opencode.cmd, not itself."
    )
  }

  // Also check if CLI resolves to opencode-go.cmd
  const opencodeGoCmd = normalizePath(resolve(__dirname, "opencode-go.cmd"))
  if (normalizedCli === opencodeGoCmd) {
    throw new Error(
      "Wrapper recursion detected: underlying CLI resolves to opencode-go.cmd. " +
      "The wrapper must call the underlying opencode.cmd directly."
    )
  }
}

// ─── Sensitive Data Redaction ───────────────────────────────────────

function redactString(str) {
  if (!str || typeof str !== "string") return str
  // Redact API key patterns
  return str
    .replace(/Bearer\s+[A-Za-z0-9\-_.]+/g, "Bearer [REDACTED]")
    .replace(/OPENCODE_GO_API_KEY[=:]\s*\S+/gi, "OPENCODE_GO_API_KEY=[REDACTED]")
    .replace(/[a-f0-9]{32,}/gi, "[REDACTED]")
}

function redactCommand(args) {
  return args.map((arg, i) => {
    if (i === 0) return arg // Don't redact the command itself
    if (arg.length > 20 && /^[a-f0-9\-_]{20,}$/i.test(arg)) return "[REDACTED]"
    return arg
  })
}

// ─── Argument Parsing ───────────────────────────────────────────────

function parseArgs(argv) {
  const result = {
    preflight: false,
    checkInference: false,
    jsonError: false,
    logDir: null,
    verbose: false,
    cliArgs: [],
  }

  let i = 0
  while (i < argv.length) {
    const arg = argv[i]
    if (arg === "--preflight") {
      result.preflight = true
    } else if (arg === "--check-inference") {
      result.checkInference = true
    } else if (arg === "--json-error") {
      result.jsonError = true
    } else if (arg === "--log-dir" && i + 1 < argv.length) {
      result.logDir = argv[++i]
    } else if (arg === "--verbose") {
      result.verbose = true
    } else {
      result.cliArgs.push(arg)
    }
    i++
  }

  return result
}

// ─── JSON Error Output ──────────────────────────────────────────────

function outputJsonError(errorType, detail, evidence, exitCode, command, durationMs, logs) {
  const error = {
    schema_version: "1.0",
    ok: false,
    error: {
      error_type: errorType.error_type,
      process_exit_code: exitCode,
      retryable: errorType.retryable,
      confidence: errorType.confidence,
      detail: errorType.detail || detail,
      http_status: errorType.http_status,
      provider_code: errorType.provider_code,
      retry_after_ms: errorType.retry_after_ms,
      evidence: errorType.evidence || evidence,
    },
    execution: {
      command: redactCommand(command).join(" "),
      started_at: new Date().toISOString(),
      duration_ms: durationMs,
    },
    logs: {
      stdout_path: logs?.stdoutPath || null,
      stderr_path: logs?.stderrPath || null,
    },
  }

  process.stderr.write(JSON.stringify(error, null, 2) + "\n")
}

// ─── Log Saving ─────────────────────────────────────────────────────

function saveLogs(logDir, stdout, stderr, metadata) {
  if (!logDir) return { stdoutPath: null, stderrPath: null }

  try {
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true })
    }

    const ts = new Date().toISOString().replace(/[:.]/g, "-")
    const stdoutPath = resolve(logDir, `opencode-go-${ts}-stdout.log`)
    const stderrPath = resolve(logDir, `opencode-go-${ts}-stderr.log`)
    const metadataPath = resolve(logDir, `opencode-go-${ts}-metadata.json`)

    writeFileSync(stdoutPath, redactString(stdout), "utf-8")
    writeFileSync(stderrPath, redactString(stderr), "utf-8")
    writeFileSync(metadataPath, JSON.stringify({
      ...metadata,
      stdout: "[redacted]",
      stderr: "[redacted]",
    }, null, 2), "utf-8")

    return { stdoutPath, stderrPath }
  } catch {
    return { stdoutPath: null, stderrPath: null }
  }
}

// ─── CLI Execution ──────────────────────────────────────────────────

function runCli(cliPath, args, env, timeoutMs = 300_000) {
  return new Promise((resolve) => {
    let stdout = ""
    let stderr = ""
    let finished = false
    const startTime = Date.now()

    const isWin = process.platform === "win32"
    const effectiveCli = isWin ? "cmd.exe" : cliPath
    const effectiveArgs = isWin ? ["/d", "/s", "/c", cliPath, ...args] : args

    const proc = spawn(effectiveCli, effectiveArgs, {
      env: { ...env },
      stdio: ["ignore", "pipe", "pipe"],
      shell: false,
    })

    const timeoutId = setTimeout(() => {
      if (finished) return
      finished = true
      proc.kill()
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + "\n[wrapper] Process killed due to timeout.",
        durationMs: Date.now() - startTime,
        timedOut: true,
        exitSignal: null,
      })
    }, timeoutMs)

    proc.stdout?.on("data", (data) => { stdout += data.toString() })
    proc.stderr?.on("data", (data) => { stderr += data.toString() })

    proc.on("error", (err) => {
      if (finished) return
      finished = true
      clearTimeout(timeoutId)
      resolve({
        exitCode: 1,
        stdout,
        stderr: stderr + "\n" + err.message,
        durationMs: Date.now() - startTime,
        timedOut: false,
        exitSignal: null,
      })
    })

    proc.on("close", (code, signal) => {
      if (finished) return
      finished = true
      clearTimeout(timeoutId)
      resolve({
        exitCode: code,
        stdout,
        stderr,
        durationMs: Date.now() - startTime,
        timedOut: false,
        exitSignal: signal,
      })
    })
  })
}

// ─── Main ───────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs(process.argv.slice(2))

  // Find and validate underlying CLI
  const cliPath = findUnderlyingCli()
  if (!cliPath) {
    const msg = "opencode.cmd not found in PATH or %APPDATA%\\npm."
    if (opts.jsonError) {
      outputJsonError(
        { error_type: "command_not_found", retryable: false, confidence: "high", detail: msg, evidence: ["cli_not_found"] },
        msg, [], 127, process.argv, 0, {}
      )
    } else {
      process.stderr.write(`[opencode-go] ERROR: ${msg}\n`)
    }
    process.exit(127)
  }

  assertNoRecursion(cliPath)

  // Pre-flight checks
  if (opts.preflight || opts.checkInference) {
    const checker = createHealthChecker()
    const result = await checker.check({
      level: "all",
      checkInference: opts.checkInference,
      noCache: false,
    })
    console.log(JSON.stringify(result, null, 2))
    process.exit(result.overall.ok ? 0 : 1)
  }

  // Must have CLI args for actual dispatch
  if (opts.cliArgs.length === 0) {
    process.stderr.write("[opencode-go] ERROR: No arguments provided. Use --preflight for health check.\n")
    process.exit(1)
  }

  // Execute CLI
  const env = { ...process.env }
  const result = await runCli(cliPath, opts.cliArgs, env)

  // Save logs if requested
  let logs = { stdoutPath: null, stderrPath: null }
  if (opts.logDir) {
    logs = saveLogs(opts.logDir, result.stdout, result.stderr, {
      cli: cliPath,
      args: redactCommand(opts.cliArgs),
      exitCode: result.exitCode,
      durationMs: result.durationMs,
    })
  }

  // Output
  if (result.exitCode === 0) {
    // Success: pass through stdout
    process.stdout.write(result.stdout)
    if (result.stderr) {
      process.stderr.write(result.stderr)
    }
  } else {
    // Error: classify and output
    const classification = classifyOpenCodeError({
      exitCode: result.exitCode,
      stdout: result.stdout,
      stderr: result.stderr,
      timedOut: result.timedOut,
      exitSignal: result.exitSignal,
      durationMs: result.durationMs,
    })

    if (opts.jsonError && classification) {
      outputJsonError(classification, classification.detail, classification.evidence, result.exitCode, process.argv, result.durationMs, logs)
    } else {
      // Human-readable error
      const errType = classification?.error_type || "unknown"
      const detail = classification?.detail || result.stderr.split("\n")[0] || "Unknown error"
      process.stderr.write(`[opencode-go] ERROR (${errType}): ${detail}\n`)
      if (result.stderr && !opts.jsonError) {
        process.stderr.write(result.stderr + "\n")
      }
    }
  }

  process.exit(result.exitCode ?? 1)
}

main().catch((err) => {
  process.stderr.write(`[opencode-go] FATAL: ${err.message}\n`)
  process.exit(1)
})
