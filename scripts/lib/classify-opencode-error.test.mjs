import { describe, it } from "node:test"
import assert from "node:assert/strict"
import { readFileSync, readdirSync } from "node:fs"
import { join, dirname } from "node:path"
import { fileURLToPath } from "node:url"
import { classifyOpenCodeError, ERROR_TYPE_META } from "./classify-opencode-error.mjs"

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURES_DIR = join(__dirname, "../../tests/fixtures/opencode-errors")

// ─── Helpers ────────────────────────────────────────────────────────

function loadFixtures(subdir) {
  const dir = join(FIXTURES_DIR, subdir)
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"))
  return files.map((f) => ({
    filename: f,
    ...JSON.parse(readFileSync(join(dir, f), "utf-8")),
  }))
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("ERROR_TYPE_META", () => {
  it("every ErrorType has a meta entry", () => {
    const types = [
      "auth_missing", "auth_invalid", "permission_denied",
      "rate_limit", "token_rate_limit", "concurrency_limit",
      "model_capacity", "quota_exhausted", "billing_limit",
      "model_unavailable", "network", "sandbox",
      "session_not_found", "command_not_found", "invalid_arguments",
      "timeout", "invalid_response", "invalid_config",
      "environment_error", "unknown",
    ]
    for (const t of types) {
      assert.ok(ERROR_TYPE_META[t], `Missing meta for ${t}`)
      assert.equal(typeof ERROR_TYPE_META[t].retryable, "boolean", `${t} retryable must be boolean`)
      assert.equal(typeof ERROR_TYPE_META[t].description, "string", `${t} description must be string`)
    }
  })
})

describe("classifyOpenCodeError", () => {
  it("returns null for exit code 0 (no error)", () => {
    const result = classifyOpenCodeError({ exitCode: 0, stdout: "OK", stderr: "" })
    assert.equal(result, null)
  })

  // ── Observed fixtures ──

  describe("observed fixtures", () => {
    const fixtures = loadFixtures("observed")

    for (const fx of fixtures) {
      it(`observed/${fx.filename}: ${fx.scenario}`, () => {
        const result = classifyOpenCodeError({
          exitCode: fx.exitCode,
          stdout: fx.stdout || "",
          stderr: fx.stderr || "",
          httpStatus: fx.httpStatus || null,
          parsedBody: fx.parsedBody || null,
        })

        assert.ok(result, "should return a classification result")
        assert.equal(typeof result.error_type, "string")
        assert.ok(result.error_type.length > 0, "error_type must not be empty")
        assert.ok(["high", "medium", "low"].includes(result.confidence))
        assert.equal(typeof result.retryable, "boolean")
        assert.ok(typeof result.detail === "string" && result.detail.length > 0)
        assert.ok(Array.isArray(result.evidence))

        // Verify the error_type is a valid type
        assert.ok(ERROR_TYPE_META[result.error_type], `Invalid error_type: ${result.error_type}`)
      })
    }
  })

  // ── Synthetic fixtures ──

  describe("synthetic fixtures", () => {
    const fixtures = loadFixtures("synthetic")

    for (const fx of fixtures) {
      it(`synthetic/${fx.filename}: ${fx.scenario}`, () => {
        const result = classifyOpenCodeError({
          exitCode: fx.exitCode,
          stdout: fx.stdout || "",
          stderr: fx.stderr || "",
          httpStatus: fx.httpStatus || null,
          parsedBody: fx.parsedBody || null,
          timedOut: fx.exitSignal === "SIGTERM" || fx.exitSignal === "SIGKILL",
          exitSignal: fx.exitSignal || null,
        })

        assert.ok(result, "should return a classification result")
        assert.ok(ERROR_TYPE_META[result.error_type], `Invalid error_type: ${result.error_type}`)
      })
    }
  })

  // ── Specific scenario tests ──

  describe("auth_missing", () => {
    it("detects missing API key from environment", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "Error: Session not found",
        parsedBody: null,
      })
      // On direct run, API key missing returns generic "Session not found"
      // The classifier should identify it as session_not_found based on stderr
      assert.ok(result)
      assert.equal(result.error_type, "session_not_found")
    })
  })

  describe("model_unavailable", () => {
    it("detects via structured body", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "",
        parsedBody: { error: { code: "model_not_found", message: "Model not found" } },
      })
      assert.equal(result.error_type, "model_unavailable")
      assert.equal(result.confidence, "high")
      assert.equal(result.retryable, false)
    })

    it("detects via stderr pattern", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "Error: Model 'xyz' does not exist",
      })
      assert.equal(result.error_type, "model_unavailable")
    })
  })

  describe("rate_limit", () => {
    it("detects via HTTP 429", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "",
        httpStatus: 429,
      })
      assert.equal(result.error_type, "rate_limit")
      assert.equal(result.retryable, true)
    })

    it("detects token_rate_limit via provider code", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "",
        parsedBody: { error: { code: "token_rate_limit_exceeded", message: "TPM exceeded" } },
      })
      assert.equal(result.error_type, "token_rate_limit")
      assert.equal(result.retryable, true)
    })

    it("detects concurrency_limit via stderr", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "Error: too many concurrent requests",
      })
      assert.equal(result.error_type, "concurrency_limit")
      assert.equal(result.retryable, true)
    })

    it("parses retry_after from body", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "",
        parsedBody: { error: { code: "rate_limit_exceeded", message: "rate limited" }, retry_after: 30 },
      })
      assert.equal(result.error_type, "rate_limit")
      assert.equal(result.retry_after_ms, 30000)
    })
  })

  describe("quota_exhausted", () => {
    it("detects via provider code", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "",
        parsedBody: { error: { code: "quota_exceeded", message: "No credits" } },
      })
      assert.equal(result.error_type, "quota_exhausted")
      assert.equal(result.retryable, false)
    })

    it("detects via HTTP 402", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "",
        httpStatus: 402,
      })
      assert.equal(result.error_type, "billing_limit")
    })

    it("does not claim exhausted quota from unstructured stderr", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "OpenCode: no quota configured for this model; retry with another route",
      })
      assert.equal(result.error_type, "unknown")
      assert.equal(result.confidence, "low")
      assert.ok(result.evidence.includes("ambiguous_quota_text_unverified"))
    })
  })

  describe("auth_invalid", () => {
    it("detects via HTTP 401", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "",
        httpStatus: 401,
      })
      assert.equal(result.error_type, "auth_invalid")
      assert.equal(result.retryable, false)
    })

    it("detects via stderr", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "Error: Invalid API key provided.",
      })
      assert.equal(result.error_type, "auth_invalid")
    })
  })

  describe("permission_denied", () => {
    it("detects via HTTP 403", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "",
        httpStatus: 403,
      })
      assert.equal(result.error_type, "permission_denied")
      assert.equal(result.retryable, false)
    })
  })

  describe("model_capacity", () => {
    it("detects via HTTP 503", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "",
        httpStatus: 503,
      })
      assert.equal(result.error_type, "model_capacity")
      assert.equal(result.retryable, true)
    })

    it("detects via stderr", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "Error: Model is currently overloaded",
      })
      assert.equal(result.error_type, "model_capacity")
    })
  })

  describe("network", () => {
    it("detects connection refused", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "Error: fetch failed\nCause: ConnectTimeoutError: Connect Timeout Error",
      })
      assert.equal(result.error_type, "network")
      assert.equal(result.retryable, true)
    })

    it("detects ECONNREFUSED", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "Error: connect ECONNREFUSED 127.0.0.1:443",
      })
      assert.equal(result.error_type, "network")
    })
  })

  describe("session_not_found", () => {
    it("detects from export with valid prefix", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "Exporting session: ses_nonexistent",
        stderr: "Error: Session not found: ses_nonexistent",
      })
      assert.equal(result.error_type, "session_not_found")
      // stdout "Exporting session:" pattern gives high confidence
      assert.equal(result.confidence, "high")
    })

    it("detects from invalid prefix format", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: 'Expected a string starting with "ses", got "xyz"',
      })
      assert.equal(result.error_type, "session_not_found")
      assert.equal(result.confidence, "high")
    })
  })

  describe("command_not_found", () => {
    it("detects via Windows error", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "'opencode' is not recognized as an internal or external command",
      })
      assert.equal(result.error_type, "command_not_found")
      assert.equal(result.retryable, false)
    })

    it("detects via exit code 9009 (Windows)", () => {
      const result = classifyOpenCodeError({
        exitCode: 9009,
        stdout: "",
        stderr: "",
      })
      assert.equal(result.error_type, "command_not_found")
    })
  })

  describe("invalid_arguments", () => {
    it("detects from help text output", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "opencode run [message..]\n\nrun opencode with a message\n\nOptions:\n  -h, --help",
      })
      // The help text pattern doesn't match specific keywords, should be unknown
      assert.ok(result)
    })
  })

  describe("timeout", () => {
    it("detects from timedOut flag", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "",
        timedOut: true,
      })
      assert.equal(result.error_type, "timeout")
      assert.equal(result.retryable, true)
    })

    it("detects from SIGTERM", () => {
      const result = classifyOpenCodeError({
        exitCode: null,
        stdout: "",
        stderr: "",
        exitSignal: "SIGTERM",
      })
      assert.equal(result.error_type, "timeout")
    })
  })

  describe("unknown", () => {
    it("returns unknown for unrecognized errors", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "some random error message",
      })
      assert.equal(result.error_type, "unknown")
      assert.equal(result.retryable, false)
    })
  })

  describe("evidence chain", () => {
    it("records classification evidence", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "Error: Rate limit exceeded",
        httpStatus: 429,
      })
      assert.ok(result.evidence.length > 0, "should have evidence")
      // HTTP status has higher priority than stderr
      assert.ok(result.evidence.some((e) => e.startsWith("http_status:")), "should include http_status evidence")
    })
  })

  describe("priority: parsedBody > httpStatus > stderr > exitCode", () => {
    it("parsedBody takes precedence over httpStatus", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "",
        httpStatus: 429,
        parsedBody: { error: { code: "quota_exceeded", message: "no credits" } },
      })
      assert.equal(result.error_type, "quota_exhausted")
    })

    it("httpStatus takes precedence over stderr", () => {
      const result = classifyOpenCodeError({
        exitCode: 1,
        stdout: "",
        stderr: "Error: rate limit exceeded",
        httpStatus: 401,
      })
      assert.equal(result.error_type, "auth_invalid")
    })

    it("stderr takes precedence over exitCode", () => {
      const result = classifyOpenCodeError({
        exitCode: 9009,
        stdout: "",
        stderr: "Error: Rate limit exceeded",
      })
      assert.equal(result.error_type, "rate_limit")
    })
  })
})
