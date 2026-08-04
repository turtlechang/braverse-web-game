# BS4 卡牌、RNG、responsive 與互動稽核報告

日期：2026-08-04

## 結論

BS4 的資料轉接、固定 seed benchmark、平板版面 gate、條件卡雙路徑與待補 UI 互動覆蓋已完成本輪驗收。這份報告把「逐卡載入 smoke」與「實際效果互動」分開計算，不把卡面能載入誤當成每個效果分支都已操作。

## 驗證結果

| Gate | 結果 | 說明 |
| --- | ---: | --- |
| Vitest | 167 個 test files、2592／2592 tests | `npm.cmd test -- --maxWorkers=1` |
| lint | 0 errors、1 個既有 warning | `src/hooks/useBattleActions.ts:67` 的 `useMemo` 依賴警告仍存在 |
| build | 通過 | `npm.cmd run build`；僅有既有 bundle chunk size warning |
| card-pool | 通過 | `npm.cmd run check:card-pool`，registry 與 `data/cards/*.json` 一致 |
| AI Chrome browser | 20／20 完成、stuck 0 | seed 1–20；含 1280×720、1024×576 等 responsive geometry matrix |
| BS4 card-check | 111／111 | RED／YELLOW／GREEN／BLUE／PURPLE 各 22，PURE 1 |
| 條件卡 met／unmet | 44／44 | 22 張卡各驗證成立與不成立兩條路徑 |
| 一般 fixture 互動 | 24／24 | 實際操作效果面板、支付、代價、目標、略過或卡牌詳情流程 |

## 逐卡 Chrome card-check

執行：

```text
npm.cmd run test:bs4:cards:browser
```

使用本機 Chrome（`C:/Program Files/Google/Chrome/Application/chrome.exe`），viewport `1440x960`，逐一開啟：

```text
?test-state=card:BS4-xxx
```

每張卡檢查正式卡面是否渲染、錯誤邊界／`Application Error`、console error 與 page error。結果：111／111 通過，0 例外。此 gate 是 card-check load／flow-entry smoke；效果分支由下面的專用情境與單元測試驗證。

證據：[bs4-browser-audit-evidence-2026-08-04-final.json](../data/decks/bs4-browser-audit-evidence-2026-08-04-final.json)

## 條件卡與一般 fixture 互動

執行：

```text
npm.cmd run test:bs4:interaction:browser
```

條件卡使用：

```text
?test-state=bs4-condition:BS4-xxx:met
?test-state=bs4-condition:BS4-xxx:unmet
```

22 張條件卡共 44 條路徑全部通過，包含條件成立時真正進入效果、支付／目標或 end-phase 結算，以及條件不成立時不建立錯誤 pending、不誤改變狀態。一般 fixture 另覆蓋 24 張卡的實際 UI 流程；不具備可互動能力的 plain card 不被計入這 24 張。

本輪特別修正並回歸：

- `BS4-052` 的 end-phase targeted damage：條件成立時會建立合法目標選擇並完成結算，條件不成立時略過。
- `BS4-029` 的 chained optional attack：來源餅乾的 `sourceOnly` `battle-to-break` 自動處理，再由 UI 選擇 break area 的 `break-to-battle` 目標。

證據：[bs4-browser-interaction-report-2026-08-04.json](../data/decks/bs4-browser-interaction-report-2026-08-04.json)

## RNG 與 AI benchmark

技能、物品、場景與 Refresh 共用同一個可重現的 step seed 傳遞。固定 seed 的 100 場矩陣兩次報告 SHA-256 相同：

```text
55D559781B2A29174E50C0782192D68BF2B029C1FED8D9D34D45A8F16A16F2E1
```

報告：

- [bs4-benchmark-report-100-fixed.json](../data/decks/bs4-benchmark-report-100-fixed.json)
- [bs4-benchmark-report-100-fixed-rerun.json](../data/decks/bs4-benchmark-report-100-fixed-rerun.json)

Chrome AI browser 另以 seed 1–20 執行完整對局流程，20 場均正常結束，沒有 stuck 或 effect-panel deadlock。勝率僅作為後續牌組調整的觀察資料，不在本輪直接定義 BS4 環境強度。

## Responsive geometry gate

`npm.cmd run test:ai:browser` 會在同一場正式對局中巡檢多個 viewport，包含平板橫向常見的 `1280x720` 與 `1024x576`。本輪 gate 通過：

- 戰鬥區支援區比例維持在規則要求範圍。
- 手牌沒有與戰鬥區或左右 utility／break zone 產生實質重疊。
- 上下方 hand、utility、戰鬥區與回合欄仍能完成 DOM 幾何檢查。

## 尚未涵蓋的範圍

- 這份報告不是官方規則裁定，也不取代逐張卡的人工牌面比對。
- 111 張 card-check 不代表每張卡的所有可選分支都已在瀏覽器逐一窮舉；目前以 44 條條件路徑、24 張一般 fixture、對應規則／adapter 單元測試與 AI 對局組合覆蓋。
- 正式 BS4 環境強度仍需在牌組版本固定後，再以更多真實牌組與對局樣本觀察；下一階段可進入 BS5 資料準備期，但不應直接 promote 到正式卡池。
