# 線上對戰伺服器宿主評估（Online Server Hosting）

最後更新：2026-07-10（依當日官網與第三方資料查證；雲端定價變動快，執行前請再確認）

## 1. 需求

`server/`（ws WebSocket 伺服器）需要：**長連線**（Vercel serverless 不支援，見 known-risks R6）、Node 22、GitHub 自動部署佳、**成本越低越好**（同人專案零預算）、流量極低（單一維護者＋朋友對戰、房間碼制、無配對）。

## 2. 三平台比較（2026-07 查證）

| 面向 | Render | Railway | Fly.io |
|---|---|---|---|
| 免費層 | ✅ 有真正免費層（Free web service） | ❌ 無；一次性 $5 試用額度 | ❌ 無；試用僅 2 VM 小時或 7 天 |
| 最低月費（always-on） | $0（免費層）／付費約 $7 起 | Hobby $5/月底價＋用量（0.5 vCPU 全月實測約 $10–15） | 最小機器約 $2–5/月（pay-as-you-go） |
| WebSocket | ✅ 支援；免費層閒置 15 分鐘後休眠，休眠會**切斷所有連線**；活躍對局的 ws 訊息計入流量、可維持喚醒 | ✅ 支援，always-on 不休眠 | ✅ 支援；機器可 auto-stop/auto-start（連線進來喚醒） |
| 冷啟動 | 免費層休眠後首次連線約 30–60 秒 | 無（always-on） | auto-stop 模式下數秒 |
| 部署方式 | GitHub 連動、原生 Node（免 Docker） | GitHub 連動、Nixpacks 自動偵測（免 Docker） | 需 `flyctl` CLI＋Dockerfile/fly.toml，ops 負擔最高 |
| 適合本專案 | ✅ MVP 驗收與朋友對戰零成本 | DX 最佳但固定支出 | 單價最低但維運門檻最高 |

## 3. 推薦：**Render 免費層**

理由：

1. 三者中唯一零成本方案，符合同人專案定位；GitHub push 自動部署、原生 Node，接入成本最低。
2. 免費層的兩個限制對本專案影響可控：
   - **休眠切斷連線**：房間碼制的臨時對局本來就不做斷線重連承諾（MVP 範圍外）；對局進行中有 ws 訊息往來，不會被判閒置。
   - **冷啟動 30–60 秒**：只發生在「第一個人開房」時。緩解：前端連線階段顯示「伺服器喚醒中，約需 1 分鐘」提示（OnlineMatchPanel 已有連線狀態顯示，補一段文案即可）。
3. 升級路徑平順：若之後想去掉冷啟動，Render 付費（約 $7/月）或 Railway Hobby（$5/月底價）皆可無痛遷移——`server/` 是純 Node ws，無平台綁定。

不推薦 Fly.io 的原因：無免費層後性價比優勢縮小，且需要維護 Dockerfile/fly.toml 與 CLI 流程，對單人專案是持續負擔。不推薦 Railway 起步的原因：月月固定支出，對「偶爾開一局」的使用型態不划算。

## 4. 部署步驟（待執行，roadmap P1）

1. Render Dashboard → New Web Service → 連 GitHub repo。
2. Build Command：`npm ci`；Start Command：`npx tsx server/src/index.ts`（或先補 `server:build` script 編譯後以 node 執行，避免 production 依賴 tsx——建議後者，屆時一併調整）。
3. 服務需讀取 `PORT` 環境變數（Render 指定埠號）——部署前確認 `server/src/index.ts` 支援。
4. 前端以 `VITE_ONLINE_SERVER_URL` 之類環境變數指向 `wss://<app>.onrender.com`，Vercel 上設定。
5. 驗收：兩個瀏覽器視窗經公網完成一局，記錄於 test-plan。

## 5. 資料來源

- [Render — Deploy for Free](https://render.com/docs/free)、[Render FAQ](https://render.com/docs/faq)
- [Railway — Pricing Plans](https://docs.railway.com/pricing/plans)、[Railway 實際成本分析](https://servercompass.app/blog/railway-pricing-what-youll-actually-pay)
- [Fly.io — Pricing](https://fly.io/pricing/)、[Fly.io Free Trial](https://fly.io/docs/about/free-trial/)、[Fly.io 免費層變動分析](https://www.saaspricepulse.com/tools/flyio)
