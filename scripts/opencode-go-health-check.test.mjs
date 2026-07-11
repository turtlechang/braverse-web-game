import { describe, it, beforeEach, afterEach } from "node:test"
import assert from "node:assert/strict"
import { createHealthChecker } from "./opencode-go-health-check.mjs"

// ─── Mock Helpers ───────────────────────────────────────────────────

function createMockFs(overrides = {}) {
  return {
    existsSync: overrides.existsSync ?? (() => true),
    readFileSync: overrides.readFileSync ?? (() => '{"provider":{"opencode-go":{"options":{"baseURL":"https://opencode.ai/zen/go/v1"}}}}'),
    writeFileSync: overrides.writeFileSync ?? (() => {}),
    mkdirSync: overrides.mkdirSync ?? (() => {}),
  }
}

function createMockExec(overrides = {}) {
  return overrides.execSync ?? ((cmd) => {
    if (cmd === "where opencode.cmd") return "C:\\mock\\opencode.cmd\n"
    if (cmd === "node --version") return "v24.16.0\n"
    throw new Error(`Unexpected command: ${cmd}`)
  })
}

function createMockFetch(responseFn) {
  return async (...args) => {
    return responseFn(...args)
  }
}

// ─── Tests ──────────────────────────────────────────────────────────

describe("createHealthChecker", () => {
  it("returns a checker with expected API", () => {
    const checker = createHealthChecker()
    assert.equal(typeof checker.check, "function")
    assert.equal(typeof checker.checkLocal, "function")
    assert.equal(typeof checker.checkConnectivity, "function")
    assert.equal(typeof checker.checkInference, "function")
  })
})

describe("Level 1: Local checks", () => {
  const savedEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...savedEnv }
  })

  it("returns ok when all checks pass", () => {
    const checker = createHealthChecker({
      ...createMockFs(),
      execSync: createMockExec(),
    })
    process.env.OPENCODE_GO_API_KEY = "test-key-that-is-long-enough-12345"

    const result = checker.checkLocal()
    assert.equal(result.ok, true)
    assert.equal(result.checks.node.ok, true)
    assert.equal(result.checks.opencode_cmd.ok, true)
    assert.equal(result.checks.api_key.present, true)
    assert.equal(result.checks.api_key.plausible, true)
    assert.equal(result.checks.config.ok, true)
  })

  it("detects missing API key", () => {
    delete process.env.OPENCODE_GO_API_KEY
    const checker = createHealthChecker({
      ...createMockFs(),
      execSync: createMockExec(),
    })

    const result = checker.checkLocal()
    assert.equal(result.ok, false)
    assert.equal(result.checks.api_key.present, false)
  })

  it("detects implausible API key (too short)", () => {
    process.env.OPENCODE_GO_API_KEY = "short"
    const checker = createHealthChecker({
      ...createMockFs(),
      execSync: createMockExec(),
    })

    const result = checker.checkLocal()
    assert.equal(result.checks.api_key.present, true)
    assert.equal(result.checks.api_key.plausible, false)
  })

  it("detects implausible API key (contains spaces)", () => {
    process.env.OPENCODE_GO_API_KEY = "this key contains spaces and is long enough"
    const checker = createHealthChecker({
      ...createMockFs(),
      execSync: createMockExec(),
    })

    const result = checker.checkLocal()
    assert.equal(result.checks.api_key.present, true)
    assert.equal(result.checks.api_key.plausible, false)
  })

  it("detects missing config file", () => {
    process.env.OPENCODE_GO_API_KEY = "test-key-that-is-long-enough-12345"
    const checker = createHealthChecker({
      ...createMockFs({ existsSync: () => false }),
      execSync: createMockExec(),
    })

    const result = checker.checkLocal()
    assert.equal(result.ok, false)
    assert.equal(result.checks.config.ok, false)
  })

  it("detects missing opencode.cmd", () => {
    process.env.OPENCODE_GO_API_KEY = "test-key-that-is-long-enough-12345"
    const checker = createHealthChecker({
      ...createMockFs({
        existsSync: (p) => {
          if (String(p).includes("opencode.cmd")) return false
          return true
        },
      }),
      execSync: (cmd) => {
        if (cmd === "where opencode.cmd") throw new Error("not found")
        if (cmd === "node --version") return "v24.16.0\n"
        throw new Error(`Unexpected: ${cmd}`)
      },
    })

    const result = checker.checkLocal()
    assert.equal(result.ok, false)
    assert.equal(result.checks.opencode_cmd.ok, false)
  })
})

describe("Level 2: Connectivity checks", () => {
  it("skips when no endpoint configured", async () => {
    const checker = createHealthChecker({
      ...createMockFs({ readFileSync: () => "{}" }),
    })

    const result = await checker.checkConnectivity(null)
    assert.equal(result.ok, null)
    assert.equal(result.skipped, true)
    assert.equal(result.reason, "no_endpoint_configured")
  })

  it("returns ok when endpoint responds with 200", async () => {
    const checker = createHealthChecker({
      ...createMockFs(),
      fetchFn: createMockFetch(() => Promise.resolve({ ok: true, status: 200 })),
    })
    process.env.OPENCODE_GO_API_KEY = "test-key"

    const config = { provider: { "opencode-go": { options: { baseURL: "https://opencode.ai/zen/go/v1" } } } }
    const result = await checker.checkConnectivity(config)
    assert.equal(result.ok, true)
    assert.equal(result.checks.dns.ok, true)
    assert.equal(result.checks.https.ok, true)
    assert.equal(result.checks.credentials.accepted, true)
  })

  it("detects auth failure (401)", async () => {
    const checker = createHealthChecker({
      ...createMockFs(),
      fetchFn: createMockFetch(() => Promise.resolve({ ok: false, status: 401 })),
    })

    const config = { provider: { "opencode-go": { options: { baseURL: "https://opencode.ai/zen/go/v1" } } } }
    const result = await checker.checkConnectivity(config)
    assert.equal(result.checks.credentials.accepted, false)
  })

  it("treats an unsupported models probe as reachable, not quota failure", async () => {
    const checker = createHealthChecker({
      ...createMockFs(),
      fetchFn: createMockFetch(() => Promise.resolve({ ok: false, status: 404 })),
    })

    const config = { provider: { "opencode-go": { options: { baseURL: "https://opencode.ai/zen/go/v1" } } } }
    const result = await checker.checkConnectivity(config)
    assert.equal(result.ok, true)
    assert.equal(result.checks.https.probe_route_supported, false)
    assert.equal(result.checks.credentials.accepted, null)
    assert.equal(result.checks.credentials.reason, "probe_route_not_supported")
  })

  it("handles network errors", async () => {
    const checker = createHealthChecker({
      ...createMockFs(),
      fetchFn: createMockFetch(() => Promise.reject(new Error("fetch failed"))),
    })

    const config = { provider: { "opencode-go": { options: { baseURL: "https://opencode.ai/zen/go/v1" } } } }
    const result = await checker.checkConnectivity(config)
    assert.equal(result.ok, false)
    assert.equal(result.checks.https.ok, false)
  })
})

describe("Level 3: Inference checks", () => {
  it("skips when no endpoint configured", async () => {
    const checker = createHealthChecker({
      ...createMockFs({ readFileSync: () => "{}" }),
    })

    const result = await checker.checkInference(null)
    assert.equal(result.ok, null)
    assert.equal(result.skipped, true)
  })

  it("returns ok on successful inference", async () => {
    const checker = createHealthChecker({
      ...createMockFs(),
      fetchFn: createMockFetch(() => Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ choices: [{ message: { content: "OK" } }] }),
      })),
      clock: () => 1000,
    })
    process.env.OPENCODE_GO_API_KEY = "test-key"

    const config = { model: "opencode-go/deepseek-v4-flash", provider: { "opencode-go": { options: { baseURL: "https://opencode.ai/zen/go/v1" } } } }
    const result = await checker.checkInference(config, true)
    assert.equal(result.ok, true)
    assert.equal(result.cached, false)
  })

  it("uses cache when available and fresh", async () => {
    let fetchCalled = false
    const checker = createHealthChecker({
      ...createMockFs({
        readFileSync: () => JSON.stringify({
          inference: { ok: true, checked_at: new Date().toISOString() },
        }),
      }),
      fetchFn: createMockFetch(() => { fetchCalled = true; return Promise.resolve({ ok: true }) }),
      clock: () => Date.now(),
    })

    const result = await checker.checkInference({}, false)
    assert.equal(result.ok, true)
    assert.equal(result.cached, true)
    assert.equal(fetchCalled, false, "should not call fetch when cache is fresh")
  })

  it("bypasses cache when noCache is true", async () => {
    let fetchCalled = false
    const checker = createHealthChecker({
      existsSync: () => true,
      readFileSync: (path) => {
        if (String(path).includes("health-cache.json")) {
          return JSON.stringify({ inference: { ok: true, checked_at: new Date().toISOString() } })
        }
        return '{"provider":{"opencode-go":{"options":{"baseURL":"https://opencode.ai/zen/go/v1"}}}}'
      },
      writeFileSync: () => {},
      fetchFn: createMockFetch(() => {
        fetchCalled = true
        return Promise.resolve({ ok: true, json: () => Promise.resolve({}) })
      }),
      clock: () => Date.now(),
    })

    const config = { model: "opencode-go/deepseek-v4-flash", provider: { "opencode-go": { options: { baseURL: "https://opencode.ai/zen/go/v1" } } } }
    const result = await checker.checkInference(config, true)
    assert.equal(fetchCalled, true, "should call fetch when noCache is true")
  })
})

describe("check (full pipeline)", () => {
  const savedEnv = { ...process.env }

  afterEach(() => {
    process.env = { ...savedEnv }
  })

  it("runs Level 1+2 by default", async () => {
    process.env.OPENCODE_GO_API_KEY = "test-key-that-is-long-enough-12345"
    const checker = createHealthChecker({
      ...createMockFs(),
      execSync: createMockExec(),
      fetchFn: createMockFetch(() => Promise.resolve({ ok: true, status: 200 })),
    })

    const result = await checker.check()
    assert.ok(result.levels.local)
    assert.ok(result.levels.connectivity)
    assert.equal(result.levels.inference.skipped, true)
    assert.equal(typeof result.overall.ok, "boolean")
  })

  it("includes Level 3 when checkInference is true", async () => {
    process.env.OPENCODE_GO_API_KEY = "test-key-that-is-long-enough-12345"
    const checker = createHealthChecker({
      ...createMockFs(),
      execSync: createMockExec(),
      fetchFn: createMockFetch(() => Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({}),
      })),
      clock: () => Date.now(),
    })

    const result = await checker.check({ checkInference: true, noCache: true })
    assert.ok(result.levels.inference)
    assert.notEqual(result.levels.inference.ok, null, "inference should not be skipped")
  })
})
