# BS6 五色牌組 Browser 驗證

初次建立：2026-08-12；修正後複驗：2026-08-13

## 牌組

五副牌均為標準賽制、60 張、純 BS6 卡牌，並已接入主選單 AI preset：

- [BS6 紅色標準牌組](../data/decks/bs6-red-standard.json)
- [BS6 黃色標準牌組](../data/decks/bs6-yellow-standard.json)
- [BS6 綠色標準牌組](../data/decks/bs6-green-standard.json)
- [BS6 藍色標準牌組](../data/decks/bs6-blue-standard.json)
- [BS6 紫色標準牌組](../data/decks/bs6-purple-standard.json)

每副牌包含 40 張一般餅乾、8 張 FLIP、4 張物品、4 張陷阱與 4 張場景；每張卡最多 4 張。

## 驗證方法

```text
npm.cmd run benchmark:bs6-decks
npm.cmd run test:bs6:decks:browser
```

Browser 腳本從根路徑主選單載入自訂牌組，不使用 `test-state`，逐色完成：

1. 主選單載入自訂 BS6 牌組。
2. 選擇對應 BS6 AI preset。
3. 完成猜拳、先後攻、調度與起始餅乾。
4. 確認正式牌桌與雙方戰鬥區載入。
5. 從 Browser 的「對局資訊」執行 20 場 AI 驗證。

## 結果

### 牌組資料與固定 seed 矩陣

五副牌的資料驗證通過，固定 seed 100 場矩陣已完成 100／100 場；五色完成率均為 100%，卡死均為 0。修正涵蓋 HP 代價候選、支援區返回手牌代價、場景複合代價、陷阱 `choose-one` 展開，以及失效目標的安全略過。

| 顏色 | 場次 | 勝場 | 完成率 | 卡死 | 平均回合 |
|---|---:|---:|---:|---:|---:|
| 紅 | 20 | 15 | 100% | 0 | 15.0 |
| 黃 | 20 | 11 | 100% | 0 | 10.9 |
| 綠 | 20 | 7 | 100% | 0 | 13.95 |
| 藍 | 20 | 4 | 100% | 0 | 19.65 |
| 紫 | 20 | 14 | 100% | 0 | 12.5 |

勝率僅作為固定樣本觀察，不作為環境強度定案。

詳細數據見 [BS6 固定 seed 100 場報告](../data/decks/bs6-benchmark-report-100-standard.json)。目前勝率只作為觀察，不作為環境強度定案。

### 根路徑 Browser

五色均完成主選單載入、正式開局與牌桌渲染；從自訂牌組啟動的 Browser AI 驗證共 100／100 場完成，因此本次 Browser gate 為 **PASS**：

| 顏色 | 開局／牌桌 | AI 驗證完成 | 卡住 | 主要錯誤 |
|---|---:|---:|---:|---|
| 紅 | 通過 | 20／20 | 0 | 無 |
| 黃 | 通過 | 20／20 | 0 | 無 |
| 綠 | 通過 | 20／20 | 0 | 無 |
| 藍 | 通過 | 20／20 | 0 | 無 |
| 紫 | 通過 | 20／20 | 0 | 無 |

完整原始結果由腳本寫入 `test-results/bs6-deck-browser-validation.json`；該目錄不納入版本控制。修正後五色的 `browserErrors`、`browserHttpErrors`、`browserRequestFailures` 與 `pageErrors` 均為 0；外部卡圖與 favicon 等非規則素材請求會記錄為非阻斷警告，不影響遊戲流程 gate。

## 判定與後續

BS6 五色牌組已可匯入、在主選單選取並完成正式開局；修正後已達到「完整多場 Browser 實戰全綠」：五色各 20 場、合計 100 場均完成且無卡死。後續仍需把這份報告維持為正式卡池回歸基線，並以真人對戰補足非 AI 決策路徑；五色勝率排名仍不作為 BS6 環境強度結論。
