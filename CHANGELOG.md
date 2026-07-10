# Changelog

本專案的重要變更記錄。格式參考 [Keep a Changelog](https://keepachangelog.com/zh-TW/1.1.0/)；由於尚未對外發版，目前以日期為單位記錄，未採語意化版號。歷史記錄自 README 遷移而來（2026-07-10）。

## [Unreleased]

- 🔧 P1 工程管線（PR #24，驗證中）：`npm run validate:cards`（卡池 311 種卡號全數可轉換檢查，接入 CI）、`npm run typecheck`、`vercel.json` SPA rewrite、server 支援 `PORT` 環境變數與線上對戰冷啟動提示；修復 BS2-061@1 異圖版缺 level 的匯入資料缺陷並在匯入腳本加異圖回填。
- 📚 P2 維護流程文件（本 PR）：CHANGELOG 自 README 抽離、release / card-update 流程、回歸與手動測試清單、loop-engineering 說明。
- 🛡️ 攻擊宣告阻擋加固：`assertNoBlockingDecision` 新增 `pendingOnPlay` 與 `pendingAbilityEffect` 檢查，既有待處理效果結算完成前禁止宣告攻擊；新增 `battle-blocking-decision.test.ts` 回歸測試。
- 🛡️ AI 攻擊宣告與 determinism 修正：各級 AI 攻擊統一以 `declare-attack` 記入 commandLog 保留陷阱/FLIP 回應窗口；`commandLog` 長度不再影響 Lv.1 隨機決策；新增 `ai-attack-declaration.test.ts`（309 行），測試基線升至 91 檔／1469 項。

## 2026-07-10

- 📋 Phase 0 文件與 IP 補強（PR #23）— 新增 audit-report、architecture、product-vision、roadmap、known-risks、ip-and-asset-policy、test-plan、online-server-hosting 文件；README 與主選單 footer 加非官方粉絲研究聲明；新增 MIT + Devsisters 素材除外條款的 LICENSE。

## 2026-07-09

- 🎨 EffectPanel 與陷阱/攻擊提示框改版（PR #20、#21）— dock、雙欄版面、多步驟流程；提示框加寬、背景加深。

## 2026-07-08

- 🐛 陷阱 support-to-hand/hand-to-support 修正 — 修復 Bean 牌組陷阱卡造成卡住的 bug；AI 改進支援放置能量稀缺優先、攻擊選擇一擊擊殺優先；新增 6 組 BS2 對局分析文件。
- 🔧 BS1-006 修正 — after-damage 觸發改為僅限戰鬥傷害，效果傷害不再觸發。
- 🔧 BS1-037 修正 — 移除 sourceAsEnergy 費用減少、目標改選 HP 最多、新增 hand-to-support 效果型別與執行。

## 2026-07-07

- 🃏 AI 預設牌組 — 新增第二彈紅/黃/豆子/藍/紫 AI 牌組選項；補強牌庫檢視縮小／返回、AI 支援階段填能與第二彈 5×5 對局矩陣回歸；記錄第二彈黃對紅 50 場策略訓練。
- 🛡️ AI 攻擊防守修正 — Lv.1/3/4 AI 攻擊改停在 trap 階段等人類防守方回應（先前自動結算導致無法使用陷阱/FLIP）。
- 🔧 BS1-037/054 修正 — MIX 區域顏色解析、BS1-054 OnPlay 廢棄判定、sourceAsEnergy 支付與 AI 決策聯動。

## 2026-07-06

- ✅ Phase 5 CI — 修正線上對戰 lint 失敗，維持 test/lint/build 通過。

## 2026-07-05

- 🧩 補齊卡牌效果（PR #17）— 稽核找出 25 張未支援卡，新增 8 個遊戲機制與 2 個代價/條件；修正 resolveFlip 條件檢查與異圖卡號正規化。

## 2026-07-04

- 🧠 AI 分級 — 新增 Lv.1/Lv.2、`PlayerView` 視角過濾器與 Lv.3 評估式 AI（PR #12、#13）。
- 🔗 指令層整合 — 擴充 `GameCommand`、加入 `commandLog` / replay，並補完牌組管理（PR #11）；對戰紀錄側欄（PR #15）；App.tsx 容器元件拆分（PR #16）。

## 2026-07-03

- 🖱️ Playwright 驗證 — 修正支援卡點擊、藍牌驗證斷言與瀏覽器測試流程。

## 2026-07-02

- 🟥 BS2 紅牌 — 完成 BS2-006/007 非餅乾效果、HP-to-trash 與紅色手牌代價。

## 2026-07-01

- 🧩 BS1/BS2 效果 — 補齊紅色卡牌、非餅乾效果、after-damage 與 attack-effect 控制權。

## 2026-06-30

- 🃏 BS1 匯入 — 建立 Brave Beginning Phase 1/2 轉接與測試基線。
