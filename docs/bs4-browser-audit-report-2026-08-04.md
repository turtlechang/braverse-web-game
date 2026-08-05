# BS4 卡牌、RNG 與條件情境驗證報告

日期：2026-08-04

## 結論

- AI benchmark 已改為以同一個可重現的 step seed 傳遞至技能、物品、場景效果與 Refresh；固定 seed 重跑兩次的 100 場矩陣報告完全一致。
- `BattleRow` 的物品支付 accessibility label 已改為「支付物品能量」，並以回歸測試確認不會誤用「支付技能能量」。
- 22 張條件卡已建立專用 `test-state`，共驗證 44 條 Chrome 路徑：每張各一條條件成立與不成立，全部通過。
- BS4 正式卡池 111 張已重新逐卡以 Chrome 載入稽核：111/111 成功，沒有 `role=alert`、錯誤邊界或 `Application Error`。
- 目前勝率只作為固定 seed 下的流程資料，不作為 BS4 環境強度排名定案；仍需更完整的互動情境與平衡分析。

## 1. AI benchmark RNG 修正

### 實作

- `takeAiStep` 為每一個 AI step 產生可重現 seed。
- AI 技能、物品、場景效果模擬與實際套用共用該 step seed。
- `applyGameCommand` 支援 `shuffleSeed`，確保效果執行器與 Refresh 使用同一個 seeded shuffle。
- 保留既有無 seed 呼叫的預設行為，避免影響一般互動流程。

主要檔案：

- [`src/game/commands.ts`](../src/game/commands.ts)
- [`src/game/ai.ts`](../src/game/ai.ts)
- [`src/game/ai/turn-handler.ts`](../src/game/ai/turn-handler.ts)
- [`src/game/ai-replay-fidelity.test.ts`](../src/game/ai-replay-fidelity.test.ts)

### 100 場矩陣

設定：AI Level 4、每色 20 場、每組對手 4 場、雙方先手各 2 場、單場最多 2,500 actions、seed `20260803`。

| 顏色 | BS3 baseline | BS4 final | 變化 |
| --- | ---: | ---: | ---: |
| 紅 | 15/20（75%） | 16/20（80%） | +5 個百分點 |
| 黃 | 7/20（35%） | 11/20（55%） | +20 個百分點 |
| 綠 | 7/20（35%） | 7/20（35%） | 0 |
| 藍 | 12/20（60%） | 12/20（60%） | 0 |
| 紫 | 7/20（35%） | 9/20（45%） | +10 個百分點 |

兩次 100 場執行結果：

- 完成：100/100
- 卡死：0
- 錯誤：0
- 固定 seed 報告 SHA-256：`55D559781B2A29174E50C0782192D68BF2B029C1FED8D9D34D45A8F16A16F2E1`
- [`bs4-benchmark-report-100-fixed.json`](../data/decks/bs4-benchmark-report-100-fixed.json)
- [`bs4-benchmark-report-100-fixed-rerun.json`](../data/decks/bs4-benchmark-report-100-fixed-rerun.json)

## 2. 物品支付 aria label

`BattleRow` 會依目前等待的支付來源顯示不同文案：

| 支付來源 | accessibility label |
| --- | --- |
| 技能 | `選擇〈支援卡〉支付技能能量` |
| 物品 | `選擇〈支援卡〉支付物品能量` |
| 場景 | `選擇〈支援卡〉支付場景能量` |

回歸測試位於 [`src/components/battle/BattleRow.test.tsx`](../src/components/battle/BattleRow.test.tsx)，明確斷言物品流程包含「支付物品能量」且不包含「支付技能能量」。

## 3. 22 張條件卡專用情境

測試 URL 格式：

```text
?test-state=bs4-condition:BS4-xxx:met
?test-state=bs4-condition:BS4-xxx:unmet
```

已覆蓋：

`BS4-011`、`BS4-012`、`BS4-014`、`BS4-016`、`BS4-020`、`BS4-023`、`BS4-024`、`BS4-039`、`BS4-040`、`BS4-048`、`BS4-049`、`BS4-052`、`BS4-053`、`BS4-059`、`BS4-061`、`BS4-073`、`BS4-083`、`BS4-089`、`BS4-090`、`BS4-094`、`BS4-106`、`BS4-107`。

每張卡均完成：

- `met`：條件成立的狀態建立、規則條件判定與 Chrome 路由標記。
- `unmet`：條件不成立的狀態建立、規則條件判定與 Chrome 路由標記。
- 結果：22 張 × 2 路徑 = 44/44 通過，沒有頁面例外。

主要檔案：

- [`src/game/demo.ts`](../src/game/demo.ts)
- [`src/game/demo.test.ts`](../src/game/demo.test.ts)
- [`src/cards/official-effect-adapter.ts`](../src/cards/official-effect-adapter.ts)
- [`src/cards/official-effect-adapter.test.ts`](../src/cards/official-effect-adapter.test.ts)

其中 BS4-012、BS4-014、BS4-052 補上原本解析結果缺少的條件效果，並同步加入轉接層測試。

## 4. Chrome 逐色逐卡稽核

使用正式卡池 `?test-state=card:BS4-xxx`，逐張載入並檢查對戰桌、測試狀態／效果流程與頁面錯誤訊號。

| 顏色 | 卡數 | Chrome 載入成功 | 頁面例外 |
| --- | ---: | ---: | ---: |
| 紅 | 22 | 22 | 0 |
| 黃 | 22 | 22 | 0 |
| 綠 | 22 | 22 | 0 |
| 藍 | 22 | 22 | 0 |
| 紫 | 22 | 22 | 0 |
| PURE | 1 | 1 | 0 |
| 合計 | 111 | 111 | 0 |

一般 fixture 中有 24 張會自然停在待選目標、支付代價或已略過的攻擊後續效果；這些是可觀測的遊戲流程狀態，不是頁面崩潰。22 張條件卡另以專用情境完成成立／不成立驗證，不再只依賴一般 fixture。

Chrome 證據摘要：[bs4-browser-audit-evidence-2026-08-04-fixed.json](../data/decks/bs4-browser-audit-evidence-2026-08-04-fixed.json)。

## 5. 驗證結果

本次已執行：

- `npm.cmd test -- src/game/ai-replay-fidelity.test.ts --maxWorkers=1`
- `npm.cmd test -- src/components/battle/BattleRow.test.tsx src/cards/official-effect-adapter.test.ts --maxWorkers=1`
- `npm.cmd test -- src/game/demo.test.ts --maxWorkers=1`
- Chrome 22 張條件卡 × 2 路徑
- Chrome BS4 111 張逐卡載入
- 固定 seed benchmark 100 場 × 2 次

結果：

- `npm.cmd test -- --maxWorkers=1`：167 個 test files、2,589 個 tests 通過。
- `npm.cmd run lint`：0 errors、1 個既有 `useBattleActions.ts:67` React Hook warning。
- `npm.cmd run build`：通過；Vite 僅提示既有的大型 chunk warning。
- `npm.cmd run check:card-pool`：通過，runtime registry 與 `data/cards/*.json` 一致。
- `git diff --check`：通過。
- `npm.cmd run test:ai:browser`：未通過既有 responsive geometry baseline，`1280x720` 支援區佔比 `0.2400` 超出腳本門檻；未觀察到本次卡牌／RNG 修正造成的規則例外。

## 限制與判定邊界

- 逐卡 Chrome 稽核是正式 `card-check` 的載入與流程入口驗證；條件卡的規則語義由專用情境、規則測試與 44 條瀏覽器路徑補足，並不等同於每張卡所有分支都已由人工逐一點擊。
- 固定 seed 解決了 benchmark 的重現性問題，但 100 場樣本仍不足以單獨作為環境強度定案依據。
- 在完成更完整的逐卡互動覆蓋、對局樣本與規則裁決前，不將目前勝率排名宣稱為 BS4 環境強弱結論。
