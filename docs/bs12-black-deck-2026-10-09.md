# BS12 黑色牌組

依使用者原清單建立 `BS12 黑色｜Arena`（`bs12-black-arena`），主牌18種／60張、Extra Deck3種／5張。全部21種卡都已在正式卡池，沒有匯入或promote新卡，也沒有追加前次錯誤加總所提出的三張。卡號及張數完整保存在 `data/decks/bs12-black-arena.json`。

黑色新增於既有藍／綠／黃／紅／紫之後。AI選單僅保留這六副BS12牌組，其他牌組選單與開局配方維持BS12優先。已安裝五色的玩家只新增黑色；既有編輯、刪除與玩家資料保留。

## 驗證

環境為Windows、工作目錄 `C:/Users/WH3FTURTLE/Documents/braverse-web-game`，基準commit `15864c6b`。本次僅新增配方及註冊／選單，未修改規則引擎、效果轉接或AI決策。

| 檢查 | 實際結果 |
|---|---|
| `npm.cmd test -- --maxWorkers=1 src/game/bs12-deck-presets.test.ts src/components/MainMenu.test.tsx` | 2檔／24項、exit 0；逐張清單、標準賽制合法性、60張主牌及5張Extra、唯一實體ID、五色玩家升級保留資料 |
| `npm.cmd run build` | exit 0；既有chunk大小警告保留 |
| `npm.cmd run lint` | exit 0 |
| `npm.cmd run test:ai:browser` | PASS、exit 0；使用最終build、本機preview 4199及Chrome |
| 專用選單Browser | 1366×768及1164×777，exit 0；六副清單保存、六色AI選項、選黑色並進入開局、線上選單順序 |
| 固定種子AI對局 | 20261009～20261012，黑對藍、兩方Lv.5、交換先後手、800步上限；4／4正常完成，0 error／stuck |

測試TEMP／TMP指定既有 `output/bs12-blue-check/temp`。產物與日誌在 `output/bs12-black-check/`，最終專用Browser為 `browser-final4.log`及`browser-results.json`。舊專用腳本兩次定位逾時及一次線上提示選項期待失敗保留；改用目前主選單DOM並排除提示選項後通過，沒有修改產品來遷就測試。

本次執行相關測試，未重跑完整Vitest；先前804檔／17,133項結果不當成本次全套驗證。線上部分只驗選單，未進行黑色雙人完整同步對局；四場AI對局是可完成性檢查，不代表勝率比較。未修改AGENTS、未commit／push，既有修改與產物保留。
