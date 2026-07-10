# 專案審查報告（Phase 0 Audit Report）

- 審查日期：2026-07-10
- 審查範圍：整個 repo（main 分支，commit `897d393`）
- 審查方式：目錄盤點、package.json scripts 檢查、文件比對、lint / test / build 實測
- 審查性質：本報告對照「總體開發計畫」的 Phase 0–8 要求，盤點實際完成度與缺口。**本專案實際進度已遠超 Phase 0**，因此本報告同時是「差距分析」。

---

## 1. 總體結論

| 面向 | 狀態 | 摘要 |
|---|---|---|
| 規則引擎 | ✅ 成熟 | `src/game/` 純函式引擎，typed GameCommand 指令層 + commandLog + replay，1467 項單元測試（90 檔，目前基線非永久門檻） |
| 卡牌資料庫 | ⚠️ 部分 | 官方 JSON 匯入管線完整（BS1/BS2 + 五色起始），但缺 `validate:cards` script 與自有 card schema |
| 牌組編輯器 | ✅ 完成 | 60 張 / 同卡 4 張 / ≥1 餅乾 / FLIP ≤16 驗證、匯入匯出、localStorage 版本化保存 |
| AI 對戰 | ✅ 完成 | Lv.1（隨機）/ Lv.2（啟發式）/ Lv.3（評估式）/ Lv.4（兩層前瞻）皆已實作，附訓練文件與勝率門檻測試 |
| UI / UX | ✅ 持續迭代 | 滿版桌墊 HUD、扇形手牌、統一效果 modal、動畫；PR #20/#21 剛完成 EffectPanel 改版 |
| 線上對戰 | ✅ MVP | `server/`（ws + rooms）、`src/net/onlineProtocol.ts`、遮罩狀態、OnlineBattleView 已進 main |
| 部署 / CI | ⚠️ 部分 | GitHub Actions CI（test/lint/build）已建；Vercel Dashboard 已匯入；缺 `vercel.json` SPA rewrite |
| IP / 授權 | ❌ 缺口 | README 與網站皆**無**非官方聲明；卡圖熱連結官方網站；無 LICENSE、無 PUBLIC_MODE |
| 維護文件 | ⚠️ 部分 | AGENTS.md + docs/ 30+ 份文件 + 專案 Skills 完整；但缺 CHANGELOG.md（更新日誌寫在 README）與正式 release/card-update 流程文件 |

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
| `npm run test` | ✅ vitest，1467 項通過（90 檔，見 §5） |
| `npm run build` | ✅ tsc -b + vite build |
| `npm run validate:cards` | ✅ 2026-07-10 補齊：`scripts/validate-cards.ts`，已接入 CI |
| `vercel.json` | ✅ 2026-07-10 補齊：SPA rewrite（assets 除外） |
| CI | ✅ PR + main push 觸發 test/lint/build；另有手動 Playwright workflow |
| Vercel | ⚠️ README 記載 Dashboard 已匯入（Vite preset、Node 22）；待 PR preview 實測記錄 |

## 4. 主計畫 Phase 對照

| Phase | 主計畫目標 | 實際狀態 |
|---|---|---|
| 0 盤點 | 8 份文件 | 本輪補齊（先前缺 7 份，AGENTS.md 已存在） |
| 1 規則引擎 | Validator / Effect Resolver / Battle Log / Replay | ✅ 完成（PR #11）。殘項：UI 攻擊宣告與多段效果精靈仍直呼規則函式，僅補記 commandLog（見 known-risks R3） |
| 2 卡牌資料庫 | schema + validate + import | ⚠️ import 完整、匯入 schema 有；缺 validate:cards、effectId 對應檢查 script、PUBLIC_MODE |
| 3 牌組編輯器 | 搜尋/篩選/驗證/匯入匯出 | ✅ 完成（PR #11 等），含版本化儲存與遷移 |
| 4 AI 對戰 | Lv.1–5 | ✅ Lv.1–4 實作完成（commit `076e7a5`）；Lv.5 為設計文件（docs/ai-levels.md） |
| 5 UI/UX 重製 | 對標文件 + mockup | ⚠️ 實際 UI 已多輪重製（滿版桌墊、扇形手牌、統一 modal）；缺對標分析與 wireframe 文件（實作已超前文件） |
| 6 線上對戰 | 房間 + 同步 | ✅ MVP 已進 main（ws server、房間、遮罩狀態、OnlineBattleView）；待雙視窗完整對局驗收紀錄 |
| 7 部署/CI | vercel.json + workflows | ⚠️ CI 完成；Vercel 靠 Git Integration；缺 vercel.json 與 preview 驗收紀錄；**注意：Vercel 無法承載 ws server**（見 known-risks R6） |
| 8 維護流程 | CHANGELOG + 流程文件 | ⚠️ 更新日誌在 README 表格；有 card-review-checklist 與專案 Skills；缺獨立 CHANGELOG.md、release-process、card-update-process |

## 5. 驗證結果（2026-07-10 實測）

- `npm run lint`：✅ 通過
- `npm test`：✅ 目前基線 90 個測試檔、1467 項測試全數通過（非永久門檻）
- `npm run build`：✅ `tsc -b` + `vite build` 成功
- ⚠️ build 警告：主 bundle 847 kB（gzip 176 kB）超過 500 kB 建議值；未來可考慮 dynamic import 分割（牌組編輯器、線上對戰模組是天然切點），非急迫。
- 附註：CI（GitHub Actions）於 main 分支同樣執行以上三項。

## 6. 缺口清單（依風險排序）

1. **IP 聲明缺失（高）**：README、網站 footer 皆無「非官方粉絲研究」聲明；已部署 Vercel 則為公開網站。→ ✅ 已解決（2026-07-10）：README 與主選單 footer 皆已加聲明。
2. **官方素材公開部署（高）**：卡圖熱連結 `cookierunbraverse.com`、卡背/能量圖示在 `public/`。→ 已決策（2026-07-10）：維持熱連結、不做 PUBLIC_MODE，收到異議再處理。詳見 [ip-and-asset-policy.md](ip-and-asset-policy.md)。
3. **無 `validate:cards`（中）**：→ ✅ 已解決（2026-07-10）：`npm run validate:cards` + CI；首跑即發現 BS2-061@1 缺 level 資料缺陷並修復。
4. **UI 未全面走指令層（中）**：攻擊宣告與多段效果流程直呼規則函式、補記 log，replay 完整性依賴補記正確。
5. **Vercel 與 ws server 架構分裂（中）**：Vercel 只能承載前端。→ 已決策（2026-07-10）：採 Render 免費層，評估見 [online-server-hosting.md](online-server-hosting.md)；部署執行待辦。
6. **缺獨立 CHANGELOG 與 release 流程（低）**：README 更新日誌表格已運作，但不利對外版本化。
7. **無 LICENSE（低）**：→ ✅ 已解決（2026-07-10）：MIT + Devsisters 素材除外條款。

## 7. 建議下一輪（不在本輪執行）

1. 網站 footer 加非官方聲明（小 UI 變更）。
2. `scripts/validate-cards.ts` + `npm run validate:cards` + 接入 CI。
3. `vercel.json`（SPA rewrite）+ 用一支 PR 驗證 preview URL。
4. 線上對戰雙視窗完整對局驗收，並記錄伺服器部署方案決策。
