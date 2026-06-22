# 對手效果棄牌公開視窗設計

## 目標

當 AI 因卡牌效果棄置一張或多張手牌時，在同一視窗公開全部被棄置的卡牌，讓玩家確認公開資訊後再繼續戰鬥、補位或其他待決流程。

## 設計

- 規則層仍由既有 `resolveOpponentHandDiscard` 完成卡牌移動，不在 UI 重算棄牌結果。
- AI 在執行棄牌前保存選定卡牌，並於 `AiDecision.revealedCards` 回傳完整清單。
- `useAiTurn` 遇到 `revealedCards` 時暫存 AI 決策，不先套用 `decision.state`。
- App 顯示「對手棄置的卡牌」視窗，在同一視窗排列全部卡牌；只有按下確認後才套用 AI 決策狀態。
- 既有陷阱與 FLIP 的 `revealedCard` 單卡公開流程維持不變。

## 邊界

- 只公開因 `opponent-discard-hand` 效果由 AI 棄置的卡牌。
- 玩家自己選擇棄置時不額外顯示公開視窗，因玩家已看見自己的選擇。
- 一張與多張卡牌共用相同多卡視窗。

## 驗證

- AI 單元測試確認 `revealedCards` 等於實際移入棄牌區的卡牌。
- 多卡視窗元件測試確認所有卡名與確認按鈕均呈現。
- 確認後沿用既有 `confirmAiDecision`，驗證 ST5-004 棄牌後補位流程可繼續。
- 執行完整單元測試、lint、build 與 AI 瀏覽器驗證。
