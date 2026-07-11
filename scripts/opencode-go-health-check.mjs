#!/usr/bin/env node
/**
 * OpenCode Go 健康檢查工具
 *
 * 分級健康檢查：Level 1 (Local) + Level 2 (Connectivity) 預設執行，
 * Level 3 (Inference) 需 --check-inference 參數。
 *
 * 使用方式：
 *   node scripts/opencode-go-health-check.mjs                    # Level 1+2
 *   node scripts/opencode-go-health-check.mjs --check-inference  # Level 1+2+3
 *   node scripts/opencode-go-health-check.mjs --level local      # 僅 Level 1
 *   node scripts/opencode-go-health-check.mjs --no-cache         # 略過快取
 */

import { readFileSync, existsSync, writeFileSync, mkdirSync } from "node:fs"
import { execSync } from "node:child_process"
import { resolve, dirname, join } from "node:path"
import { fileURLToPath } from "node:url"

const __dirname = dirname(fileURLToPath(import.meta.url))
const PROJECT_ROOT = resolve(__dirname, "../..")

// ─── Dependency Injection Container ─────────────────────────────────

/**
 * @param {Object} deps
 * @param {typeof import("node:fs").existsSync} [deps.existsSync]
 * @param {typeof import("node:fs").readFileSync} [deps.readFileSync]
 * @param {typeof import("node:fs").writeFileSync} [deps.writeFileSync]
 * @param {typeof import("node:fs").mkdirSync} [deps.mkdirSync]
 * @param {typeof import("node:child_process").execSync} [deps.execSync]
 * @param {typeof fetch} [deps.fetchFn]
 * @param {() => number} [deps.clock]
 */
export function createHealthChecker(deps = {}) {
  const {
    existsSync: existsFn = existsSync,
    readFileSync: readFn = readFileSync,
    writeFileSync: writeFn = writeFileSync,
    mkdirSync: mkdirFn = mkdirSync,
    execSync: execFn = execSync,
    fetchFn = globalThis.fetch,
    clock = () => Date.now(),
  } = deps

  const configPath = resolve(__dirname, "opencode-go.config.json")
  const cacheDir = resolve(PROJECT_ROOT, ".opencode-runtime")
  const cacheFile = join(cacheDir, "health-cache.json")
  const CACHE_TTL_MS = 300_000 // 5 minutes

  // ── Helpers ──

  function loadConfig() {
    try {
      if (!existsFn(configPath)) return null
      return JSON.parse(readFn(configPath, "utf-8"))
    } catch {
      return null
    }
  }

  function getApiBaseUrl(config) {
    return config?.provider?.["opencode-go"]?.options?.baseURL || null
  }

  function readCache() {
    try {
      if (!existsFn(cacheFile)) return null
      return JSON.parse(readFn(cacheFile, "utf-8"))
    } catch {
      return null
    }
  }

  function writeCache(data) {
    try {
      if (!existsFn(cacheDir)) {
        mkdirFn(cacheDir, { recursive: true })
      }
      writeFn(cacheFile, JSON.stringify(data, null, 2), "utf-8")
    } catch {
      // Cache write failure is non-fatal
    }
  }

  function findOpenCodeCmd() {
    // Check PATH first
    try {
      const result = execFn("where opencode.cmd", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim()
      if (result) return result.split("\n")[0].trim()
    } catch { /* not found in PATH */ }

    // Check %APPDATA%\npm
    const appdataCmd = join(process.env.APPDATA || "", "npm", "opencode.cmd")
    if (existsFn(appdataCmd)) return appdataCmd

    return null
  }

  function findNodeVersion() {
    try {
      return execFn("node --version", { encoding: "utf-8", stdio: ["pipe", "pipe", "pipe"] }).trim()
    } catch {
      return null
    }
  }

  // ── Level 1: Local ──

  function checkLocal() {
    const checks = {}

    // Node.js
    const nodeVersion = findNodeVersion()
    checks.node = { ok: !!nodeVersion, version: nodeVersion || undefined }

    // opencode.cmd
    const openCodePath = findOpenCodeCmd()
    checks.opencode_cmd = { ok: !!openCodePath, path: openCodePath || undefined }

    // API Key
    const apiKey = process.env.OPENCODE_GO_API_KEY
    const present = !!apiKey
    const plausible = present && apiKey.length > 10 && !/\s/.test(apiKey)
    checks.api_key = { present, plausible }

    // Config file
    const config = loadConfig()
    checks.config = { ok: !!config, path: existsFn(configPath) ? configPath : undefined }

    const ok = checks.node.ok && checks.opencode_cmd.ok && checks.api_key.present && checks.config.ok

    return { ok, checks }
  }

  // ── Level 2: Connectivity ──

  async function checkConnectivity(config) {
    const checks = {}
    const baseUrl = getApiBaseUrl(config)

    if (!baseUrl) {
      return {
        ok: null,
        skipped: true,
        reason: "no_endpoint_configured",
        checks: { dns: { ok: null, skipped: true }, https: { ok: null, skipped: true }, credentials: { accepted: null } },
      }
    }

    // DNS
    try {
      const url = new URL(baseUrl)
      // Simple DNS check via fetch (will fail fast if DNS fails)
      checks.dns = { ok: true, host: url.hostname }
    } catch {
      checks.dns = { ok: false, host: null }
    }

    // HTTPS endpoint
    try {
      const response = await fetchFn(baseUrl.replace(/\/v1\/?$/, "/models"), {
        method: "GET",
        headers: {
          Authorization: `Bearer ${process.env.OPENCODE_GO_API_KEY || ""}`,
        },
        signal: AbortSignal.timeout(10_000),
      })
      const probeRouteSupported = response.ok || response.status === 401
      const probeReachable = probeRouteSupported || response.status === 404 || response.status === 405
      checks.https = {
        ok: probeReachable,
        status: response.status,
        probe_route_supported: probeRouteSupported,
      }

      // Credentials check (only if we got a non-401 response)
      if (response.status === 200) {
        checks.credentials = { accepted: true }
      } else if (response.status === 401) {
        checks.credentials = { accepted: false }
      } else if (response.status === 404 || response.status === 405) {
        checks.credentials = {
          accepted: null,
          reason: "probe_route_not_supported",
        }
      } else {
        checks.credentials = { accepted: null }
      }
    } catch (err) {
      checks.https = { ok: false, error: err.message }
      checks.credentials = { accepted: null }
    }

    const ok =
      checks.dns?.ok === true &&
      checks.https?.ok === true &&
      checks.credentials?.accepted !== false

    return { ok, checks }
  }

  // ── Level 3: Inference ──

  async function checkInference(config, noCache = false) {
    // Check cache first
    if (!noCache) {
      const cache = readCache()
      if (cache?.inference?.ok === true && cache?.inference?.checked_at) {
        const elapsed = clock() - new Date(cache.inference.checked_at).getTime()
        if (elapsed < CACHE_TTL_MS) {
          return {
            ok: true,
            cached: true,
            checked_at: cache.inference.checked_at,
            duration_ms: 0,
          }
        }
      }
    }

    const baseUrl = getApiBaseUrl(config)
    if (!baseUrl) {
      return { ok: null, skipped: true, reason: "no_endpoint_configured", cached: false }
    }

    const model = config?.model || "opencode-go/deepseek-v4-flash"
    const startTime = clock()

    try {
      const response = await fetchFn(`${baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENCODE_GO_API_KEY || ""}`,
        },
        body: JSON.stringify({
          model: model.replace("opencode-go/", ""),
          messages: [{ role: "user", content: "Hi" }],
          max_tokens: 1,
          stream: false,
        }),
        signal: AbortSignal.timeout(15_000),
      })

      const durationMs = clock() - startTime

      if (response.ok) {
        const result = { ok: true, cached: false, checked_at: new Date().toISOString(), duration_ms: durationMs }
        writeCache({ inference: result })
        return result
      }

      return { ok: false, cached: false, http_status: response.status, duration_ms: durationMs }
    } catch (err) {
      return { ok: false, cached: false, error: err.message, duration_ms: clock() - startTime }
    }
  }

  // ── Main ──

  async function check(options = {}) {
    const { level = "all", checkInference: wantInference = false, noCache = false } = options

    const config = loadConfig()
    const result = {
      schema_version: "1.0",
      checked_at: new Date().toISOString(),
      levels: {},
      overall: { ok: false, ready: false },
    }

    // Level 1
    if (level === "all" || level === "local") {
      result.levels.local = checkLocal()
    }

    // Level 2
    if (level === "all" || level === "connectivity") {
      result.levels.connectivity = await checkConnectivity(config)
    }

    // Level 3
    if (wantInference && (level === "all" || level === "inference")) {
      result.levels.inference = await checkInference(config, noCache)
    } else if (level === "all" || level === "inference") {
      result.levels.inference = { ok: null, skipped: true, reason: "use --check-inference to enable", cached: false }
    }

    // Overall
    const localOk = result.levels.local?.ok ?? true
    const connOk = result.levels.connectivity?.ok !== false
    const inferOk = result.levels.inference?.ok !== false
    result.overall = { ok: localOk && connOk && inferOk, ready: localOk && connOk }

    return result
  }

  return { check, checkLocal, checkConnectivity, checkInference, loadConfig, findOpenCodeCmd }
}

// ─── CLI Entry Point ────────────────────────────────────────────────

async function main() {
  const args = process.argv.slice(2)
  const wantInference = args.includes("--check-inference")
  const noCache = args.includes("--no-cache")
  const levelIdx = args.indexOf("--level")
  const level = levelIdx >= 0 ? args[levelIdx + 1] : "all"

  const checker = createHealthChecker()
  const result = await checker.check({ level, checkInference: wantInference, noCache })

  console.log(JSON.stringify(result, null, 2))

  process.exit(result.overall.ok ? 0 : 1)
}

// Only run CLI when executed directly (not imported by tests)
const isCliEntry = process.argv[1] &&
  (process.argv[1].endsWith("opencode-go-health-check.mjs") ||
   process.argv[1].endsWith("opencode-go-health-check.js"))

if (isCliEntry) {
  main().catch((err) => {
    console.error(JSON.stringify({
      schema_version: "1.0",
      checked_at: new Date().toISOString(),
      levels: {},
      overall: { ok: false, ready: false },
      error: err.message,
    }, null, 2))
    process.exit(1)
  })
}
