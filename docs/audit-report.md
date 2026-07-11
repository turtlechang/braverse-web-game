# 專案審查報告（Phase 0 Audit Report）

> **2026-07-12 現況補充（以 `main@ee6b7ef` 為準）**：R3 AI Refresh replay 缺口已解決；現行基線為 96 個測試檔、可重現測試 1,526 項；主 bundle 731.12 KiB raw / 152.39 KiB gzip；AI 瀏覽器 20/20 (`stuck=0`)、線上 modal 2/2均通過。本段為當前審查的權威證據，下方歷史結果僅保留作為時點快照。

- 審查日期：2026-07-12
- 審查範圍：整個 repo（main 分支，commit `ee6b7ef`）
- 審查方式：目錄盤點、package.json scripts 檢查、文件比對、lint / test / build 實測
- 審查性質：本報告對照「總體開發計畫」的 Phase 0–8 要求，盤點實際完成度與缺口。**本專案實際進度已遠超 Phase 0**，因此本報告同時是「差距分析」。

---

## 1. 總體結論

| 面向 | 狀態 | 摘要 |
|---|---|---|
| 規則引擎 | ✅ 成熟 | `src/game/` 純函式引擎，typed GameCommand 指令層 + commandLog + replay，96 個測試檔、1526 項測試（目前基線非永久門檻） |
| 卡牌資料庫 | ⚠️ 部分 | 官方 JSON 匯入、schema、validate:cards、validate:candidate 已接入 CI，仍需持續擴充 effectId/新卡牌覆蓋與 PUBLIC_MODE 決策 |
| 牌組編輯器 | ✅ 完成 | 60 張 / 同卡 4 張 / ≥1 餅乾 / FLIP ≤16 驗證、匯入匯出、localStorage 版本化保存 |
| AI 對戰 | ✅ 完成 | Lv.1（隨機）/ Lv.2（啟發式）/ Lv.3（評估式）/ Lv.4（兩層前瞻）皆已實作，附訓練文件與勝率門檻測試 |
| UI / UX | ✅ 持續迭代 | 滿版桌墊 HUD、扇形手牌、統一效果 modal、動畫；PR #20/#21 剛完成 EffectPanel 改版 |
| 線上對戰 | ✅ MVP | `server/`（ws + rooms）、`src/net/onlineProtocol.ts`、遮罩狀態、OnlineBattleView 已進 main |
| 部署 / CI | ✅ 完成 | GitHub Actions CI（test/lint/build）已建；Vercel + Render Production 已部署並通過雙視窗公網對局驗收；`vercel.json` SPA rewrite 已存在 |
| IP / 授權 | ✅ 已解決（保留風險） | README 與主選單 footer 已有非官方粉絲研究聲明；LICENSE 已存在；保留官方素材熱連結風險與未實作 PUBLIC_MODE |
| 維護文件 | ⚠️ 需持續維護 | AGENTS.md + docs/ 30+ 份文件 + 專案 Skills 完整；CHANGELOG.md、docs/release-process.md、docs/card-update-process.md 已建立，需持續維護 |

## 2. 專案結構

```
├─ src/
│  ├─ game/          # 純函式規則引擎（約 90 檔，含測試）：actions、battle、effects/、ai/、
│  │                 # commands（8 決策 + 24 玩家動作指令）、replay、player-view、masked-state、
│  │                 # legal-actions、custom-deck、victory、refresh、pending
│  ├─ cards/         # 官方卡牌 JSON → GameCard 轉接層（adapter / effect-adapter / text-parser）
│  ├─ components/    # UI：MainMenu、battle/（含 OnlineBattleView）、cards、effects、modals、panels、layout
│  ├─ hooks/         # useMatchController / usePendingEffect / useAiTurn / useOnlineMatch 等 12+ hooks
│  ├─ net/           # onlineProtocol.ts（線上對戰協定）
│  └─ App.tsx        # 573 行協調層（PR #16 已從 1554 行拆分）
├─ server/src/       # WebSocket 對戰伺服器（index / rooms / connection，含測試）
├─ data/
│  ├─ cards/         # 官方卡牌 JSON（BS1、BS2、五色起始牌組）
│  └─ schemas/       # official-card-import.schema.json（匯入格式 schema）
├─ scripts/          # 卡牌匯入、Playwright 瀏覽器驗證、opencode-go 派工
├─ docs/             # 規則、卡牌效果、AI 等級、20 份 BS2 對局訓練紀錄等
├─ .github/workflows/ # ci.yml（test/lint/build）、ai-browser-validation.yml（手動 Playwright）
└─ AGENTS.md         # 代理工作硬規範（已瘦身，細節在 .agents/skills/）
```

## 3. 工具鏈與 scripts 現況

| 主計畫要求 | 現況 |
|---|---|
| `npm run lint` | ✅ eslint 10（flat config） |
| `npm run typecheck` | ✅ 2026-07-10 補齊：`tsc -b && server:typecheck`（app + server） |
| `npm run test` | ✅ vitest，1526 項通過（96 檔，見 §5） |
| `npm run build` | ✅ tsc -b + vite build |
| `npm run validate:cards` | ✅ 2026-07-10 補齊：`scripts/validate-cards.ts`，已接入 CI |
| `vercel.json` | ✅ 2026-07-10 補齊：SPA rewrite（assets 除外） |
| CI | ✅ PR + main push 觸發 test/lint/build；另有手動 Playwright workflow |
| Vercel | ✅ 已部署 Production（VITE_WS_URL=wss://braverse-web-game.onrender.com），正式網域可正常載入對局；Render 為 ws server 宿主 |

## 4. 主計畫 Phase 對照

| Phase | 主計畫目標 | 實際狀態 |
|---|---|---|
| 0 盤點 | 8 份文件 | 本輪補齊（先前缺 7 份，AGENTS.md 已存在） |
| 1 規則引擎 | Validator / Effect Resolver / Battle Log / Replay | ✅ 完成（PR #11）。UI 與 AI 均經 command 出口；AI Refresh 亦已攜帶 shuffle seed，R3 replay 缺口解除 |
| 2 卡牌資料庫 | schema + validate + import | ⚠️ 管線已完成（import/schema/validate:cards/validate:candidate 已接入 CI），仍需持續擴充 effectId/新卡牌覆蓋與 PUBLIC_MODE 決策 |
| 3 牌組編輯器 | 搜尋/篩選/驗證/匯入匯出 | ✅ 完成（PR #11 等），含版本化儲存與遷移 |
| 4 AI 對戰 | Lv.1–5 | ✅ Lv.1–4 實作完成（commit `076e7a5`）；Lv.5 為設計文件（docs/ai-levels.md） |
| 5 UI/UX 重製 | 對標文件 + mockup | ⚠️ 實際 UI 已多輪重製（滿版桌墊、扇形手牌、統一 modal）；缺對標分析與 wireframe 文件（實作已超前文件） |
| 6 線上對戰 | 房間 + 同步 | ✅ MVP 已進 main（ws server、房間、遮罩狀態、OnlineBattleView）；雙視窗完整對局驗收已於 2026-07-11 完成 |
| 7 部署/CI | vercel.json + workflows | ✅ Vercel Production 部署完成（Git Integration），Render 作為 ws server 宿主已部署並通過雙視窗驗收；Render Free 冷啟動風險見 known-risks R6 |
| 8 維護流程 | CHANGELOG + 流程文件 | ⚠️ CHANGELOG.md、docs/release-process.md、docs/card-update-process.md 已建立，需持續維護 |

## 5. 驗證結果（2026-07-11 實測）

- `npm run lint`：✅ 通過
- `npm test`：✅ 96 個測試檔、1526 項測試全數通過（非永久門檻）
- `npm run build`：✅ `tsc -b` + `vite build` 成功
- ⚠️ build 警告：主 bundle 806.97 kB（gzip 167.23 kB），仍有 >500 kB 建議值警告；未來可考慮 dynamic import 分割（牌組編輯器、線上對戰模組是天然切點），非急迫。
- 附註：CI（GitHub Actions）於 main 分支同樣執行以上三項。

## 6. 缺口清單（依風險排序）

1. **IP 聲明缺失（高）**：README、網站 footer 皆無「非官方粉絲研究」聲明；已部署 Vercel 則為公開網站。→ ✅ 已解決（2026-07-10）：README 與主選單 footer 皆已加聲明。
2. **官方素材公開部署（高）**：卡圖熱連結 `cookierunbraverse.com`、卡背/能量圖示在 `public/`。→ 已決策（2026-07-10）：維持熱連結、不做 PUBLIC_MODE，收到異議再處理。詳見 [ip-and-asset-policy.md](ip-and-asset-policy.md)。
3. **無 `validate:cards`（中）**：→ ✅ 已解決（2026-07-10）：`npm run validate:cards` + CI；首跑即發現 BS2-061@1 缺 level 資料缺陷並修復。
4. **部分 AI 路徑仍手動補記 commandLog（中）**：玩家 UI 與 `usePendingEffect` 已走指令層，補位排程也在 command 出口統一處理；但部分 AI battle／turn handler 仍直呼規則函式後補記 log，全面 replay 仍需逐步 command 化。
5. **Vercel 與 ws server 架構分裂（中）**：Vercel 只能承載前端。→ 已於 2026-07-11 部署 Render 免費層並完成雙視窗公網驗收。Render Free 冷啟動見 known-risks R6。
6. **維護流程持續維護（低）**：CHANGELOG.md、release-process、card-update-process 已建立，需持續維護。
7. **無 LICENSE（低）**：→ ✅ 已解決（2026-07-10）：MIT + Devsisters 素材除外條款。

## 7. 建議下一輪（不在本輪執行）

1. 網站 footer 加非官方聲明（小 UI 變更）。
2. `scripts/validate-cards.ts` + `npm run validate:cards` + 接入 CI。
3. `vercel.json`（SPA rewrite）✅ 已完成（2026-07-11 於 Production 網域驗證載入與對局功能）。
4. 線上對戰雙視窗完整對局驗收 ✅ 已完成（2026-07-11 以 Render + Vercel 完成公網對局驗證）。
