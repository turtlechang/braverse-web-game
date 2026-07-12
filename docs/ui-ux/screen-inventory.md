# U0 畫面盤點（Screen Inventory）

> 建立日期：2026-07-12
> 基準 HEAD：`3d5d514`
> 截圖裝置：Playwright Chromium, Asia/Taipei, locale zh-Hant-TW, reduced motion
>
> 本文件記錄六個正式畫面狀態的入口、前置資料、選擇器、互動、狀態與可及性。

---

## 截圖規格

| 參數 | 值 |
|---|---|
| Viewport | 1366×768、1920×1080、1180×820 |
| 瀏覽器 | Playwright Chromium（本機安裝） |
| 時區 | Asia/Taipei |
| Locale | zh-Hant-TW |
| Reduced motion | `prefers-reduced-motion: reduce` |
| 測試資料 | 固定合法 60 張牌組，固定亂數種子 |
| 截圖格式 | PNG（無失真） |

---

## 畫面 1：主選單（Main Menu）— `ready`

### 入口

- 啟動應用程式後的第一個畫面。
- URL：`/`（無 query string）

### 前置資料

- LocalStorage 存在至少一副合法已儲存牌組（自訂或官方 Starter Deck）。
- 狀態：具備合法已儲存牌組的 `ready`。

### 預期選擇器

- `[data-testid="main-menu"]` 或 `.menu-screen`
- 快速開始按鈕區域
- 牌組編輯器入口
- 線上對戰入口
- 設定／離開按鈕
- Footer 非官方聲明文字

### 可用互動

- 點擊「快速開始」— 選擇牌組與對戰設定
- 點擊「牌組編輯器」— 開啟 DeckEditorModal
- 點擊「線上對戰」— 開啟 OnlineMatchPanel
- 鍵盤 Tab 導覽所有按鈕

### 空狀態

- 無自訂牌組時：顯示「建立第一副牌組」為主 CTA，對戰入口 disabled（此為已解決的 P0 項目）
- 有自訂牌組時：對戰入口為主 CTA

### 載入狀態

- 初次載入時顯示應用程式初始化進度（牌組載入、卡池初始化）

### 錯誤狀態

- LocalStorage 讀取失敗時顯示錯誤提示並提供「重試」按鈕
- 卡池初始化失敗時顯示錯誤訊息

### 鍵盤與 Modal 可及性

- 主選單不含 modal，所有互動元素可直接 Tab 導覽
- 部分按鈕缺少 `aria-label`（如線上對戰按鈕）

### 本機／線上差異

- 本機：所有功能可用
- 線上：需透過主選單的線上對戰入口進入房間

---

## 畫面 2：牌組編輯器（Deck Editor）— `loaded`

### 入口

- 從主選單點擊「牌組編輯器」按鈕。
- 開啟為全螢幕 modal。

### 前置資料

- 卡池資料完整載入（`generate:card-pool` 產生的 runtime registry）。
- 牌組資料載入完成（編輯既有牌組或建立新牌組）。

### 預期選擇器

- `.deck-editor-modal` 或 `[data-testid="deck-editor"]`
- 左側卡池網格（CardPool grid）
- 右側牌組摘要（deck summary、卡片數量、顏色分佈）
- 搜尋／過濾輸入欄
- 儲存／匯出／匯入按鈕

### 可用互動

- 點擊卡池卡片加入牌組（上限 4 張）
- 點擊已加入卡片移除
- 輸入搜尋文字過濾卡池
- 依顏色、類型篩選
- 匯入／匯出牌組 JSON
- 儲存牌組
- 點擊資訊按鈕查看卡片詳情

### 空狀態

- 新牌組（無卡片）：右側顯示「牌組為空」提示
- 卡池載入失敗：顯示錯誤訊息

### 載入狀態

- 卡池資料載入中顯示 loading spinner

### 錯誤狀態

- 牌組合規性驗證失敗（非 60 張、餅乾不足、FLIP 超過 16 張等）：顯示具體錯誤訊息
- LocalStorage 儲存失敗：顯示錯誤提示

### 鍵盤與 Modal 可及性

- Modal 缺少完整 `aria-label` 與 `role="dialog"`
- 卡片列表可 Tab 導覽
- 關閉按鈕（X）可用 Enter/Escape 操作

### 本機／線上差異

- 僅本機可用（線上對戰的牌組選擇使用已儲存牌組）

---

## 畫面 3：戰場（Battlefield）— 主要階段可操作

### 入口

- 從測試設定 modal 點擊「開始對戰」。
- 使用合法 60 張牌組走正式開局流程（`createGame` → 起始餅乾 → 起手重抽 → 開局抽牌）。

### 前置資料

- 合法 GameState（兩方玩家的牌組、手牌、起始餅乾設定完成）。
- 非 demo／`test-state` 狀態。
- 第一個可操作主要階段（AI 回合已完成、控制權在玩家手上）。

### 預期選擇器

- `.battlefield` 或主要 wrapper
- `.phase-rail`（PhaseRail 左側欄）
- `.battle-row` 上／下（對手／我方場地）
- `.hand-area`（扇形手牌）
- `.support-area`（支援區）
- `.break-area`（休息區與 Level Sum）
- `.deck-area`（牌庫區與剩餘張數）
- `.trash-area`（棄牌區）
- `.battle-hud`（戰鬥 HUD 數值疊層）

### 可用互動

- 點擊我方餅乾選擇攻擊目標或發動技能
- 點擊手牌卡牌登場餅乾／放置支援／使用道具／放置場景
- 點擊 PhaseRail 推進階段
- 點擊支援卡選擇能量支付
- 點擊對手餅乾查看公開資訊
- Hover 卡牌查看放大預覽（部分實作）
- 開啟對戰紀錄側欄
- 暫停／複製問題包

### 空狀態

- 戰鬥區空：顯示補位提示（pending replacement）
- 手牌空：不顯示手牌區域或顯示空手牌圖示
- 支援區空：不顯示支援區或顯示空狀態

### 載入狀態

- 開局設置 modal 顯示起始餅乾選擇
- AI 思考中顯示「AI 思考中」指示器

### 錯誤狀態

- 非法操作（如攻擊已在 Rest 狀態的餅乾）：顯示錯誤提示
- 能量不足：支付面板標記可用／不可用資源

### 鍵盤與 Modal 可及性

- PhaseRail 階段按鈕可 Tab 導覽
- 餅乾卡與手牌可聚焦
- Modal（攻擊確認、效果選取、付款等）缺少完整 `aria-label`

### 本機／線上差異

- 本機：對手由 AI 控制，無網路延遲
- 線上：對手為遠端玩家，有網路延遲；斷線時結束對局

---

## 畫面 4：測試設定（Test Setup Modal）— `empty`

### 入口

- 從主選單點擊「快速開始」或設定按鈕。
- 開啟為置中 modal。

### 前置資料

- Modal 初始 `empty` 狀態（尚未選擇牌組）。
- 無已儲存牌組時，下拉選單顯示可用的官方 Starter Deck 與 AI 預設牌組。

### 預期選擇器

- `[data-testid="test-setup-modal"]` 或 `.test-scenario-modal`
- 玩家 1 欄位（牌組選擇、名稱、AI 類型）
- 玩家 2 欄位（牌組選擇、名稱、AI 類型）
- 「開始對戰」按鈕

### 可用互動

- 在下拉選單選擇雙方牌組
- 輸入玩家名稱
- 選擇 AI 等級（Lv.1–4）
- 點擊「開始對戰」開始對局

### 空狀態

- Modal 初始顯示：雙方牌組未選擇，名稱預設值，AI 類型預設
- 無已儲存自訂牌組：下拉僅顯示官方牌組選項

### 載入狀態

- 無（modal 內容為同步渲染）

### 錯誤狀態

- 無（選擇操作即時驗證；牌組選項為硬編碼或已儲存）

### 鍵盤與 Modal 可及性

- Modal 缺少完整 `aria-label` 與 `role="dialog"`
- 下拉選單與輸入框可 Tab 導覽
- Escape 關閉 modal

### 本機／線上差異

- 僅本機可用（線上對戰使用獨立流程）

---

## 畫面 5：線上房間（Online Room）— `idle`

### 入口

- 從主選單點擊「線上對戰」按鈕。
- 開啟為置中 modal。

### 前置資料

- Modal 直接開啟的 `idle` 狀態。
- WebSocket 伺服器可連線（本機 `npm run server:start` 或 Render）。
- 已儲存至少一副合法牌組。

### 預期選擇器

- `.online-match-panel` 或 `[data-testid="online-match-panel"]`
- 「建立房間」按鈕
- 「輸入房號加入」輸入框與按鈕
- 牌組選擇下拉
- 關閉按鈕（X）

### 可用互動

- 點擊「建立房間」建立新房間並顯示房號
- 輸入房號後點擊「加入」
- 選擇要使用的牌組
- 在等待對手加入時取消房間
- 關閉 modal

### 空狀態

- `idle`：顯示建立／加入兩個動作入口
- 無已儲存牌組：牌組選擇下拉為空或顯示提示

### 載入狀態

- 連線中：顯示「連線中…」提示
- 建立房間中：顯示 loading spinner
- 等待對手加入：顯示等待畫面與房號

### 錯誤狀態

- 伺服器無法連線：顯示錯誤訊息與重試按鈕
- 房間不存在（房號錯誤）：顯示錯誤提示
- 連線中斷：顯示斷線畫面並結束對局
- 對手離線：顯示對手離線提示

### 鍵盤與 Modal 可及性

- 關閉按鈕已加大至 32×32px（已解決的 P0 項目）
- 建立／加入按鈕可 Tab 導覽
- 牌組選擇下拉可用鍵盤操作
- Modal 缺少完整 `aria-label`

### 本機／線上差異

- 本機：需要本機啟動 ws server
- 線上：需連接 Render 伺服器（Free tier 閒置休眠）

---

## 畫面 6：Mockup Gallery — INDEX 首頁

### 入口

- 從主選單點擊「Mockup Gallery」或直接導航至 mockup 頁面（如有路由）。

### 前置資料

- 所有 mockup 子頁面載入（如使用 lazy loading）。

### 預期選擇器

- `.mockup-gallery` 或 mockup 相關 wrapper
- INDEX 首頁（所有 mockup 總覽）

### 可用互動

- 瀏覽各個 mockup 頁面
- 切換不同 mockup（如 UI 元件展示、顏色樣本）

### 空狀態

- 無 mockup 內容：顯示空 gallery 或建置中提示

### 載入狀態

- Mockup 子頁面 lazy loading

### 錯誤狀態

- 模組載入失敗：顯示錯誤邊界（ErrorBoundary）

### 鍵盤與 Modal 可及性

- 依各 mockup 的具體元件結構而定
- Mockup Gallery 本身不含互動式對話框

### 本機／線上差異

- Mockup Gallery 僅在本機開發環境可用（`dist/assets/MockupGallery-RN506_2D.js` 已包含在建置產物中）

---

## 截圖檔案清單

截圖存放於 `test-results/ui-ux-u0/2026-07-12/<viewport>/<surface>--<state>.png`，該目錄維持 git ignored。

| # | Viewport | 畫面 | 狀態 | 預期檔案路徑 |
|---|---|---|---|---|
| 1 | 1366×768 | main-menu | ready | `test-results/ui-ux-u0/2026-07-12/1366x768/main-menu--ready.png` |
| 2 | 1366×768 | deck-editor | loaded | `test-results/ui-ux-u0/2026-07-12/1366x768/deck-editor--loaded.png` |
| 3 | 1366×768 | battlefield | main-phase | `test-results/ui-ux-u0/2026-07-12/1366x768/battlefield--main-phase.png` |
| 4 | 1366×768 | test-setup | empty | `test-results/ui-ux-u0/2026-07-12/1366x768/test-setup--empty.png` |
| 5 | 1366×768 | online-room | idle | `test-results/ui-ux-u0/2026-07-12/1366x768/online-room--idle.png` |
| 6 | 1366×768 | mockup-gallery | index | `test-results/ui-ux-u0/2026-07-12/1366x768/mockup-gallery--index.png` |
| 7 | 1920×1080 | main-menu | ready | `test-results/ui-ux-u0/2026-07-12/1920x1080/main-menu--ready.png` |
| 8 | 1920×1080 | deck-editor | loaded | `test-results/ui-ux-u0/2026-07-12/1920x1080/deck-editor--loaded.png` |
| 9 | 1920×1080 | battlefield | main-phase | `test-results/ui-ux-u0/2026-07-12/1920x1080/battlefield--main-phase.png` |
| 10 | 1920×1080 | test-setup | empty | `test-results/ui-ux-u0/2026-07-12/1920x1080/test-setup--empty.png` |
| 11 | 1920×1080 | online-room | idle | `test-results/ui-ux-u0/2026-07-12/1920x1080/online-room--idle.png` |
| 12 | 1920×1080 | mockup-gallery | index | `test-results/ui-ux-u0/2026-07-12/1920x1080/mockup-gallery--index.png` |
| 13 | 1180×820 | main-menu | ready | `test-results/ui-ux-u0/2026-07-12/1180x820/main-menu--ready.png` |
| 14 | 1180×820 | deck-editor | loaded | `test-results/ui-ux-u0/2026-07-12/1180x820/deck-editor--loaded.png` |
| 15 | 1180×820 | battlefield | main-phase | `test-results/ui-ux-u0/2026-07-12/1180x820/battlefield--main-phase.png` |
| 16 | 1180×820 | test-setup | empty | `test-results/ui-ux-u0/2026-07-12/1180x820/test-setup--empty.png` |
| 17 | 1180×820 | online-room | idle | `test-results/ui-ux-u0/2026-07-12/1180x820/online-room--idle.png` |
| 18 | 1180×820 | mockup-gallery | index | `test-results/ui-ux-u0/2026-07-12/1180x820/mockup-gallery--index.png` |
