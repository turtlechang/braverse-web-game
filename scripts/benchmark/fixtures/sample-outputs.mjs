/**
 * Benchmark 模擬 CLI stdout 輸出
 *
 * 預先定義的 JSON-lines 字串，用於測試 parseCliOutput 與 callOpenCodeGo。
 * 不依賴真實 CLI 連線。
 */

import { makeJsonLines } from './helpers.mjs'

/** 單一 text 事件 + step_finish */
export const SIMPLE_OK = makeJsonLines('OK', 12, 7)

/** 多個 text 事件拼接 */
export const MULTI_TEXT = [
  JSON.stringify({ type: 'text', part: { type: 'text', text: 'Hello' } }),
  JSON.stringify({ type: 'text', part: { type: 'text', text: ' World' } }),
  JSON.stringify({
    type: 'step_finish',
    part: { type: 'step-finish', reason: 'stop', tokens: { input: 5, output: 3, total: 8 } },
  }),
].join('\n')

/** 無 text 事件，只有 step_start */
export const NO_TEXT = JSON.stringify({ type: 'step_start', part: { type: 'step-start' } })

/** 含 malformed JSON 行 */
export const MALFORMED = [
  'this is not json',
  JSON.stringify({ type: 'text', part: { type: 'text', text: 'OK' } }),
  '',
  '  ',
  JSON.stringify({
    type: 'step_finish',
    part: { type: 'step-finish', reason: 'stop', tokens: { input: 10, output: 5 } },
  }),
].join('\n')

/** 有 text 但無 step_finish */
export const NO_FINISH = JSON.stringify({ type: 'text', part: { type: 'text', text: 'No finish' } })

/** step_finish 的 tokens 為空物件 */
export const BAD_TOKENS = [
  JSON.stringify({ type: 'text', part: { type: 'text', text: 'Bad tokens' } }),
  JSON.stringify({ type: 'step_finish', part: { type: 'step-finish', reason: 'stop', tokens: {} } }),
].join('\n')

/** 空字串 */
export const EMPTY = ''

/** 模型回覆 "PASS"（符合 review 任務的 expectedPattern） */
export const PASS_REPLY = makeJsonLines('PASS', 20, 8)

/** 模型回覆 "FAIL: 缺少邊界檢查"（符合 review 任務的 expectedPattern） */
export const FAIL_REPLY = makeJsonLines('FAIL: 缺少邊界檢查', 20, 12)

/** 模型回覆含 TypeScript function 簽名（符合 implementation 任務） */
export const TS_SIGNATURE = makeJsonLines(
  'function handleTrashOpponentSupport(state: GameState, sourceId: string, targetId: string): GameState',
  30,
  25,
)

/** 模型回覆含補位關鍵字（符合 integration 任務） */
export const REPLACEMENT_REPLY = makeJsonLines(
  '補位流程透過 replacement.ts 的 selectReplacement 觸發，faint 後進入 OnPlay 效果窗口',
  25,
  20,
)

/** 模型回覆不含任何預期關鍵字（pattern mismatch） */
export const IRRELEVANT = makeJsonLines('I have no idea what you are talking about', 15, 10)
