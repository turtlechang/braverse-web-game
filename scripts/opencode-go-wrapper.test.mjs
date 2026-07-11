import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync } from "node:fs"
import { resolve, dirname, normalize } from "node:path"
import { fileURLToPath } from "node:url"
import { classifyOpenCodeError, ERROR_TYPE_META } from "./lib/classify-opencode-error.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))

// ─── Schema Validation ──────────────────────────────────────────────

describe("opencode-go-error.schema.json", () => {
  const schemaPath = resolve(__dirname, "../schemas/opencode-go-error.schema.json")

  it("schema file exists and is valid JSON", () => {
    const raw = readFileSync(schemaPath, "utf-8")
    const schema = JSON.parse(raw)
    assert.equal(schema.$schema, "http://json-schema.org/draft-07/schema#")
    assert.equal(schema.properties.schema_version.const, "1.0")
    assert.equal(schema.properties.ok.const, false)
  })

  it("error_type enum matches ERROR_TYPE_META keys", () => {
    const schema = JSON.parse(readFileSync(schemaPath, "utf-8"))
    const schemaTypes = schema.properties.error.properties.error_type.enum

    const metaTypes = Object.keys(ERROR_TYPE_META).sort()
    const schemaTypesSorted = [...schemaTypes].sort()

    assert.deepEqual(schemaTypesSorted, metaTypes, "Schema error_type enum must match ERROR_TYPE_META keys")
  })
})

// ─── Recursion Detection ────────────────────────────────────────────

describe("recursion detection", () => {
  it("wrapper path does not equal underlying CLI path", () => {
    const wrapperPath = normalize(resolve(fileURLToPath(import.meta.url))).toLowerCase()
    const appdataCmd = normalize(resolve(process.env.APPDATA || "", "npm", "opencode.cmd")).toLowerCase()

    assert.notEqual(wrapperPath, appdataCmd, "wrapper must not resolve to opencode.cmd")
  })
})

// ─── Classifier Integration ─────────────────────────────────────────

describe("classifier integration with wrapper errors", () => {
  it("classifies command_not_found correctly", () => {
    const result = classifyOpenCodeError({
      exitCode: 127,
      stdout: "",
      stderr: "'opencode' is not recognized as an internal or external command",
    })
    assert.equal(result.error_type, "command_not_found")
    assert.equal(result.retryable, false)
  })

  it("classifies timeout correctly", () => {
    const result = classifyOpenCodeError({
      exitCode: 1,
      stdout: "",
      stderr: "",
      timedOut: true,
    })
    assert.equal(result.error_type, "timeout")
    assert.equal(result.retryable, true)
  })

  it("classifies network error correctly", () => {
    const result = classifyOpenCodeError({
      exitCode: 1,
      stdout: "",
      stderr: "Error: fetch failed\nCause: connect ECONNREFUSED 127.0.0.1:443",
    })
    assert.equal(result.error_type, "network")
    assert.equal(result.retryable, true)
  })

  it("produces snake_case output", () => {
    const result = classifyOpenCodeError({
      exitCode: 1,
      stdout: "",
      stderr: "Error: Invalid API key provided.",
    })
    assert.ok("error_type" in result, "should have error_type (snake_case)")
    assert.ok("http_status" in result, "should have http_status (snake_case)")
    assert.ok("provider_code" in result, "should have provider_code (snake_case)")
    assert.ok("retry_after_ms" in result, "should have retry_after_ms (snake_case)")
    assert.ok(!("errorType" in result), "should not have errorType (camelCase)")
    assert.ok(!("httpStatus" in result), "should not have httpStatus (camelCase)")
    assert.ok(!("providerCode" in result), "should not have providerCode (camelCase)")
    assert.ok(!("retryAfterMs" in result), "should not have retryAfterMs (camelCase)")
  })
})

// ─── Sensitive Data Redaction ───────────────────────────────────────

describe("redaction patterns", () => {
  it("redacts Bearer tokens", () => {
    const input = "Authorization: Bearer sk-abc123def456ghi789"
    const redacted = input.replace(/Bearer\s+[A-Za-z0-9\-_.]+/g, "Bearer [REDACTED]")
    assert.ok(!redacted.includes("sk-abc123"))
    assert.ok(redacted.includes("[REDACTED]"))
  })

  it("redacts long hex strings", () => {
    const input = "token: abcdef0123456789abcdef0123456789"
    const redacted = input.replace(/[a-f0-9]{32,}/gi, "[REDACTED]")
    assert.ok(!redacted.includes("abcdef0123456789"))
    assert.ok(redacted.includes("[REDACTED]"))
  })
})

// ─── Schema Structure Validation ────────────────────────────────────

describe("error output conforms to schema structure", () => {
  const schema = JSON.parse(readFileSync(resolve(__dirname, "../schemas/opencode-go-error.schema.json"), "utf-8"))
  const validErrorTypes = schema.properties.error.properties.error_type.enum

  function validateErrorOutput(obj) {
    const errors = []

    // Top-level
    if (obj.schema_version !== "1.0") errors.push("schema_version must be '1.0'")
    if (obj.ok !== false) errors.push("ok must be false")
    if (typeof obj.error !== "object" || obj.error === null) errors.push("error must be object")
    if (typeof obj.execution !== "object" || obj.execution === null) errors.push("execution must be object")
    if (typeof obj.logs !== "object" || obj.logs === null) errors.push("logs must be object")

    // error
    if (obj.error) {
      if (!validErrorTypes.includes(obj.error.error_type)) errors.push(`error_type '${obj.error.error_type}' not in enum`)
      if (typeof obj.error.process_exit_code !== "number" && obj.error.process_exit_code !== null) errors.push("process_exit_code must be number|null")
      if (typeof obj.error.retryable !== "boolean") errors.push("retryable must be boolean")
      if (!["high", "medium", "low"].includes(obj.error.confidence)) errors.push("confidence must be high|medium|low")
      if (typeof obj.error.detail !== "string") errors.push("detail must be string")
      if (!Array.isArray(obj.error.evidence)) errors.push("evidence must be array")
    }

    // execution
    if (obj.execution) {
      if (typeof obj.execution.command !== "string") errors.push("execution.command must be string")
      if (typeof obj.execution.started_at !== "string") errors.push("execution.started_at must be string")
      if (typeof obj.execution.duration_ms !== "number") errors.push("execution.duration_ms must be number")
    }

    // logs
    if (obj.logs) {
      if (obj.logs.stdout_path !== null && typeof obj.logs.stdout_path !== "string") errors.push("logs.stdout_path must be string|null")
      if (obj.logs.stderr_path !== null && typeof obj.logs.stderr_path !== "string") errors.push("logs.stderr_path must be string|null")
    }

    return errors
  }

  it("validates a sample auth_missing error", () => {
    const output = {
      schema_version: "1.0",
      ok: false,
      error: {
        error_type: "auth_missing",
        process_exit_code: 1,
        retryable: false,
        confidence: "high",
        detail: "API key not set",
        http_status: null,
        provider_code: null,
        retry_after_ms: null,
        evidence: ["environment_variable_missing"],
      },
      execution: {
        command: "opencode run --model [REDACTED] [PROMPT_REDACTED]",
        started_at: "2026-07-11T00:00:00.000Z",
        duration_ms: 100,
      },
      logs: { stdout_path: null, stderr_path: null },
    }
    const errors = validateErrorOutput(output)
    assert.deepEqual(errors, [], `Validation errors: ${errors.join(", ")}`)
  })

  it("validates a sample rate_limit error", () => {
    const output = {
      schema_version: "1.0",
      ok: false,
      error: {
        error_type: "rate_limit",
        process_exit_code: 1,
        retryable: true,
        confidence: "high",
        detail: "Rate limit exceeded",
        http_status: 429,
        provider_code: "rate_limit_exceeded",
        retry_after_ms: 30000,
        evidence: ["http_status:429", "provider_code:rate_limit_exceeded"],
      },
      execution: {
        command: "opencode run --model [REDACTED] [PROMPT_REDACTED]",
        started_at: "2026-07-11T00:00:00.000Z",
        duration_ms: 500,
      },
      logs: { stdout_path: "/tmp/stdout.log", stderr_path: "/tmp/stderr.log" },
    }
    const errors = validateErrorOutput(output)
    assert.deepEqual(errors, [], `Validation errors: ${errors.join(", ")}`)
  })

  it("rejects output with invalid error_type", () => {
    const output = {
      schema_version: "1.0",
      ok: false,
      error: {
        error_type: "invalid_type_that_does_not_exist",
        process_exit_code: 1,
        retryable: false,
        confidence: "high",
        detail: "test",
        evidence: [],
      },
      execution: { command: "test", started_at: "2026-01-01T00:00:00Z", duration_ms: 0 },
      logs: { stdout_path: null, stderr_path: null },
    }
    const errors = validateErrorOutput(output)
    assert.ok(errors.length > 0, "should reject invalid error_type")
  })

  it("rejects output with missing required fields", () => {
    const output = {
      schema_version: "1.0",
      ok: false,
      error: { error_type: "unknown" }, // missing required fields
      execution: {},
      logs: {},
    }
    const errors = validateErrorOutput(output)
    assert.ok(errors.length > 0, "should reject incomplete output")
  })
})
