/**
 * OpenCode Go Benchmark 設定
 *
 * 三階段：review / implementation / integration。
 * 受測模型固定為 7 個，含 minimax-m3、kimi-k2.6、mimo-v2.5，不含 glm 與 mimo 其他版。
 * 每階段兩個 scenario，取自 Braverse 專案內真實程式碼。
 *
 * 任務設計原則：
 *   - review：驗證模型對單一檔案的精確程式碼審查與分析能力。
 *   - implementation：驗證模型對單一檔案的程式碼實作與編輯能力。
 *   - integration：驗證模型對多檔案跨模組的整合與替換能力。
 *
 * 所有 expectedPattern 皆設計為只有真正理解 Braverse 程式碼的模型才能通過。
 */

/** @type {import('./benchmark/benchmark-runner.mjs').BenchmarkPhase[]} */
export const phases = [
  {
    id: 'review',
    name: '審查',
    order: 0,
    ref: '58e04b7^^',
    timeoutMs: 120000,
    advanceCount: 4,
    mode: 'review',
  },
  {
    id: 'implementation',
    name: '實作',
    order: 1,
    ref: '58e04b7^^',
    timeoutMs: 300000,
    advanceCount: 3,
    mode: 'edit',
  },
  {
    id: 'integration',
    name: '整合',
    order: 2,
    ref: 'HEAD',
    timeoutMs: 600000,
    advanceCount: null,
    mode: 'edit',
  },
]

/** @type {string[]} */
export const models = [
  'opencode-go/mimo-v2.5',
  'opencode-go/deepseek-v4-pro',
  'opencode-go/minimax-m3',
  'opencode-go/kimi-k2.6',
  'opencode-go/kimi-k2.7-code',
  'opencode-go/mimo-v2.5-pro',
  'opencode-go/qwen3.7-plus',
]

/** @type {Record<string, { reasoningEffort: string }>} */
export const modelOptions = {
  'opencode-go/mimo-v2.5': { reasoningEffort: 'low' },
  'opencode-go/deepseek-v4-pro': { reasoningEffort: 'medium' },
  'opencode-go/minimax-m3': { reasoningEffort: 'low' },
  'opencode-go/kimi-k2.6': { reasoningEffort: 'low' },
  'opencode-go/kimi-k2.7-code': { reasoningEffort: 'medium' },
  'opencode-go/mimo-v2.5-pro': { reasoningEffort: 'medium' },
  'opencode-go/qwen3.7-plus': { reasoningEffort: 'low' },
}

/** @type {Record<string, import('./benchmark/benchmark-runner.mjs').BenchmarkTask[]>} */
export const tasks = {
  review: [
    {
      id: 'target-energy-payment',
      prompt: [
        '附加檔案是 Braverse 卡牌遊戲的能量支付模組。',
        '請精確定位 validateEnergyPayment 函式中處理萬用能量支付的邏輯，',
        '並指出該段程式碼所在的確切行號範圍。',
        '以正體中文回覆，格式：「行 X–Y：<說明>」。',
        '若無法定位則回覆「FAIL：無法定位」。',
      ].join(' '),
      files: ['src/game/energy.ts'],
      expectedPattern: /行\s*\d+[–\-]\d+[：:]/,
      timeoutMs: 120000,
    },
    {
      id: 'review-skill-trigger',
      prompt: [
        '附加檔案是 Braverse 的技能觸發模組。',
        '請精確定位 Activate 技能的主動宣告與能量付款檢查邏輯，',
        '並指出該段程式碼所在的確切行號範圍。',
        '以正體中文回覆，格式：「行 X–Y：<說明>」。',
        '若無法定位則回覆「FAIL：無法定位」。',
      ].join(' '),
      files: ['src/game/skills.ts'],
      expectedPattern: /行\s*\d+[–\-]\d+[：:]/,
      timeoutMs: 120000,
    },
  ],
  implementation: [
    {
      id: 'implement-flip-effect',
      prompt: [
        '附加檔案是 Braverse 的效果執行器。',
        '請在 effects.ts 中新增一個 flip 效果類型，',
        '使其能在 OnPlay 時機自動觸發並回傳結果。',
        '以正體中文回覆，說明實作步驟與影響的型別變更。',
        '若無法實作則回覆「FAIL：<原因>」。',
      ].join(' '),
      files: ['src/game/effects.ts'],
      expectedPattern: /flip|OnPlay/,
      timeoutMs: 300000,
    },
    {
      id: 'implement-ai-fallback',
      prompt: [
        '附加檔案是 Braverse 的 AI 決策模組。',
        '請在 ai.ts 中為 takeAiStep 新增 fallback 邏輯，',
        '當無合法動作時直接結束回合並回傳結束事件。',
        '以正體中文回覆，說明實作步驟與影響的函式簽章。',
        '若無法實作則回覆「FAIL：<原因>」。',
      ].join(' '),
      files: ['src/game/ai.ts'],
      expectedPattern: /takeAiStep|fallback/,
      timeoutMs: 300000,
    },
  ],
  integration: [
    {
      id: 'replace-faint-pending',
      prompt: [
        '附加檔案是 Braverse 的核心型別定義（types.ts）、效果執行器（effects.ts）',
        '與技能觸發模組（skills.ts）。',
        '目前的 PendingFaintEffect 只支援單一 faint 來源，',
        '請說明如何將其替換為支援多來源（例如同時有多個餅乾 faint）的設計。',
        '需提及型別變更（types.ts）、效果佇列變更（effects.ts）',
        '與技能觸發整合（skills.ts）。',
        '以正體中文回覆，50–100 字。',
        '若無法設計則回覆「FAIL：<原因>」。',
      ].join(' '),
      files: [
        'src/game/types.ts',
        'src/game/effects.ts',
        'src/game/skills.ts',
      ],
      expectedPattern: /types\.ts|effects\.ts|skills\.ts/,
      timeoutMs: 600000,
    },
    {
      id: 'integrate-pending-decision',
      prompt: [
        '附加檔案是 Braverse 的指令與效果模組。',
        '請說明如何將 typed GameCommand/PendingDecision pilot 整合到 effects.ts，',
        '使其能統一處理 faint-effect 與 opponent-hand-discard 兩類 pending 決策。',
        '需提及 commands.ts 的型別定義與 effects.ts 的佇列變更。',
        '以正體中文回覆，50–100 字。',
        '若無法設計則回覆「FAIL：<原因>」。',
      ].join(' '),
      files: [
        'src/game/commands.ts',
        'src/game/effects.ts',
      ],
      expectedPattern: /commands\.ts|effects\.ts/,
      timeoutMs: 600000,
    },
  ],
}
