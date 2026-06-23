# Hand Hover and Trap Target Availability Implementation Plan

> **For Codex:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** 修正玩家手牌 hover 位移過大，以及 ST5-021 在沒有合法必選目標時仍被玩家 UI／AI 視為可發動的問題。

**Architecture:** hover 僅調整現有 CSS 扇形變數；陷阱合法性統一由規則層 `getTrapCandidates` 判定，UI 與 AI 不新增重複規則。以 ST5-021 回歸測試及紫色固定種子模擬鎖定錯誤。

**Tech Stack:** React、TypeScript、Vitest、Vite、Playwright

---

### Task 1: 建立失敗回歸測試

**Files:**
- Modify: `src/game/battle-trap.test.ts`
- Modify: `src/game/ai-simulation.test.ts`
- Create: `src/components/battle/BattleRow.css.test.ts`

- [x] 加入 ST5-021 無合法目標時不列入候選，並在既有合法目標案例確認仍列入候選。
- [x] 加入紫色對紫色固定種子 6、19、29、33 回歸測試。
- [x] 加入 hover 保留扇形變數、上移 8px、縮放 1.02，且選取樣式不變的 CSS 契約測試。
- [x] 執行聚焦測試並確認因缺少修正而失敗。

### Task 2: 實作共用陷阱目標合法性

**Files:**
- Modify: `src/game/battle.ts`

- [x] 對所有必選目標效果檢查合法候選數是否達到 `target.min`。
- [x] `field-to-trash` 的 `allowStage` 必須把合法場景納入候選數。
- [x] `target.min = 0` 或無目標效果維持既有行為。
- [x] 執行陷阱與紫色固定種子聚焦測試並確認通過。

### Task 3: 調整手牌 hover

**Files:**
- Modify: `src/components/battle/BattleRow.css`

- [x] hover／focus-within 使用既有 `--fan-x`、`--fan-y`、`--fan-rotation`，僅額外上移 8px、縮放 1.02。
- [x] 保留 `.is-selected` 既有明顯抬升與縮放。
- [x] 執行 CSS 契約測試並確認通過。

### Task 4: 文件與完整驗證

**Files:**
- Modify: `README.md`
- Modify: `AGENTS.md`

- [x] 更新目前進度、下一步計畫與實際測試數。
- [x] 執行 `npm test`、`npm run lint`、`npm run build`。
- [x] 執行 `npm run test:ai:browser`；若僅命中已知 1920×1080 基線問題，明確記錄，不宣稱完整 Playwright 全綠。
- [x] 檢查 `git diff --check`、完整差異與未追蹤檔案，排除 `review-output.txt`。
