import type { CommandLogEntry } from '../../game'

export interface CardContractActionTraceEntry {
  id: number
  groupId?: number
  commandKind: string
  category?: string
  summary?: string
  steps: string[]
}

export interface CardContractAttestationExpectation {
  requiredCommandKinds?: readonly string[]
  orderedStepFragments?: readonly string[]
}

export interface CardContractAttestation {
  passed: boolean
  errors: string[]
  observedCommandKinds: string[]
  observedSteps: string[]
}
/**
 * 將正式 command log 壓縮成可保存的卡牌驗證 trace。
 * 只保留公開摘要與步驟文字，不複製 payload，避免把手牌／牌庫等私有資訊
 * 變成 Browser artifact。Browser 驗證可用這份 trace 檢查支付→代價→目標→
 * 結算順序，但最終合法性仍由規則層 command 驗證。
 */
export const buildCardContractActionTrace = (
  entries: readonly CommandLogEntry[],
  cardId: string,
): CardContractActionTraceEntry[] =>
  entries
    .filter((entry) => entry.card?.id === cardId)
    .map((entry) => ({
      id: entry.id,
      ...(entry.groupId !== undefined ? { groupId: entry.groupId } : {}),
      commandKind: entry.commandKind,
      ...(entry.category ? { category: entry.category } : {}),
      ...(entry.summary ? { summary: entry.summary } : {}),
      steps: (entry.steps ?? []).map((step) => step.text),
    }))

export const traceContainsCommandKinds = (
  trace: readonly CardContractActionTraceEntry[],
  kinds: readonly string[],
): boolean => {
  const actual = new Set(trace.map((entry) => entry.commandKind))
  return kinds.every((kind) => actual.has(kind))
}

/**
 * A trace containing only a card source, attack declaration, or payment is
 * not proof that the printed effect settled.  Browser serial gates use this
 * predicate to require at least one public target/result/state-change step.
 */
export const traceHasSubstantiveEffectEvidence = (
  trace: readonly CardContractActionTraceEntry[],
): boolean =>
  trace
    .filter((entry) => entry.commandKind !== 'declare-attack')
    .flatMap((entry) => entry.steps)
    .filter(
      (step) =>
        !/^(?:發動|支付|額外代價|代價|宣告攻擊|攻擊後效果來源)/.test(step),
    )
    .some((step) =>
      /目標|結果|Then|抽牌|傷害|HP|攻擊力|洗回|放置|移動|回到|送入|橫置|活躍|略過|未生效/.test(
        step,
      ),
    )

/**
 * 驗證 Browser／Playwright 送回的公開 trace 是否真的走過預期的
 * 支付→代價→目標→結算步驟。輸入只能是 `buildCardContractActionTrace`
 * 的結果，因此不會把 payload、手牌或牌庫內容帶入 attestation artifact。
 */
export const attestCardContractActionTrace = (
  trace: readonly CardContractActionTraceEntry[],
  expectation: CardContractAttestationExpectation,
): CardContractAttestation => {
  const observedCommandKinds = [...new Set(trace.map((entry) => entry.commandKind))]
  const observedSteps = trace.flatMap((entry) => entry.steps)
  const errors: string[] = []

  for (const kind of expectation.requiredCommandKinds ?? []) {
    if (!observedCommandKinds.includes(kind)) {
      errors.push(`missing command kind: ${kind}`)
    }
  }

  let cursor = 0
  for (const fragment of expectation.orderedStepFragments ?? []) {
    const index = observedSteps.findIndex(
      (step, stepIndex) => stepIndex >= cursor && step.includes(fragment),
    )
    if (index < 0) {
      errors.push(`missing ordered step: ${fragment}`)
      continue
    }
    cursor = index + 1
  }

  return {
    passed: errors.length === 0,
    errors,
    observedCommandKinds,
    observedSteps,
  }
}
