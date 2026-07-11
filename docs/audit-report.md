# 專案審查報告（V1 Current Audit）

> 最後更新：2026-07-12。本文件只保留可由目前程式碼、測試、部署紀錄與文件證明的現況；歷史實作細節見 [CHANGELOG.md](../CHANGELOG.md)。測試數與 bundle 為目前基線，不是永久寫死門檻。

- 審查範圍：目前 `main` 與本輪工作區
- 審查方式：目錄與資料流盤點、文件交叉比對、lint／typecheck／test／build／bundle 實測、Playwright 真實瀏覽器驗證
- 目前基線：97 個測試檔、1545 項 vitest 測試；主 bundle 731.11 KiB raw／152.38 KiB gzip
- 瀏覽器基線：AI 20/20（`stuck=0`）、牌組編輯器 2/2、線上 modal 2/2、好友房雙瀏覽器核心流程與伺服器無法連線負向路徑通過

---

## 1. V1 完成度總覽

| 面向 | 狀態 | 權威證據 |
|---|---|---|
| 規則引擎 | ✅ 核心完成 | `src/game/` 純函式規則、typed `GameCommand`、commandLog、replay；多段效果含 8 類中途決策阻擋與看牌決策恢復回歸 |
| 卡牌資料管線 | ✅ V1 完成／持續擴充 | 官方 JSON 匯入、schema、`validate:cards`、候選隔離／驗證／promote、runtime registry gate 均已接入 CI |
| 牌組編輯器 | ✅ 完成 | 搜尋／篩選、60 張／同卡 4 張／至少 1 餅乾／FLIP ≤16、匯入匯出、版本化 localStorage；瀏覽器匯入與 RWD smoke |
| AI 對戰 | ✅ V1 完成 | Lv.1–4、PlayerView 資訊邊界、固定種子回歸、5×5 矩陣與 20 場瀏覽器 smoke；Lv.5 為觀察後增強，不阻擋 V1 |
| UI／UX | ✅ V1 基礎完成／需真人打磨 | 原創深藍電競科幻介面、滿版桌墊、扇形手牌、統一效果 modal、RWD、六份 wireframe；市場級體感仍需真人試玩回報 |
| 好友房對戰 | 🟡 MVP 可用／兩項 P1 待收尾 | 權威 WebSocket server、房間碼、遮罩狀態、正式戰場與用戶端連線生命週期已完成；伺服器入站 envelope 驗證與戰場指令拒絕提示待補 |
| 部署／CI | ✅ 基礎設施完成／待本輪外部健康確認 | Vercel Production + Render WebSocket；PR/main CI 與 main push Playwright workflow；bundle budget gate |
| 維護／迭代 | ✅ 流程完成 | CHANGELOG、release、card-update、regression、manual-playtest、Loop Engineering、子代理停滯交接文件 |
| IP／授權 | ⚠️ 已決策接受風險 | MIT + 官方素材除外條款、非官方聲明；維持官方卡圖熱連結，不做 PUBLIC_MODE，收到異議再處理 |

## 2. 架構證據

```text
src/game/          純函式規則、AI、GameCommand、replay、牌組與遮罩狀態
src/cards/         官方資料格式、文字解析與 GameCard 轉接
src/components/    主選單、戰場、牌組編輯器、效果與線上對戰 UI
src/hooks/         本地／AI／線上控制器與 pending effect 協調
src/net/           好友房前後端訊息協定
server/src/        WebSocket 房間、連線、權威指令執行與視角遮罩
scripts/           卡牌管線、bundle gate、五套 Playwright 驗證
data/              正式卡池、候選隔離區與 schema
docs/              規則、架構、UI 參考、發布／更新／回歸／試玩流程
```

不可破壞的邊界：

- 規則與合法性集中在 `src/game/`，React 不另寫權威規則。
- UI、AI 與 server 共用 `applyGameCommand`；重播依 command payload 還原。
- 線上 server 驗證 socket 身分並只送出對應玩家的遮罩狀態。
- 新卡先進 `data/candidates/`，驗證失敗不得覆蓋正式卡池。

## 3. 驗證矩陣

| 驗證 | 現況 |
|---|---|
| `npm test` | ✅ 97 檔／1545 項 |
| `npm run lint` | ✅ |
| `npm run typecheck` | ✅ app + server |
| `npm run build` | ✅；仍有 Vite >500 kB 提示，但通過專案 budget |
| `npm run check:bundle` | ✅ 731.11 KiB raw／152.38 KiB gzip（budget 850／180 KiB） |
| `npm run test:ai:browser` | ✅ 20/20，`stuck=0` |
| `npm run test:deck:browser` | ✅ 錯誤 JSON、合法匯入／儲存、1366×768／280×720 |
| `npm run test:online:browser` | ✅ 線上 modal 桌機／窄版 RWD |
| `npm run test:online:match:browser` | ✅ 兩個隔離瀏覽器完成建房／加入／開局／階段同步／對手離線，另關閉 server 驗證連線失敗提示與安全返回 |

## 4. 原計畫 Phase 對照

| Phase | 目標 | 現況 |
|---|---|---|
| 0 盤點 | 架構、產品、風險、測試與部署文件 | ✅ 完成；本報告已移除過期快照 |
| 1 規則引擎 | Validator／Effect Resolver／Battle Log／Replay | ✅ V1 完成；仍依官方新版規則持續覆核 |
| 2 卡牌資料庫 | schema／validate／import／候選 promotion | ✅ V1 完成；新卡依流程持續新增 |
| 3 牌組編輯器 | 搜尋／篩選／驗證／匯入匯出 | ✅ 完成且有瀏覽器 smoke |
| 4 AI 對戰 | Lv.1–4 核心、Lv.5 觀察後投入 | ✅ V1 完成；Lv.5 延後至真人試玩後決策 |
| 5 UI／UX | 原創方向、對標、wireframe、RWD | ✅ V1 基礎完成；需持續依真人體感迭代 |
| 6 好友房 | 房間、同步、遮罩、斷線提示 | 🟡 MVP 可用；自動化尚未打到勝負，另有伺服器 envelope 與指令拒絕提示兩項 P1 收尾 |
| 7 部署／CI | Vercel + Render + 自動 gate | ✅ 完成 |
| 8 維護 | 發布、卡牌更新、回歸、Loop Engineering | ✅ 文件與工具完成，進入持續執行階段 |

## 5. 尚未完成的證據與下一步

### V1 退出前仍需

1. **好友房 P1 收尾**：為伺服器端 ClientMessage 加入執行期 envelope 驗證，並讓對戰中的 `command-rejected` 對玩家可見。
2. **真人試玩回報**：使用 [manual-playtest-checklist.md](manual-playtest-checklist.md) 完成至少 1–2 場，記錄規則疑點、AI 體感、牌組編輯器操作阻力與 UI 可讀性。這是目前唯一無法由自動測試取代的產品證據。
3. **稽核生產自動流程**：main push 後確認 GitHub Actions、Vercel Production 與 Render 實際健康；本機綠燈不能代替外部狀態。

### 已知但接受的 V1 風險

- Render Free 休眠與冷啟動；V1 不承諾斷線重連與逾時判負。
- 官方卡圖熱連結與資料來源結構可能改版失效。
- 官方效果文字轉換包含集中記錄的專案裁定，取得新版規則後需覆核。
- 好友房瀏覽器自動化目前驗證到主要階段與斷線，尚未自動打完整場至勝負；既有人工公網對局與 server／規則整合測試共同降低風險。

### V1 後增強，不作為目前退出條件

- AI Lv.5 牌組理解與策略傾向。
- 拖移卡牌輸入層。
- 進一步拆分主 bundle、卡圖快取與更完整的斷線重連。
- 帳號、排名、配對、金流與賽事系統。

## 6. 結論

Braverse 已具備「可測試、可部署、可更新卡牌、可單機練牌、可與好友連線」的 V1 技術骨架。目標尚不能標記完成，原因是好友房仍有兩項 P1 收尾，且仍需真人試玩證據與本輪 main push 後的外部 CI／Production 健康確認。完成後才適合進行 V1 退出稽核。
