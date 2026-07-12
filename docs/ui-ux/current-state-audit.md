# U0 現況稽核報告

> 建立日期：2026-07-12
> 稽核範圍：HEAD `3d5d514`（main == origin/main）
> 基準文件：`docs/roadmap.md`、`docs/game-rules.md`、`docs/ui-reference/braverse_ui_interaction_contract_v1.md`、`docs/ui-reference/braverse_codex_uiux_execution_plan_v2.md`
> U0 原則：只記錄，不修改正式 UI、規則、測試、型別、網路協議或既有文件。

---

## 1. 基準資訊

| 項目 | 值 |
|---|---|
| Git HEAD (full) | `3d5d51419556a37bf6d75701fa432c12b64b42f9` |
| Git HEAD (short) | `3d5d514` |
| Branch | `main` |
| 與 origin/main 同步 | 是 (`## main...origin/main` 空白) |
| 未追蹤檔案 | `docs/ui-reference/braverse_codex_uiux_execution_plan_v2.md`、`docs/ui-reference/braverse_ui_interaction_contract_v1.md`、`src/game/debug-stuck-repro.test.ts` |
| Build | 通過 (`tsc -b && vite build`) |
| Lint | 待執行（驗證階段） |
| Test | 101 files, 1591 tests passed（排除 `src/game/debug-stuck-repro.test.ts`） |
| Bundle (raw) | 736.61 KiB（index-lN2mZfaE.js） |
| Bundle (gzip) | 154.03 KiB |
| Bundle budget | raw 850 KiB / gzip 180 KiB — OK |

### 來源文件 SHA-256

| 檔案 | SHA-256 |
|---|---|
| `docs/ui-reference/braverse_codex_uiux_execution_plan_v2.md` | `DE9A19898A297A2029E72814CA6C9BCDE2D35A35A473012078DB5A9A0E486CDB` |
| `docs/ui-reference/braverse_ui_interaction_contract_v1.md` | `8DF20D2C57977F2125EB523C114C8A52A7E98B16C9BB91FECDA4944911478FDC` |
| `docs/roadmap.md` | `CAFDBD84883A132DB70F8E2491ECD4B78211657857EBDB31D4F731D5831F7945` |
| `docs/game-rules.md` | `3F13DB946EF52BF188D1B2E49DE36E48B0D0F1F438284E54C4D4E9ED1A5ECC87` |
| `src/game/types.ts` | `8F8C8B45E4BCB7AEC14C40E6837E85B178980907760412EC1C64646B942B93C9` |

### Dist 產物 SHA-256（主要檔案）

| 檔案 | SHA-256 |
|---|---|
| `dist/assets/index-lN2mZfaE.js` | `91EA33F27C2EA9179F3CD52EF89D71E2E3DE4A3D3E86A98BEB6743EC4D9E00BF` |
| `dist/index.html` | `67E85B641AEDCEFB0A002B55B32A25EDAA2A22805DA15887DBC2FFEEC1B7B166` |

> 註：`docs/roadmap.md` 標示舊 bundle 基準為 731.11 KiB raw / 152.39 KiB gzip，已過期。U0 不回頭修改舊文件。

---

## 2. 父計畫階段對照（Phase Crosswalk）

父計畫各階段以當前 HEAD 程式碼與測試重新評估：

| Phase | 狀態 | 說明 |
|---|---|---|
| Phase 0（規則引擎核心） | Complete | 純函式引擎、GameCommand 指令層、1545+ 測試；已完成並多次迭代強化 |
| Phase 1（主題 tokens） | Complete | 五套 theme variant 與設計 tokens（commit `3170569`） |
| Phase 2（Replay + Bundle） | Complete | ReplayIssueBundleV1、複製 UI（commit `6b772f3`） |
| Phase 3（卡牌池匯入） | Complete | BS1/BS2 + 五色起始牌組匯入；25 張未支援卡補齊 |
| Phase 4（AI Lv.1–4） | Complete | AI 決策完整四層；20 份 BS2 訓練文件 |
| Phase 5（線上對戰 MVP） | Complete | ws server、房間、OnlineBattleView、雙瀏覽器驗證 |
| 維護流程（CHANGELOG 等） | Complete | 已從 README 抽出獨立文件 |
| V1 退出檢查（真人試玩） | Not Verified | 待完成 |
| P3 產品深化 | Partial | 指令層已完成、Bundle code-split 已完成、UI wireframe 已完成、AI Lv.5 暫緩、拖移卡牌延後 |
| U0（本次稽核） | In Progress | 本文件即為 U0 產出之一 |

---

## 3. 子系統差距分析

### 3.1 規則結算（Battle Resolution）

#### 3.1.1 Break Level Sum 10 敗北時機

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| 完成本張 HP 的 FLIP／必要回應後立刻敗北，不再處理下一張 HP、下一目標或後續效果 | `resolveBasicVictory()` / `resolveBreakLevelVictory()` 清除全部 pending state 後標記 finished；但在多目標傷害逐張 HP 處理流程中，break level 是在全部 damage 處理完才檢查，而非在每張 HP 處理後立即檢查 | 規則結算錯誤：目前會等全部 blocking pending 結束才判定勝負，而非在當前 HP 的 FLIP 回應後立即判定 |

**證據**：`src/game/victory.ts:18-37` 的 `getBasicDefeatReason()` 在 `breakArea level >= 10` 時回傳 `break-level-limit`，但此函式被呼叫的時機並非在每張 HP 翻開後的 FLIP 回應節點內。`src/game/battle.ts` 的傷害解析流程需進一步追蹤呼叫點。

**後續責任**：規則引擎（`src/game`）— 修改傷害結算流程，在每張 HP 翻開、FLIP 檢查、必要回應完成後立即呼叫 `evaluateBasicVictory()`，而非等全部攻擊效果結束。

#### 3.1.2 一般效果傷害逐張翻開

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| 傷害必須逐張翻開 HP，每張翻開後檢查 FLIP，不可批次移除多張 | 效果傷害（非來自攻擊）可批次移除多張 HP，繞過逐張翻開與 FLIP 插入 | 效果傷害尚未強制逐張處理；多張 HP 可能在同一狀態轉換中被移除 |

**證據**：`src/game/effects/execute.ts` 的傷害效果執行邏輯中存在批次移除模式。

**後續責任**：規則引擎 — 無論是攻擊傷害還是效果傷害，必須逐張處理 HP 移除，每張後檢查 FLIP 與敗北。

#### 3.1.3 多目標效果逐目標結算

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| 宣告時一次選定目標，以 `orderedTargetIds` 逐目標結算；每個目標結算後檢查 FLIP 與敗北，才進入下一目標 | 目前多目標效果並非逐目標結算；沒有正式的 `orderedTargetIds` 權威欄位 | 缺少正式的目標順序機制；多目標效果可能批次結算 |

**證據**：`src/game/types.ts` 中 `PendingEffectOrder` 型別存在，但沒有明確的 `orderedTargetIds` 欄位與逐目標結算流程。目前的 `PendingEffectOrderKind` 為 `'on-play'`，由 `PendingDecision` 機制支撐。

**後續責任**：規則引擎 + UI — 建立 `orderedTargetIds` 型別、宣告 UI、逐目標結算引擎。

#### 3.1.4 戰鬥區清空補位規則

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| 戰鬥區清空時可補 0 至離場數量餅乾；只有沒有任何可登場餅乾時才敗北 | 戰鬥區清空後跳過補位的程式與測試和「可補 0 張；仍有可登場餅乾不立即敗北」決策相衝突 | 補位邏輯與測試可能尚未完整反映「可補 0 張」的產品決策 |

**證據**：`src/game/game-rules.md:32-33` 已確認補位規則，但 `src/game/victory.ts:28-34` 的 `getBasicDefeatReason()` 僅在非 pendingReplacement 且 battleArea 為空時才判定 `no-cookie-available`。補位流程（`src/game/replacement.ts`）需確認可由玩家選擇補 0 張。

**後續責任**：規則引擎 — 確保補位流程允許選擇補 0 張；只有手牌無可登場餅乾時才敗北。

#### 3.1.5 非 FLIP HP 翻開後立即進棄牌區

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| 每張 HP 翻開後，非 FLIP 卡應在同一次狀態轉換中進棄牌區 | 非 FLIP HP 翻開後會在處理流程中進棄牌區，但 UI 無法穩定呈現逐張翻開 | UI 呈現問題：逐張翻開的視覺效果不穩定 |

**證據**：`src/game/battle.ts` 的 `resolveNextDamage()` 與 `resolveFlip()` 處理邏輯。

**後續責任**：規則引擎 + UI — 確保逐張 HP 處理的 UI 狀態可被穩定觀察與截圖。

---

### 3.2 指令與驗證層（Command & Validation）

#### 3.2.1 RuleValidator 獨立公開介面

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| 獨立公開的 `RuleValidator` 介面，讓 UI 可在不改變 GameState 情況下驗證合法性 | UI 主要透過 `applyGameCommand()` 驗證，該函式會同時修改狀態與回傳錯誤；沒有獨立唯讀驗證介面 | 缺少獨立 pubic `RuleValidator` 介面 |

**證據**：`src/game/commands.ts` 的 `applyGameCommand()` 同時負責驗證與狀態轉換。`src/game/legal-actions.ts` 的 `getLegalTurnCommands()` 提供部分合法性檢查，但並非每種命令都有對應的唯讀驗證。

**後續責任**：規則引擎 — 提取 `RuleValidator` 為獨立公開 API。

#### 3.2.2 付款生命週期型別

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| `PaymentDraft`、`PaymentReady`、`ConfirmingCommand`、`ServerAccepted` 等正式型別 | UI 有選擇能量支付的操作，但付款生命週期尚未成為正式型別（如 `PaymentDraft`、`PaymentState` 等） | 付款狀態機尚未正式型別化 |

**證據**：`src/game/energy.ts` 的 `selectEnergyPayment()` 與 `validateEnergyPayment()` 提供付款功能，`App.tsx` 的 `AttackPaymentPanel` 提供 UI，但沒有 `PaymentDraft` 或 `PaymentState` 型別。

**後續責任**：規則引擎 + UI — 將付款生命週期建模為正式型別與狀態機。

---

### 3.3 線上協議（Online Protocol）

#### 3.3.1 命令 ID 與狀態 Revision

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| 命令 ID、狀態 revision、接受確認與完整 rejection 呈現 | 線上命令採樂觀送出，但缺少命令 ID、狀態 revision、server acknowledgement 與完整 rejection 呈現 | 缺少樂觀更新的完整協議層：無命令 ID、狀態 revision、接受確認 |

**證據**：`src/hooks/useOnlineMatch.tsx` 的線上命令送出邏輯。

**後續責任**：網路層 — 加入命令 ID、狀態 revision 與完整 rejection 流程。

#### 3.3.2 協議版本化

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| 協議版本化 | 目前協議尚未版本化 | 網路協議無版本號欄位 |

**後續責任**：網路層 — 為所有線上訊息加入協議版本欄位。

#### 3.3.3 斷線與重連

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| V1 不提供自動重連；斷線沿用結束對局 | V1 斷線即結束對局，沒有重連狀態機 | U0 確認無差距（此為 V1 範圍外，不列為 V1 阻塞） |

**證據**：`src/hooks/useOnlineMatch.tsx` 的 disconnect 處理。

**後續責任**：Post-V1 — 重連機制（見 `product-decisions.md`）。

---

### 3.4 UI 語言與輸入

#### 3.4.1 語言支援

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| 英文預設，支援正體中文；i18n 架構 | UI 以正體中文硬編碼（如 `App.tsx` 的 `載入畫面中…`、`phaseLabels`、效果文字等） | 無英文預設、無 i18n 架構 |

**證據**：`App.tsx:68` 的 `ModalLoadingFallback` 使用中文、`src/components/gameUiLabels.ts` 的 `phaseLabels` 為中文、`src/components/effects/effectUiUtils.ts:206` 的效果文字為中文。

**後續責任**：UI — 建立 i18n 架構，將所有玩家可見文案提取為資源字串。

#### 3.4.2 輸入方式

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| 點擊為主，拖曳為輔 | 點擊已是主要操作方式 | 拖曳尚未實作（符合契約的輔助定位，非目前差距） |

**證據**：`App.tsx` 的操作方式（`onClick` 等事件處理器）。

**後續責任**：UI — 拖曳做為輔助輸入（Post-V1）。

---

### 3.5 視覺主題

#### 3.5.1 主題變體

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| UI/UX 計畫三方向探索（清楚優先／沉浸優先／平衡型） | 現有五套 theme variant（`deep-space`、`cyan-amber`、`holographic`、`midnight`、`neon`） | 現有五套與 UI/UX 計畫的三方向不一致；U0 只盤點，不刪除 |

**證據**：`docs/phase1-theme-variants.md`、`src/styles/themeStorage.test.ts`。

**後續責任**：UI — 評估五套 variant 如何收斂成三方向。

---

### 3.6 可及性（Accessibility）

#### 3.6.1 Modal 語意

| 契約要求 | 目前實作 | 差距 |
|---|---|---|
| modal 的 accessible name、標籤、焦點語意完整 | Deck Editor、測試設定等 modal 的 accessible name、標籤與焦點語意不足 | 可及性標記不完整 |

**證據**：`src/components/modals/DeckEditorModal`、`TestScenarioModal` 等元件缺少 `aria-label`、`role="dialog"` 等可及性屬性。

**後續責任**：UI — 為所有 modal 加入完整 accessible name、role 與焦點管理。

---

### 3.7 已實作與契約一致的項目（無差距）

以下項目目前實作與契約要求一致，U0 僅確認：

- 規則引擎與 UI 分離：`src/game/` 純函式，UI 透過 `applyGameCommand()` 操作
- 所有不可逆動作需經 GameCommand 驗證：`applyGameCommand()` 提供統一入口
- 場區結構：戰鬥區、支援區、休息區、牌組區、場景區、棄牌區、手牌已全部實作
- 60 張牌組、同卡號最多 4 張、至少 1 張餅乾：已驗證
- 支援區每回合最多放置 1 張：已由 `placeSupportCard` 管理
- 每張餅乾獨立 HP Stack：已實作
- AI 決策集中在 `src/game/ai.ts`：符合
- Fisher-Yates 種子洗牌與 replay 一致性：已實作
- 五色能量標記與支付驗證：已實作
- Blocker、Trap、Faint、AfterDamage 時機：已實作
- Refresh 流程與休息區懲罰：已實作
- commandLog 與 replay：已實作（含 shuffleSeed）
- ReplayIssueBundleV1：已實作
- WebSocket 伺服器與房間管理：已實作

---

## 4. 既有文件數值已過期備註

以下舊文件中的數值／敘述已隨後續 commit 過期，U0 不回頭修改舊文件，僅記錄於此：

| 文件 | 過期項目 | 當前值（U0 基準） | 備註 |
|---|---|---|---|
| `docs/roadmap.md:5` | Bundle 731.11 KiB raw / 152.39 KiB gzip | 736.61 KiB raw / 154.03 KiB gzip | 因新功能持續合併而自然成長 |
| `docs/roadmap.md:62` | Bundle 730.68 KB raw / 152.26 KB gzip | 736.61 KiB raw / 154.03 KiB gzip | 同上 |
| `docs/ui-audit-2026-07-11.md` | §5 的「P0 線上對戰彈窗修復」已解決 | — | 標記為已解決但未移除舊觀察 |

---

## 5. 既有未追蹤檔案聲明

U0 執行期間保留以下三個既有未追蹤檔案，不移動、不覆寫、不納入 U0 變更：

| 檔案 | 說明 |
|---|---|
| `docs/ui-reference/braverse_codex_uiux_execution_plan_v2.md` | UI/UX 執行計畫 V2（契約基準之一） |
| `docs/ui-reference/braverse_ui_interaction_contract_v1.md` | UI 互動契約 V1（契約基準之一） |
| `src/game/debug-stuck-repro.test.ts` | AI 卡死除錯測試（未追蹤，非正式測試） |

---

## 6. U0 界限

- 本文件不包含測試、build、lint 重新執行的結果（這些為驗證階段步驟 7-8）。
- 18 張截圖索引、雜湊、尺寸與狀態記錄於 `screen-inventory.md`。
- Blocking 決策完整清單見 `product-decisions.md`。
- 風險登錄見 `ui-risk-register.md`。
- 互動狀態矩陣見 `state-matrix.md`。
