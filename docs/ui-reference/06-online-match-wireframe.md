# Wireframe 06 — 線上對戰面板（Online Match Panel）

最後更新：2026-07-11。依原始碼結構整理（`src/components/battle/OnlineMatchPanel.tsx` + `GameModals.css` `.online-match-panel` 規則）；補齊 P0 樣式化後的版式，此前僅有純文字堆疊（見 `docs/ui-audit-2026-07-11.md` §5 已解決紀錄）。

## 版面（idle 狀態，剛開啟）

```
┌── 深色 backdrop（.modal-backdrop） ─────────────────────┐
│  ┌── .online-match-panel（role=dialog） ─────────────┐  │
│  │ 線上對戰                              [✕]（32×32） │  │
│  │ ──────────────────────────────────────────────── │  │
│  │ 狀態：閒置                                        │  │
│  │                                                    │  │
│  │ 選擇牌組  [下拉：我的自訂牌組清單▼]                  │  │
│  │ （牌組不合法時顯示紅色錯誤列）                        │  │
│  │                                                    │  │
│  │ [建立房間]（primary，未選合法牌組時 disabled）        │  │
│  │                                                    │  │
│  │ [輸入房號______] [加入房間]（未選牌組/未填房號 disabled）│  │
│  └────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────┘
```

## 狀態機（`online.status`）

| 狀態 | 畫面內容 |
|---|---|
| `idle` | 選牌組 + 建立房間 / 輸入房號加入，見上圖 |
| `connecting` | 純文字提示：「正在連線至伺服器…」（Render 免費層冷啟動時可能持續數十秒，見 known-risks R6） |
| `waiting-for-opponent` | 顯示房號（`<strong>` 強調）＋「請把房號分享給對手，等待對方加入…」 |
| `ended` | 顯示對局結束原因（`matchEndedReasonLabels` 對應文字，或預設「對局已結束。」） |
| `error` | 顯示 `online.errorMessage`（`.online-match-error`，role=alert）＋「返回」按鈕（呼叫 `handleClose`） |

進行中對局本身渲染於 `OnlineBattleView`（不在此 panel 內，panel 只負責建立/加入房間前的流程）。

## 規格

| 規則 | 內容 |
|---|---|
| Backdrop | 與 `DeckEditorModal`／`TestScenarioModal` 共用 `.modal-backdrop`，深色置中 |
| 關閉按鈕 | `.online-match-close`，32×32px（P0 修正前偏小、hover 區不足） |
| 內容捲動 | `.online-match-body` 內容過長時捲動，避免 modal 本身溢出視窗（P0 修正前無捲軸管理） |
| 錯誤顯示 | `role="alert"`；牌組不合法與連線錯誤共用 `.online-match-error` 樣式 |
| 互動狀態 | hover / focus-visible / active / disabled 皆有樣式（見 `OnlineMatchPanel.test.tsx` 15 項測試涵蓋 idle/waiting/error/close/dialog/label/connecting 路徑） |
| 載入 | 從 `MenuScreen.tsx` 以 `React.lazy` 載入，`Suspense` fallback 為共用 `ModalLoadingFallback`（深色 backdrop + 「載入畫面中…」） |

## 已解決（曾列於 ui-audit P0，現狀更新）

- ~~大廳列表與「建立房間」按鈕重疊~~：目前版式無大廳列表，改為單一「建立房間」／「輸入房號加入」兩個並列動作，不存在重疊。
- ~~房間列表未樣式化~~：不適用（已改版式，無房間列表 UI）。
- ~~關閉按鈕過小~~：已定為 32×32px。

## 尚未涵蓋（後續可能需要）

- 多房間瀏覽/大廳列表 UI（目前設計是「知道房號才能加入」，無公開房間列表）。
- 斷線重連提示的視覺規格（見 known-risks R7，功能範圍內已知限制）。
