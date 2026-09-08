---
name: develop-braverse
description: 實作或修復 Braverse 遊戲規則、卡牌轉接、React UI 與 AI，依正式規格及回歸證據驗收。純工作流文件調整使用 braverse-workflow；不套用到其他專案。
---

# Braverse 開發流程

以專案根目錄 `AGENTS.md` 為本機規格與不可破壞契約入口，遵守更高優先指令及使用者本次授權；Skill 不擴張範圍或解除核准門檻。

## 1. 啟動工作

沿用 `braverse-workflow` 已確認的契約及目前證據，依根目錄 Git 邊界讀取狀態；不重做尚未失效的探索。定位相關公開 API、資料流與測試後，開始最小充分修改。

## 2. 依任務載入依據

- 修改規則引擎、卡牌效果、費用、時機或勝負：先讀 `docs/game-rules.md`，再讀 [references/architecture-and-rules.md](references/architecture-and-rules.md)。
- 修改官方卡牌匯入或文字解析：另讀 `docs/card-data-import.md` 與 `docs/card-effects.md`。
- 修改官方文字轉接、條件解析或 strict contract：另讀
  [references/official-text-contracts.md](references/official-text-contracts.md)，
  依其中的 parser／exact map／fail-closed 與 A/B 驗收規範執行。
- 修改 UI、版面或互動：另讀 `docs/official-ui-reference.md`，確認 UI 只呈現規則層結果。
- 修改 AI 或完整對戰流程：讀 `src/game/ai.ts`、相關規則模組與瀏覽器驗證腳本。
- 決定驗證層級：讀 `../braverse-workflow/references/verification-levels.md`。
- 準備文件或 Git 收尾：讀 [references/verification-and-git.md](references/verification-and-git.md)。
- 確定需要獨立 Codex 子代理：讀 [派工契約](../braverse-workflow/references/delegation-template.md)。OpenCode Go 備援已取消，不載入其舊 references 或執行 wrapper。

## 3. 查核規則

1. 區分 `[已確認]`、`[暫定]` 與 `[待確認]`。
2. 不自行實作 `[待確認]` 項目。
3. 文件若與目前程式、測試或 README 衝突，檢查 Git 歷史與最新官方依據，不直接回退已完成行為。
4. 採用優先順序：最新官方規則更新 > 官方完整規則 > 卡牌文字 > Play Guide > 賽事規章。
5. 規則確認後同步更新相關 `docs/`，移除或改寫已過期的暫定說明。

## 4. 實作

1. 將規則判定與狀態轉換留在 `src/game/`，使用純函式、不可變資料與可注入外部變因。
2. 讓 React UI 呼叫規則層公開 API；不得直接修改 `GameState` 或另寫權威規則。
3. 將 AI 決策集中於 `src/game/ai.ts`，保持 deterministic 並回傳新狀態。
4. 將官方資料格式留在 `src/cards/types.ts`，執行期核心型別留在 `src/game/types.ts`。
5. 新增效果時先更新 `CardEffect` union，再調整轉接層、執行邏輯與測試。
6. 共用既有能量選擇、文字解析、洗牌及事件推進函式，不在 UI 或其他模組複製規則。
7. 重複且語意單一的官方句型集中在 generic parser；`Then`、多分支、動態費用
   或官方裁決句型使用明確 exact map。不能把未辨識的必要條件靜默降級成
   unconditional effect；安全無法表示時回傳 `unsupported` 或讓 contract 落到
   `needs-review`。
8. 修改規則邏輯時同步新增或更新對應 `.test.ts`；回歸測試要覆蓋真正根因，
   條件／支付變更必須有規則層與正式 UI Browser 的 positive／blocked A/B。

## 5. 驗證

必讀 [驗證分級](../braverse-workflow/references/verification-levels.md)，依變更類型完成必要測試與正式 Browser 驗收；提交最低門檻維持根目錄 AGENTS 的要求。

官方卡文條件、代價、目標或 `Then` 的轉接，除單元測試外，必須確認 strict
contract 沒有遺失 runtime evidence；Browser 負向 fixture 要保留其他支付／目標
資源，避免只測到「付不起」而沒有測到「條件不成立」。完整防漏流程見
[official-text-contracts.md](references/official-text-contracts.md)。

## 6. 收尾

按 [驗證、文件與 Git](references/verification-and-git.md) 檢查最終差異、文件同步與完成條件。保留命令、環境、結束碼及結果；明確揭露正式流程尚未驗證的部分，不以 demo 或 contract verified 代替完整驗收。
