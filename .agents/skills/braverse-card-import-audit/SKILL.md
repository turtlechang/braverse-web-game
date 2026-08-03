---
name: braverse-card-import-audit
description: 建立或更新 Braverse 官方卡牌資料轉接流程，從系列匯入、候選資料驗證、效果覆蓋稽核、promote 到正式卡池，並在 Chrome 實際對戰逐色逐卡驗證紅、綠、藍、紫卡牌的卡面文字、UI 提示、能量支付、代價、目標、Then、FLIP、陷阱與錯誤；使用者要求新增系列、補卡牌效果、promote 候選卡，或重測尚未完整測試的卡牌時使用。
---

# Braverse 卡牌匯入與 Chrome 效果稽核

## 目標與邊界

把「官方資料轉換」和「實際遊戲行為」串成可追溯的驗收流程。完成條件不是只有 JSON 通過 schema，也不是只有卡牌詳情能顯示；每張納入範圍的基礎卡都要有資料路由證據，以及依卡面文字驗證過的互動結果。

- 先讀根目錄 `AGENTS.md`，再讀 `docs/game-rules.md`、`docs/card-data-import.md`、`docs/card-effects.md`、`docs/official-ui-reference.md`。
- 以 `cardNumber` 去除 `@` 變體作為效果稽核單位；異圖／促銷變體至少做載入、卡面與路由掃描，只有文字或效果不同時才另列語意案例。
- 明確區分「瀏覽器載入 smoke test」和「逐卡效果驗證」；前者通過不得宣稱後者完成。
- 規則文件標記 `[待確認]` 的行為不得自行猜測；記為阻塞／待官方確認並保留原文與依據。
- 保留既有未提交修改；不要提交 `node_modules/`、`dist/`、`test-results/`、截圖、token 或個人設定。除非使用者明確要求，不要自動 commit 或 push。

## 先建立任務契約

開始前記錄以下欄位，缺少會影響範圍的資訊才向使用者提問；否則依儲存庫現況合理推進：

- 系列／彈別、資料來源 URL、要納入的顏色（預設紅／綠／藍／紫）、卡號範圍與是否包含異圖變體。
- 目標階段：只匯入候選、完成 adapter／規則轉接、promote 正式卡池，或包含 Chrome 效果驗證。
- 驗收證據：測試命令、瀏覽器畫面／console 錯誤、每色卡牌矩陣與已知限制。
- 先執行 `git status --short --branch`，辨識既有修改。不要以 `git reset`、強制 checkout 或清理命令消除衝突。

## 階段一：匯入並分析候選資料

1. 比對既有 `scripts/import-bs3-candidates.mjs` 或同系列 importer；新系列沿用其 fetch、locale、product filter、輸出 schema 與錯誤處理，只替換系列 prefix、官方 product/category、輸出檔名及 inventory metadata。不要用複製檔案掩蓋不同的官方欄位或規則。
2. 將匯入結果放在 `data/candidates/`，不得直接寫入 `data/cards/`。同步新增或更新 `package.json` 的 `cards:import:<series>-candidate` 指令，以及對應 importer test。
3. 依現有命名執行匯入與效果覆蓋分析：

   ```powershell
   npm.cmd run cards:import:<series>-candidate
   npm.cmd run cards:analyze:<series>-candidate
   ```

4. 檢查候選檔、`docs/<series>-card-inventory.md` 與 `docs/<series>-effect-coverage.md`：卡號、基礎卡號、變體、顏色、類型、官方文字、來源 URL 與數量必須互相一致。把 `unsupported`、空 ability、尚未轉接的 `Then` 或條件分支列成待辦，不要直接 promote。
5. 若需新增效果型別，先更新 `src/game/types.ts`，再更新 adapter／規則／UI／AI 與對應測試；依 `src/game/`、`src/cards/`、React UI 分層，不在 UI 另寫規則。

## 階段二：候選驗證與 promote

先確認要 promote 的候選檔清單、正式卡池是否有同名檔，以及工作樹沒有不應被覆蓋的資料；再依序執行：

```powershell
npm.cmd run validate:candidate
npm.cmd run promote:candidate
npm.cmd run validate:cards
npm.cmd run check:card-pool
```

`promote:candidate` 會把候選資料移入 `data/cards/`、重建 `src/game/generated-card-pool.ts` 並清除已 promote 的候選檔；它是有狀態變更的步驟。若驗證失敗，停在候選區修正，不手動複製正式檔案。完成後確認 `data/candidates/` 沒有殘留本輪候選、`validate:cards` 與 `check:card-pool` 都通過。

若只要求匯入或效果轉接，不要擅自 promote；若使用者明確要求併入正式卡池，才執行 promote 並回報正式卡池數量與 registry 檢查結果。

## 階段三：準備 Chrome 對戰稽核

1. 先完成 `npm.cmd run build`；需要 dev server 時使用 `npm.cmd`，避免 Windows PowerShell 的 `npm.ps1` execution policy 問題：

   ```powershell
   npm.cmd run build
   npm.cmd run dev -- --host 127.0.0.1 --port 5173
   ```

2. 使用實際 Chrome（可搭配 `chrome:control-chrome`）開啟 `http://127.0.0.1:5173/`。需要可重複的 headless smoke 時才使用 repo 既有 Playwright script；Playwright 報告不能取代使用者要求的 Chrome 互動稽核。
3. 依顏色分批建立合法測試牌組。每副牌組包含被測卡、支付所需的支援卡、可作為合法／不合法目標的餅乾與觸發條件；牌組不足以容納整個系列時，拆成多副牌組並在矩陣保留每張卡的證據。
4. 逐張卡先查看卡牌詳情，再在正式戰鬥狀態中執行效果。若只能透過 demo／`test-state` 觸發，標記為局部驗證，不得宣稱正式流程已通過。

## 階段四：逐卡、逐色語意驗證

對紅、綠、藍、紫各色的每張基礎卡，依 `references/card-audit-matrix.md` 記錄結果。至少覆蓋下列檢查；不適用項目寫 `N/A` 並說明原因：

- **文字與時機**：卡面文字、`Activate`／`OnPlay`／`Your Turn`／`Once per turn`、被動效果與來源卡離場規則一致。
- **UI 提示**：效果面板、卡牌詳情、下一步／上一步／取消／略過、合法目標候選、選取數量與無合法目標時的自動略過或中止均正確；不得出現錯誤 overlay、空白提示或卡死 pending decision。
- **支付**：指定顏色、任意能量、活躍／橫置支援卡、支付不足、取消支付與付款後狀態；不要只測「能成功付款」一條路。
- **代價**：HP、手牌、棄牌區、支援區、休息區、牌庫與橫置等代價必須在效果前正確支付，代價不足時不能發動。
- **目標**：自己的／對手、顏色、等級、剩餘 HP、區域、數量上限、`up to` 選 0、同一目標重複限制與無目標路徑。
- **結算**：傷害、HP、昏厥／休息區移動、牌區移動、橫置／活躍、攻擊修正、`Then` 後續效果與來源離場後的停止條件。
- **特殊類型**：FLIP 的揭示、分支選擇、攻擊者／目標、卡片去向；陷阱的埋置／觸發／條件／攻擊後半段；物品、場景與支援卡的放置與持續效果。
- **瀏覽器健康**：Chrome console、React error、網路錯誤、重載後資料、結算後回合與勝負流程；有線上協定變更時另測本機雙瀏覽器同步。

每色都要先完成「全卡載入／詳情掃描」，再完成「語意案例」。若一張卡的效果和其他卡相同，可以共用規則回歸測試，但仍要在矩陣列出該卡的卡面與實際載入證據。

## 階段五：Bug 修正與回歸

發現問題時，記錄卡號、原文、牌組與狀態設定、操作步驟、預期、實際、截圖／console、疑似層級（parser／adapter／rule／protocol／AI）。先判定是資料轉接、規則引擎、決策 UI、付款、目標選擇或線上同步的根因，再做最小修改。

- 規則或 adapter 修改：新增最近模組的 `.test.ts` 回歸測試，並同步更新 `docs/` 的已確認／待確認狀態。
- UI 或付款／目標流程修改：測合法與不合法兩條路徑；若本機與線上共用流程，兩者都確認。
- 每次修正後先跑目標測試，再重跑受影響顏色；不得只依賴一個「剛好通過」的牌序或種子。
- `test-results/` 可存放暫時證據但不得提交；回報時提供檔名或 console 摘要即可。

## 完成前驗證與回報

依變更風險執行：

```powershell
npm.cmd test -- --maxWorkers=1
npm.cmd run lint
npm.cmd run build
npm.cmd run validate:cards
npm.cmd run check:card-pool
git diff --check
```

若修改 AI，再執行 `npm.cmd run test:ai:browser`；若修改線上協定，再執行 `npm.cmd run test:online:match:browser`。只在實際執行後回報通過；lint 的既有 warning、Vite chunk warning 或環境限制要分開列出。

最終回報使用以下摘要：

```text
系列／範圍：
候選匯入：檔案數、基礎卡數、變體數、來源：
轉接／promote：執行命令與結果：
Chrome 稽核：紅／綠／藍／紫各色 全卡載入／語意通過／阻塞／未測：
已修正 Bug：卡號、根因、回歸測試：
未完成與風險：
驗證命令：
Git：是否 stage／commit／push：
```

## 直接參考

- `references/card-audit-matrix.md`：逐卡矩陣、案例欄位與 Bug 紀錄格式。
- `docs/card-data-import.md`：官方資料欄位、候選區、validate／promote 與 registry 流程。
- `docs/game-rules.md`：規則裁決優先順序與待確認項目。
- `docs/card-effects.md`：可用 runtime `CardEffect` 型別。
- `docs/official-ui-reference.md`：效果提示、支付、目標與戰鬥 UI 參考。
- `docs/<series>-card-inventory.md`、`docs/<series>-effect-coverage.md`：系列實際卡牌清單與轉接覆蓋狀態。
