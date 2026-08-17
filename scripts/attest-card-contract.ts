/**
 * 驗證 Browser／Playwright 產出的卡牌公開 action trace。
 *
 * 用法：
 *   npm run cards:attest -- --input trace.json \
 *     --commands activate-skill,resolve-ability-effect \
 *     --steps "支付,選擇目標,結算"
 *
 * trace 檔只能包含 `buildCardContractActionTrace` 的公開欄位；若輸入把
 * payload、hand 或 deck 帶進 artifact，這個 gate 會直接失敗。
 */
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { attestCardContractActionTrace } from '../src/cards/contracts'
import type { CardContractActionTraceEntry } from '../src/cards/contracts'

interface AttestationOptions {
  input: string
  commands: string[]
  steps: string[]
}

const parseArgs = (argv: string[]): AttestationOptions => {
  let input = ''
  let commands: string[] = []
  let steps: string[] = []
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]
    if (arg === '--input' && argv[index + 1]) input = argv[++index]
    else if (arg === '--commands' && argv[index + 1]) {
      commands = argv[++index].split(',').map((value) => value.trim()).filter(Boolean)
    } else if (arg === '--steps' && argv[index + 1]) {
      steps = argv[++index].split(',').map((value) => value.trim()).filter(Boolean)
    }
  }
  return { input, commands, steps }
}

const hasPrivateKey = (value: unknown): boolean => {
  if (!value || typeof value !== 'object') return false
  if (Array.isArray(value)) return value.some(hasPrivateKey)
  return Object.entries(value).some(([key, nested]) =>
    key === 'payload' || key === 'hand' || key === 'deck' || hasPrivateKey(nested),
  )
}

const readTrace = (path: string): CardContractActionTraceEntry[] => {
  const parsed = JSON.parse(readFileSync(path, 'utf8')) as unknown
  if (hasPrivateKey(parsed)) {
    throw new Error('Browser attestation trace 不得包含 payload、hand 或 deck。')
  }
  const trace = Array.isArray(parsed)
    ? parsed
    : parsed && typeof parsed === 'object' && 'trace' in parsed
      ? (parsed as { trace: unknown }).trace
      : null
  if (!Array.isArray(trace)) throw new Error('trace.json 必須是陣列或 { trace: [] }。')
  if (!trace.every((entry) => {
    if (!entry || typeof entry !== 'object') return false
    const candidate = entry as Record<string, unknown>
    return typeof candidate.commandKind === 'string' &&
      Array.isArray(candidate.steps) &&
      candidate.steps.every((step) => typeof step === 'string')
  })) {
    throw new Error('trace entry 必須包含 commandKind:string 與 steps:string[]。')
  }
  return trace as CardContractActionTraceEntry[]
}

export const attestTraceFile = (options: AttestationOptions) => {
  if (!options.input) throw new Error('請指定 --input trace.json。')
  const trace = readTrace(options.input)
  return attestCardContractActionTrace(trace, {
    requiredCommandKinds: options.commands,
    orderedStepFragments: options.steps,
  })
}

if (fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    const result = attestTraceFile(parseArgs(process.argv.slice(2)))
    console.log(JSON.stringify(result, null, 2))
    if (!result.passed) process.exit(1)
  } catch (error) {
    console.error(error instanceof Error ? error.message : error)
    process.exit(2)
  }
}
