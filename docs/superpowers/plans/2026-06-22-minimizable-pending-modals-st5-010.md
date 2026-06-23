# Minimizable Pending Modals and ST5-010 Regression Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 新增兩個待確認提示框的縮小／放大互動，並證明 ST5-010 補位 OnPlay 後 AI 能繼續推進。

**Architecture:** Modal 的 minimized 狀態維持在元件內，不改動 `GameState`；縮小 dock 沿用既有 `card-reveal-dock`。ST5-010 以正式卡牌、真實規則 API 與 React 自動操作流程建立回歸，先重現再決定是否修改控制層。

**Tech Stack:** React、TypeScript、Vitest、jsdom、Playwright、Vite

---

### Task 1: 提示框互動 TDD

**Files:**
- Modify: `src/components/modals/GameModals.test.tsx`
- Modify: `src/components/modals/GameModals.tsx`
- Modify: `src/components/modals/GameModals.css`

- [x] 新增 `DiscardRevealModal` 縮小、放大、未確認的失敗互動測試。
- [x] 新增非 Refresh `DecisionModal` 縮小、放大、未選牌／未略過的失敗互動測試。
- [x] 執行 `npm test -- src/components/modals/GameModals.test.tsx` 確認紅燈原因為缺少縮小控制。
- [x] 以元件內 `minimized` 狀態與既有 dock 樣式完成最小實作。
- [x] 重跑聚焦測試確認綠燈。

### Task 2: ST5-010 正式狀態回歸

**Files:**
- Modify: `src/game/ai-turn-decision.test.ts`
- Modify only if failing evidence points there: `src/game/ai.ts`, `src/game/ai/turn-handler.ts`, `src/hooks/useAiTurn.ts`, or `src/hooks/usePendingEffect.ts`

- [x] 建立 AI 回合中玩家以正式 ST5-010 補位、支付 OnPlay、移除 AI 低 HP 餅乾的回歸測試。
- [x] 從效果完成狀態連續呼叫 AI 決策，要求清除補位／OnPlay 並離開 blocking pending。
- [x] 若測試重現卡住，僅修改第一個產生錯誤 pending／控制權的來源；若既有程式已通過，保留回歸測試且不改引擎。
- [x] 執行 ST5-010 與紫色固定種子聚焦測試。

### Task 3: 瀏覽器驗證與文件

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`
- Modify browser/demo support only if needed for repeatable UI proof: `src/game/demo.ts`, `src/hooks/useMatchController.ts`, `scripts/ai-browser-validation.mjs`

- [x] 以 798×698 與桌機尺寸驗證兩個 Modal 的縮小／放大與底層遊戲不推進。
- [x] 以正式 ST5-010 流程驗證 AI 能繼續操作；明確區分 demo 與正式狀態證據。
- [x] 更新 README／AGENTS 目前進度與實際測試數。
- [x] 執行 `npm test`、`npm run lint`、`npm run build`、`git diff --check`。
- [x] 執行 `npm run test:ai:browser` 並記錄既有基線限制。
