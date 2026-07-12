# Phase 1 — 元件狀態參考

最後更新：2026-07-12

對應 `docs/phase1-state-matrix.md` 的「共通元件狀態」段落，提供每個元件在不同狀態下的視覺規範。設計 token 集中在 `src/styles/tokens.css`。

## 1. 按鈕（`.btn` 系列）

| 狀態 | 主要 | 次要 | 危險 |
|---|---|---|---|
| default | 青→藍漸層 | 深藍面板 | 紅色軟底 |
| hover | 抬升 1px + glow 陰影 | 抬升 1px + 標準陰影 | 抬升 1px + danger glow |
| active | 平貼 | 平貼 | 平貼 |
| focus-visible | 主色 1px outline + glow | 同上 | 同上 |
| disabled | 灰底、無 hover | 同上 | 同上 |
| loading | 內嵌 `.spinner` 並隱藏文字 | 同上 | 同上 |

互動細節：
- 最小高度 40px（桌機）/ 44px（觸控）；行動版擴增到 48px。
- 文字 letter-spacing 0.05em；icon 與文字間距 8px。
- 鍵盤操作 `Enter`/`Space` 必須可觸發。

## 2. 輸入欄位（`.input`）

| 狀態 | 視覺 |
|---|---|
| default | 1px border-default、深色底、12px padding |
| focus | border-primary + 2px primary-soft 外光 |
| error | border-danger + 2px danger-soft 外光 |
| disabled | 灰底、文字 disabled 色 |

規範：
- 標籤（label）需明確 for 對應 input id。
- 錯誤訊息以 `<small class="input-error-text">` 顯示在欄位下方 4px 處。
- 鍵盤 `Escape` 清除目前焦點（不影響值）。

## 3. 卡牌

| 狀態 | 視覺 |
|---|---|
| default | 比例 3:4，圓角 14px，背景 surface-elevated |
| hover | 抬升 4px、primary glow 陰影 |
| selected | 外加 2px primary 環、scale 1.02 |
| disabled | opacity 0.5、不可 hover |
| face-down | 卡背材質 + 較小圓角 |
| 數量徽章 | 右上角 primary 軟底圓形 |

規範：
- hover 與 selected 不可同時啟動；選中優先。
- 觸控裝置無 hover 效果，只以 selected 環呈現焦點。

## 4. 徽章（`.badge` 系列）

| 變體 | 用途 | 顏色 |
|---|---|---|
| info | 中性資訊 | primary 軟底 / primary 文字 |
| success | 成功、合法、就緒 | success 軟底 / success 文字 |
| warning | 即將逾時、注意 | accent 軟底 / accent 文字 |
| danger | 錯誤、危險、強制 | danger 軟底 / danger 文字 |

規範：12px 圓角膠囊、letter-spacing 0.12em、大寫英文與中文皆可。

## 5. PhaseRail 階段

| 狀態 | 視覺 |
|---|---|
| past | 灰階 + 刪除線（半透明） |
| current | primary 高亮 + 1.5s 呼吸動畫（reduced-motion 時停用） |
| upcoming | 半透明 + 灰底 |

規範：
- 階段標籤中英對照顯示於下緣（sublabel 小字）。
- 切換階段使用 240ms standard easing。

## 6. 提示框（`.toast` 系列）

| 變體 | 顏色 |
|---|---|
| success | success 邊框 / success 文字 |
| error | danger 邊框 / danger 文字 |
| warning | accent 邊框 / accent 文字 |
| info | primary 邊框 / primary 文字 |

規範：
- 顯示在底部置中，自動 2.5s 後隱藏（用戶可手動關閉）。
- 堆疊上限 3 個；超出時淘汰最舊。
- 多個同時顯示時，垂直間距 12px。

## 7. Dock（行動 / 平板用）

| 狀態 | 視覺 |
|---|---|
| collapsed | 底部圓角矩形，只顯示圖示 |
| expanded | 抽屜式抽上，背景毛玻璃 backdrop-filter blur(12px) |

## 8. 錯誤橫幅

| 等級 | 顏色 | 行為 |
|---|---|---|
| warning | accent 邊、左 4px 條 | 自動隱藏或用戶關閉 |
| error | danger 邊、左 4px 條 | 不自動隱藏，需用戶關閉或重試 |

## 9. Loading

| 類型 | 觸發時機 | 視覺 |
|---|---|---|
| skeleton | 初次載入大區塊（>200ms） | 灰色漸層掃光，1.4s 循環 |
| spinner | 動作處理中（>400ms） | 18px primary 旋轉 |
| progress | 已知時長的卡牌匯入 / 編譯 | 底部進度條 + 百分比 |

規範：
- 短於 200ms 的延遲不顯示任何 loading。
- `prefers-reduced-motion: reduce` 時 skeleton 與 spinner 改為純色塊。

## 10. 觸控與鍵盤

- 所有可互動元素必須可在鍵盤聚焦。
- 主要按鈕 44×44px 觸控目標。
- 支援 `Escape` 關閉最上層浮動元素（modal / popover / toast）。
- `Tab` 順序與視覺順序一致；`Shift+Tab` 反向。
- focus-visible 顯示 2px primary outline + 4px 偏移。

## 11. reduced-motion 處理

由 `src/styles/tokens.css` 的 media query 自動把所有 duration token 設為 0，CSS 中的動畫不需逐條覆寫。
