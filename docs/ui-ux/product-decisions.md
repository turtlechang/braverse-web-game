# U0 產品決策紀錄（Product Decisions）

> 建立日期：2026-07-12
> 基準 HEAD：`3d5d514`
> 來源：最新使用者決定 ＞ V1 父計畫 ＞ UI/UX 執行計畫 ＞ UI 互動契約建議
>
> 每條決策標記等級：Confirmed、Provisional、Blocking。

---

## 來源優先順序

| 優先級 | 來源 |
|---|---|
| 1 | 最新官方規則更新與勘誤 |
| 2 | 卡牌本身文字 |
| 3 | 最新官方完整規則 |
| 4 | 官方 Play Guide / Play Rules |
| 5 | 官方裁判指南與賽事規章 |

對產品決策的額外優先層級：

| 優先級 | 來源 |
|---|---|
| A | 本次最新使用者決定 |
| B | V1 父計畫（`docs/roadmap.md`） |
| C | UI/UX 執行計畫（`braverse_codex_uiux_execution_plan_v2.md`） |
| D | 互動契約建議（`braverse_ui_interaction_contract_v1.md`） |
| E | 已實作現況（HEAD 程式碼與測試） |

---

## Confirmed Decisions

### D-001：明確節點回應

| 欄位 | 內容 |
|---|---|
| ID | D-001 |
| 等級 | Confirmed |
| 內容 | 回應模型為明確節點回應；不讓動畫或 AI 自動跳過人類決策 |
| 來源 | 使用者決定（契約 §1） |
| 實作狀態 | 已由 `PendingDecision` + `hasBlockingPending()` 實現 |

### D-002：點擊為主，拖曳為輔

| 欄位 | 內容 |
|---|---|
| ID | D-002 |
| 等級 | Confirmed |
| 內容 | 輸入方式以點擊為主流程；拖曳做為輔助快捷，不得略過付款、目標或確認 |
| 來源 | 使用者決定（契約 §1） |
| 實作狀態 | 點擊已為主要操作；拖曳未實作（Post-V1） |

### D-003：競技科幻 70%、薑餅世界觀 30%

| 欄位 | 內容 |
|---|---|
| ID | D-003 |
| 等級 | Confirmed |
| 內容 | 視覺比例方向：競技科幻 70%、薑餅世界觀 30%，三方向變體皆遵守此比例 |
| 來源 | 使用者決定（契約 §1） |
| 實作狀態 | 現有五套 theme variant 皆處於探索階段；比例是方向，實際量測準則另列 Provisional |

### D-004：英文預設並支援正體中文

| 欄位 | 內容 |
|---|---|
| ID | D-004 |
| 等級 | Confirmed |
| 內容 | 預設語言為英文 `en`；支援正體中文 `zh-Hant`；語言 fallback 為 `en` |
| 來源 | 使用者決定（契約 §1） |
| 實作狀態 | 目前 UI 為正體中文硬編碼，無 i18n 架構 |

### D-005：UI 不直接修改 GameState

| 欄位 | 內容 |
|---|---|
| ID | D-005 |
| 等級 | Confirmed |
| 內容 | UI 不得自行修改正式 `GameState`；所有狀態變更必須經 `GameCommand` 與規則驗證 |
| 來源 | 使用者決定（AGENTS.md、契約 §2） |
| 實作狀態 | 已實作：`applyGameCommand()` 為統一修改入口 |

### D-006：付款送出前可取消與重選

| 欄位 | 內容 |
|---|---|
| ID | D-006 |
| 等級 | Confirmed |
| 內容 | 付款在確認送出前可取消與重選；ServerAccepted 後不可撤銷 |
| 來源 | 使用者決定（契約 §4） |
| 實作狀態 | 攻擊宣告前可取消選擇（依賴 React local state）；無正式 `PaymentDraft` 型別 |

### D-007：支援區一般放置限制

| 欄位 | 內容 |
|---|---|
| ID | D-007 |
| 等級 | Confirmed |
| 內容 | 每回合僅限制支援階段的一般放置 1 張；卡牌效果依卡文，不消耗一般放置次數 |
| 來源 | 使用者決定 + 官方規則 |
| 實作狀態 | 已實作（`placeSupportCard` + 階段管理） |

### D-008：戰鬥區清空補位規則

| 欄位 | 內容 |
|---|---|
| ID | D-008 |
| 等級 | Confirmed |
| 內容 | 戰鬥區清空時可補 0 至離場數量餅乾；只有沒有任何可登場餅乾時才敗北 |
| 來源 | 使用者決定 + 官方規則（`docs/game-rules.md` §1） |
| 實作狀態 | `skipDefeatedCookieReplacement()` 已實作 |

### D-009：Break Level Sum 10 敗北時機

| 欄位 | 內容 |
|---|---|
| ID | D-009 |
| 等級 | Confirmed |
| 內容 | 完成本張 HP 的 FLIP／必要回應後立刻敗北，不再處理下一張 HP、下一目標或後續效果 |
| 來源 | 使用者決定（U0 已查明差距） |
| 實作狀態 | 目前等全部 blocking pending 結束才判定（規則錯誤，見 RULE-001） |

### D-010：V1 不提供自動重連

| 欄位 | 內容 |
|---|---|
| ID | D-010 |
| 等級 | Confirmed |
| 內容 | V1 斷線即結束對局，不提供自動重連 |
| 來源 | 使用者決定 |
| 實作狀態 | 已實作（`useOnlineMatch` 的 disconnect 處理） |

### D-011：Chromium 為截圖基準

| 欄位 | 內容 |
|---|---|
| ID | D-011 |
| 等級 | Confirmed |
| 內容 | U0 截圖以 Playwright Chromium 為唯一基準；圖片本機保存、版控只保存索引與雜湊 |
| 來源 | U0 執行規範 |
| 實作狀態 | U0 執行中 |

### D-012：既有官方圖像的合法使用

| 欄位 | 內容 |
|---|---|
| ID | D-012 |
| 等級 | Confirmed |
| 內容 | 既有官方 Braverse 圖像屬非商業粉絲研究例外，不宣稱原創或已授權；新增公開素材必須原創或有授權並保存 credit |
| 來源 | `docs/ip-and-asset-policy.md` + 使用者決定 |
| 實作狀態 | Footer 已加非官方聲明；MIT LICENSE 含 Devsisters 素材除外條款 |

---

## Provisional Decisions

### D-101：競技／薑餅 70/30 視覺比例的量測方式

| 欄位 | 內容 |
|---|---|
| ID | D-101 |
| 等級 | Provisional |
| 內容 | 70/30 比例的可量測評分方式尚未定義（例如：依畫面面積、元件數量、決策 UI vs 裝飾元素等） |
| 來源 | 契約 §9 |
| 實作狀態 | 五套 theme variant 為探索階段；無正式量測準則 |
| 後續行動 | U2 設計系統階段定義評分方式 |

### D-102：CommandDraft 與付款狀態機

| 欄位 | 內容 |
|---|---|
| ID | D-102 |
| 等級 | Provisional |
| 內容 | `CommandDraft`、`PaymentDraft`、付款狀態機、server acknowledgement 皆為契約建議，尚未實作 |
| 來源 | 契約 §4 |
| 實作狀態 | 未實作 |
| 後續行動 | U1 建立正式型別合約 |

### D-103：Post-V1 重連機制

| 欄位 | 內容 |
|---|---|
| ID | D-103 |
| 等級 | Provisional |
| 內容 | Post-V1 重連狀態機：`Connected → ConnectionUnstable → Reconnecting → Reconnected` 或 `ReconnectExpired → MatchEnded`；期限、逾時行為待確認 |
| 來源 | 契約 §8 |
| 實作狀態 | 未實作（非 V1 範圍） |
| 後續行動 | Post-V1 規格設計 |

### D-104：五套 Theme Variant 收斂

| 欄位 | 內容 |
|---|---|
| ID | D-104 |
| 等級 | Provisional |
| 內容 | 現有五套 theme variant 如何收斂成正式三方向（清楚優先、沉浸優先、平衡型）尚未決定 |
| 來源 | 執行計畫 U2 |
| 實作狀態 | 五套皆可用（`deep-space`、`cyan-amber`、`holographic`、`midnight`、`neon`） |
| 後續行動 | U2 設計系統階段評估與收斂 |

### D-105：多目標處理順序（暫定發動玩家決定）

| 欄位 | 內容 |
|---|---|
| ID | D-105 |
| 等級 | Provisional |
| 內容 | 暫定由效果發動玩家決定 `orderedTargetIds` 的處理順序；若官方個別卡文或規則指定順序，以指定順序覆蓋 |
| 來源 | 契約 §1 Provisional + §4.3 |
| 實作狀態 | 尚未有正式 `orderedTargetIds` 機制 |
| 後續行動 | 實作時標記為 `orderPolicy: "player-choice"` 並等待官方確認（見 D-202） |

### D-106：2026 On-Play 修正的 `turnPlayerFirst` policy

| 欄位 | 內容 |
|---|---|
| ID | D-106 |
| 等級 | Provisional |
| 內容 | 先建模為 `turnPlayerFirst` 的可版本化 timing policy；正式上線前需保存官方來源 |
| 來源 | 契約 §1 Provisional |
| 實作狀態 | 未實作 |
| 後續行動 | 取得官方來源後實作（見 D-203） |

---

## Blocking Decisions

### D-201：多目標順序的正式權威

| 欄位 | 內容 |
|---|---|
| ID | D-201 |
| 等級 | Blocking |
| 內容 | 是否正式由發動玩家決定多目標處理順序？需要官方規則或逐卡資料支援 |
| 來源 | 契約 §12 |
| 影響 | 沒有官方來源前，不得自行加入 `orderedTargetIds` 的發動玩家決定規則 |
| 目前策略 | 實作時以 `orderPolicy` 欄位標記，允許未來切換 |

### D-202：2026 On-Play 修正的官方來源存檔

| 欄位 | 內容 |
|---|---|
| ID | D-202 |
| 等級 | Blocking |
| 內容 | 2026 On-Play 時點修正的官方來源檔案必須存檔於 repo；未取得前不得正式採用 `turnPlayerFirst` |
| 來源 | 契約 §12 |
| 影響 | 若 On-Play 處理順序錯誤，可能影響多個卡片的法定效果 |

### D-203：線上回應／補位倒數的期限規則

| 欄位 | 內容 |
|---|---|
| ID | D-203 |
| 等級 | Blocking |
| 內容 | 未來若加入線上回應／補位倒數，其期限、逾時預設選擇與敗北規則必須來自官方賽事規章或使用者明確決策 |
| 來源 | 契約 §12 |
| 影響 | 若任意設定逾時規則，可能與未來賽事規則衝突 |

### D-204：重連總時限（Post-V1）

| 欄位 | 內容 |
|---|---|
| ID | D-204 |
| 等級 | Blocking（已移出 V1，改列 Post-V1 Provisional） |
| 內容 | 重連總時限、是否可延長一次、逾時勝負文字需要官方賽事規則或使用者明確決策 |
| 來源 | 契約 §12 |
| 影響 | Post-V1 重連實作前必須解決 |

---

## 決策摘要

| 等級 | 計數 | ID |
|---|---|---|
| Confirmed | 12 | D-001 ~ D-012 |
| Provisional | 6 | D-101 ~ D-106 |
| Blocking | 4 | D-201 ~ D-204 |
