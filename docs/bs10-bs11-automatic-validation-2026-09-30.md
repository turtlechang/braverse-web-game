# BS10／BS11 自動驗證與六色賽事

本輪把可重跑的稽核入口、獨立預期的小批次 Browser 驗證與真實牌組壓力測試接在一起。正式來源為 checkout 的 BS10 164 筆與 BS11 159 筆，共 323 筆、239 個基礎卡號。未修改來源資料、候選資料或 promote 狀態。

## 可重跑入口

```powershell
npm.cmd run cards:inventory:bs10-bs11
npm.cmd run cards:verify:bs10-bs11
npm.cmd run cards:verify:bs10-bs11 -- --strict
npm.cmd run cards:verify:bs10-bs11 -- --legacy
npm.cmd run tournament:bs11:generate
npm.cmd run tournament:bs11:1024 -- --smoke
npm.cmd run tournament:bs11:1024
```

`--inventory-only` 只產生來源片段清單；一般驗證會重新 build，再開自己的 localhost preview，實際點擊 UI。每次結果獨立寫入 `test-results/bs10-bs11-verification/<UTC timestamp>/`，保留命令、結束碼、程式／資料指紋、分支結果與截圖。`--strict` 在缺少獨立預期或新鮮證據時回傳 2，不能把四張通過冒報為整系列通過。`--legacy` 另批次執行既有驅動；單支失敗會保留非零狀態並繼續其他獨立驅動，失敗不會被後續通過覆蓋。

## 證據與人工審核的分工

| 層級 | 本輪方法 | 能證明的範圍 |
| --- | --- | --- |
| 來源／靜態契約 | BS10 164／164、BS11 159／159 strict contract | 來源及 runtime 契約的靜態檢查 |
| 來源片段盤點 | skill／attack／attack-then／flip 共 614 片段，73 支舊 Browser 驅動引用 | 導航與待補清單；不等於完整語意分支 |
| 獨立預期 | 逐張閱讀原始官方圖，固定圖檔、來源紀錄與預期雜湊 | BS10-003、BS11-003、020、095 的指定 FLIP 分支 |
| Browser | 雙尺寸、真實點擊與命中目標檢查、數量選取、公開區域精確比較、指令順序 | 指定 localhost fixture 的付款／操作／結果與卡圖 |
| 大量對局 | 1024 個不同合法構築、固定種子、既有 AI Lv.5 與規則引擎 | 對局能否走到勝負與本模擬母體的排名 |
| 正式／線上／CDN | 與上列分開記錄 | 本輪未重新完成逐卡正式／線上驗收 |

原圖與預期只需在內容改變時重新審核；重跑負責檢查數值、UI 及指令。來源、預期、圖檔或程式指紋改變後，舊證據不能自動保持 verified。重複 PASS、失敗後另有 PASS、強制點擊、沒有圖片載入、少一個分支或尺寸均不能滿足本批驗證條件。

Wind Archer／@1 另有雙尺寸 FLIP 插入正反 8／8：普通攻擊兩點後，再用綠色道具支付追加傷害，翻到 Matcha FLIP；此 fixture 的防守方為 AI，自動發動 FLIP 抽 1 張。驅動核對實際指令、手牌／牌庫變化，再點擊攻擊者續接的第二段效果並抽 2 張；缺少道具時支付按鈕停用、手牌／牌庫不變。這不包含人類防守方的 FLIP 選擇 UI；該部分由上列四張獨立預期小批次另計。

小批次以「抽 1／抽 0／不發動」覆蓋四張同機制 FLIP；BS10-003 另驗證最後一張 HP 與補位續接。合計 30 條雙尺寸路徑。另有 14 項驗證器測試，故意改錯手牌、牌庫、棄牌、支援、戰鬥狀態，以及新鮮度／缺分支／重複證據。這些是驗證器的錯誤偵測測試，不能冒稱規則引擎 mutation testing。

仍有 610 個來源片段未接入此獨立預期格式；它們可能已有舊測試，但不能由腳本引用、strict contract 或正常完成對局直接升格。614 也不是完整分支分母：條件、代價、印刷差異、FLIP 插入及線上序列仍須逐一列舉。不能宣稱 BS10／BS11 全卡效果與 UI 已經全面正確，也沒有量測人工工時節省比例。

## 壓力測試找到的缺陷

初次賽程失敗紀錄保留於 `test-results/bs11-1024/full/matches-*.jsonl`，未移除問題卡牌或改換有利種子。原牌組、原種子已加入 `src/game/ai/bs11-tournament-regression.test.ts`。

| 原失敗輪次／桌號 | 缺陷 | 修正 |
| --- | --- | --- |
| 第1輪／70 | Golden Cheese 已從休息區進戰鬥區，仍被當成休息區發動來源 | 規則層重新檢查 break-source-to-battle 的來源區域 |
| 第1輪／75、106 | Wind Archer Then 的追加傷害被 FLIP 插入後，抽牌控制權留在防守方 | 效果傷害完成後還原攻擊後階段，交還效果控制者 |
| 第1輪／149 | Shadow Milk 沒有匹配 EXTRA 技能，AI 仍支付二選一的可選代價 | AI 先用共用合法性檢查確認至少一個模式可執行 |
| 第1輪／180 | 跨 Cookie 合計 HP 代價只選一張 HP 不足的 Cookie | 共用 AI 付款選擇器依公開 HP 累積到規定總量 |
| 第1輪／469 | 多段陷阱的明確空目標覆蓋支援卡棄置欄位 | 每個 support-to-trash 效果保留自己的合法目標 |
| 第2輪／24 | AI 替代 On Play 的預先模擬誤走來源 Cookie 原技能付款 | 使用替代 On Play 的權威發動 API，並按時機取得技能費用與效果 |
| 第6輪／369 | BS4-064 的 8G 支援條件未成立，陷阱目標預檢卻執行 Then | 目標預檢略過未成立的子效果，與 playTrap 執行階段一致 |
| 配對稽核 | 原配對器第三輪出現重賽，opponents Set 也會使 games／Buchholz 少計 | 六色賽事啟用不重賽限制，保持每副每輪一場，並在最終報告重新核對對手分 |
| 串行／並行比對 | AI 搜尋耗時受執行負載影響，Dark Cacao 隨機棄牌未收到種子 | 賽事注入固定搜尋時鐘；攻擊後效果傳入種子洗牌，保留節點／深度／500 步限制 |

以上均以原失敗種子重跑至實際勝者；針對性測試另涵蓋來源移動後禁止發動、分攤／單張／不足 HP，以及沒有可行 EXTRA 模式。正式賽程仍使用 seed 20260930，單局維持 500 步上限。AI Lv.5 的賽事搜尋保留既有節點與深度限制，注入固定時鐘排除不同執行負載造成的耗時降階；一般 UI AI 維持原有即時預算。四個隔離 worker 只執行權威模擬，配對、結果套用及排名仍由主程序依固定桌次處理；6 副×2 輪的串行／並行比對檢查逐場結果、步數、排名及統計完全相同，串行也禁止未注入的 Math.random。搜尋 elapsed telemetry 為注入時鐘數值，不是實際效能時間。

## 六色構築與賽制

六副種子牌組各 60 張主牌，主牌皆 BS11。主題為紅色樂隊烈焰、黃色魔法休息區、綠色風弓再活躍、藍色海流控制、紫色暗可可循環、黑色魔女特殊登場。以同顏色、同類型／等級的少量替換生成 1024 個不同主牌構築，保留主要組合零件；實際各色最低 BS11 主牌為紅 54、黃 54、綠 54、藍 55、紫 54、黑 56 張。五色可混入 PURE White Lily；黑色另有 Dark Enchantress EXTRA。這是手工設計與固定亂數取樣，不是已完成真人競技最佳化。

卡池與禁限採目前 checkout 的正式 runtime registry／Standard policy（禁限資料版本為 2026-02-13），沒有宣稱已核對 2026-09-30 外部最新官方禁限。每副皆檢查 60 張、同名張數、FLIP、EXTRA 與禁限合法性。

參賽分配為紅／黃／綠／藍各 171，紫／黑各 170；比例是指定母體，不是外部環境使用率。10 輪瑞士輪共 5120 局，勝 3 分、敗 0 分，採既有積分／Buchholz／預先種子排序；新賽程啟用不重賽限制，先按積分配對，再以總分差最小的兩桌交換修復貪婪配對的重賽。找不到合法交換就停止，不默默排入重賽。未完成沿用引擎各 1 分並標記整體 FAIL，不捏造勝者。八強採 1v8、4v5、2v7、3v6 單淘汰，共 7 局；無法完成的決賽不產生冠軍。

最終賽事結果、八強完整主牌與 EXTRA 見 [1024 副賽事報告](bs11-1024-tournament-2026-09-30.md)；機器可讀結果為 `data/decks/bs11-1024-report.json`。圓餅圖以最終 PASS 報告的參賽／八強／四強計數生成，失敗報告不能產生最終圖。

## 執行結果

最終賽事為 **PASS**：10 輪 Swiss 5120／5120 場完成、0 場卡住或超限、0 次重賽；TOP 8 單淘汰 7／7 場取得實際勝者。冠軍為黑色「魔女特殊登場 #062」，亞軍 #117，另兩副四強為 #103、#092；TOP 8 皆為黑色。獨立稽核重新計算每輪出場、勝者、步數上限、積分、Buchholz、決賽對戰與比例，結果見 `output/bs11-1024/result-audit.json`。執行期間記錄的全部來源指紋在完成後保持一致，見 `output/bs11-1024/runtime-provenance.json`；圖表另外記錄報告 SHA256。

最終完整 Vitest **489 檔／5,765 項（828.92 秒）**、全域 lint、build、AI Browser 6 項均通過，命令皆以結束碼 0 完成。本輪最終 runtime 的獨立 FLIP Browser 為 **30／30**，執行前後指紋一致；Wind Archer／@1 FLIP 插入續接正反以最終 build 補跑 **8／8**。補跑起初暴露驅動讀牌名只查找子卡面的定位問題；已改為讀取實際目標節點的圖片／fallback／title，正常 UI 操作重跑通過，並保留原失敗快照。最後兩支修改的驗證腳本 scoped lint 亦以結束碼 0 通過。

全部既有 Browser 驅動 **73／73 已執行，68 支結束碼 0、5 支結束碼 1**；整批結束碼 1，保留失敗而非宣稱全綠。報告為 `test-results/bs10-bs11-verification/2026-09-30T03-01-35-674Z/report.json`。這批自較早版本開始，期間有本輪規則修正及重新 build，故屬混合版本的失敗定位資料，不能取代最終 runtime 證據。其起始指紋 `6e01bed843f418de8614f60bdb85d61352f688ce1b1c31b6d290304885355e4d` 與最終獨立批次 `b5bf326f0665c228858ae70f8d41eff855d36d351fd484d81df352e76371b123` 不同；舊批次顯示的片段 verified 數字不能當作目前狀態。

| 失敗驅動 | 原始證據 | 分類 |
| --- | --- | --- |
| bs10-008-browser.mjs | BS10-008 卡圖等待逾時；request／console 有官方 WebP 的 ERR_NETWORK_ACCESS_DENIED | 圖片網路限制，未完成該路徑驗收 |
| bs10-009-browser.mjs | BS10-009 卡圖等待逾時；官方 WebP 的 ERR_NETWORK_ACCESS_DENIED | 圖片網路限制，未完成該路徑驗收 |
| bs10-first-batch-browser.mjs | BS10-001 ensureImage 逾時，imageFailures 記錄官方圖網路拒絕 | 圖片網路限制，未完成該路徑驗收 |
| bs10-ordinary-attack-browser.mjs | 006 已完成攻擊、昏厥與 Then 傷害；errors 空陣列 assertion 收到官方 WebP 網路錯誤 | 圖片網路限制，不能升格為整支通過 |
| bs10-second-batch-browser.mjs | 007 已選抽0並保留狀態，後續圖片 locator 等待逾時；官方 WebP 網路錯誤 | 圖片網路限制，不能升格為整支通過 |

原始報告分別保留於 `test-results/bs10-008-browser/report.json`、`bs10-009-browser/report.json`、`bs10-first-batch-browser/report.json`、`bs10-ordinary-attack-browser/report.json`、`bs10-second-batch-browser-007/report.json`，各相對路徑均以 `test-results/` 為根。沒有把 fallback 當成功載圖，沒有清除錯誤或放寬 assertion。失敗分類及原始資料雜湊另見 `output/bs11-1024/legacy-triage.json`。

目前新鮮證據為 `test-results/bs10-bs11-verification/2026-09-30T04-09-06-032Z/report.json` 的 30／30，以及 `test-results/bs11-050-053-browser/bs11-050-053-browser-1790743900349.json` 的 8／8。機器可讀驗證摘要見 `output/bs11-1024/verification-evidence.json`。完整逐卡效果矩陣仍未完成；後續以 3～5 張共用機制的小批次補獨立預期，再重跑正式／線上與可載圖環境，不能由本次1024副賽事取代。
