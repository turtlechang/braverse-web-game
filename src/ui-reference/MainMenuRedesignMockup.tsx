/**
 * 主選單「全面重新設計」提案 mockup（計畫 P2-5 的可渲染版）。
 * 對照組為 /?mockup=main-menu（現行版面）。dev server 開 /?mockup=main-menu-redesign。
 *
 * 這份要展示的四件事：
 *   1. 三層 IA：左欄開戰台（字標→主 CTA→目前牌組＋錯誤→AI 對手）／右欄牌組庫／footer utility bar
 *   2. 開發者工具（測試對局設定・重新讀取）視覺降級到 footer，不再與「對戰入口」同級
 *   3. 錯誤區併入 loadout 卡片內，不再獨立成 grid-area 推高左欄
 *   4. 捲動收斂：只有牌組清單會捲，主 CTA 永遠在第一屏
 * 可見中文標籤與品牌字標維持與正式版相同（測試與瀏覽器腳本的硬合約）。
 * 靜態樣本資料，僅供 UI 審查。
 */
import { useState } from 'react'

interface MockDeck {
  id: string
  name: string
  total: number
  flip: number
  cookie: number
  item: number
  valid: boolean
  updatedAt: string
}

const DECKS: MockDeck[] = [
  { id: 'd1', name: '紫色控制', total: 60, flip: 12, cookie: 24, item: 10, valid: true, updatedAt: '07/09 21:40' },
  { id: 'd2', name: '紅色快攻', total: 60, flip: 16, cookie: 26, item: 8, valid: true, updatedAt: '07/08 18:12' },
  { id: 'd3', name: '實驗中：藍綠混', total: 57, flip: 14, cookie: 22, item: 9, valid: false, updatedAt: '07/10 09:03' },
  { id: 'd4', name: '黃色資源', total: 60, flip: 13, cookie: 25, item: 11, valid: true, updatedAt: '07/07 11:55' },
  { id: 'd5', name: '第二彈藍色測試', total: 60, flip: 15, cookie: 23, item: 12, valid: true, updatedAt: '07/06 20:31' },
]

type MockState = 'has-decks' | 'empty' | 'invalid'

export function MainMenuRedesignMockup() {
  const [state, setState] = useState<MockState>('has-decks')
  const hasDecks = state !== 'empty'
  const showError = state === 'invalid'
  const selectedDeck = showError ? DECKS[2] : DECKS[0]

  return (
    <div className="mock-mm2-shell">
      <style>{`
        .mock-mm2-shell { position: fixed; inset: 0; display: grid;
          grid-template-rows: minmax(0,1fr) auto; place-items: center;
          padding: 28px; overflow: hidden; min-height: 0;
          background: linear-gradient(135deg, rgba(8,38,89,.96), rgba(22,62,126,.9)), #07162f;
          color: #eef9ff; font-family: system-ui, 'Noto Sans TC', sans-serif; }

        /* 面板：兩欄，自己不捲（現行版是 overflow:auto → 整頁一起捲的元凶） */
        .mock-mm2-panel { width: min(1120px, 100%); height: 100%; min-height: 0;
          display: grid; gap: 18px; overflow: hidden;
          grid-template-columns: minmax(320px,.86fr) minmax(420px,1.14fr);
          grid-template-areas: "launch library"; }

        /* ── 左欄：開戰台 ── */
        .mock-mm2-launch { grid-area: launch; min-height: 0; display: grid; gap: 14px;
          grid-template-rows: auto auto auto auto; align-content: start; }

        /* 字標：還原正式版尺寸（App.css:69-117 原值），未套用高度感知縮放 */
        .mock-mm2-brand { width: min(100%, 390px); margin: 0 0 18px; color: #ffda62;
          font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
          font-weight: 900; text-align: center; }
        .mock-mm2-brand-line { display: block; color: #ffda62; line-height: .86;
          letter-spacing: -.14em; white-space: nowrap;
          -webkit-text-stroke: 3px #6d351b; paint-order: stroke fill;
          text-shadow: 0 4px 0 #6d351b, 2px 4px 0 #6d351b, -2px 4px 0 #6d351b; }
        .mock-mm2-brand-top { font-size: clamp(3rem, 6vw, 4.8rem); text-align: center; }
        .mock-mm2-brand-main { font-size: clamp(4.5rem, 8vw, 5.4rem); text-align: center; }
        .mock-mm2-brand-badge { display: block; width: min(86%, 320px); margin: 12px auto 0;
          padding: 5px 18px 7px; border-radius: 999px; background: #70401f;
          box-shadow: inset 0 -2px 0 rgba(60,27,13,.45); color: #ffda62;
          font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 900; letter-spacing: .14em;
          line-height: 1; text-align: center; text-shadow: 0 2px 0 #4e2915; }
        .mock-mm2-tagline { margin: 6px 0 0; font-size: .82rem; color: #9fc3e8; line-height: 1.5; }

        /* 主 CTA 群：四顆（原本六顆，開發者工具已下放 footer） */
        .mock-mm2-actions { display: grid; gap: 10px; }
        .mock-mm2-actions button { display: flex; align-items: center; gap: 10px;
          min-height: 42px; padding: 0 14px; border-radius: 8px; text-align: left;
          font-size: .88rem; font-weight: 700; color: #eef9ff;
          background: rgba(7,27,61,.78); border: 1px solid rgba(126,231,240,.28);
          cursor: pointer; transition: border-color .12s, background .12s; }
        .mock-mm2-actions button:hover:not(:disabled) { border-color: #7ee7f0; }
        .mock-mm2-actions button:disabled { opacity: .38; cursor: not-allowed; }
        .mock-mm2-actions .primary { min-height: 48px; font-size: .96rem;
          background: linear-gradient(90deg, rgba(82,230,255,.3), rgba(82,230,255,.12));
          border-color: #ffda62; color: #ffeaa0; }
        .mock-mm2-reason { margin: -4px 0 0; padding-left: 2px; font-size: .72rem;
          color: #9fc3e8; line-height: 1.4; }

        /* 共用卡片外觀（loadout / opponent / library） */
        .mock-mm2-card { border-radius: 8px; padding: 14px 16px; background: rgba(5,21,52,.62);
          border: 1px solid rgba(255,255,255,.06); box-shadow: 0 8px 20px rgba(0,0,0,.2);
          min-height: 0; }
        .mock-mm2-eyebrow { display: block; color: #7ee7f0; font-size: .7rem;
          font-weight: 800; letter-spacing: .12em; margin-bottom: 6px; }
        .mock-mm2-card strong { font-size: 1.06rem; }

        .mock-mm2-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 8px; }
        .mock-mm2-chips span { padding: 2px 8px; border-radius: 999px; font-size: .68rem;
          color: #ffda62; border: 1px solid rgba(255,218,98,.35); background: rgba(255,218,98,.07); }

        /* 錯誤區：現在住在 loadout 卡片「裡面」，不再獨立 grid-area 推高左欄 */
        .mock-mm2-errors { display: grid; grid-template-columns: auto 1fr; gap: 8px;
          margin-top: 10px; padding-top: 10px; border-top: 1px solid rgba(255,157,184,.28);
          max-height: 92px; overflow: auto; }
        .mock-mm2-errors strong { color: #ff9db8; font-size: .8rem; }
        .mock-mm2-errors ul { margin: 4px 0 0; padding-left: 16px; font-size: .74rem; color: #ffc7d6; }

        .mock-mm2-ai { display: flex; gap: 10px; margin-top: 6px; }
        .mock-mm2-ai label { flex: 1; min-width: 140px; display: grid; gap: 4px;
          font-size: .7rem; color: #9fc3e8; }
        .mock-mm2-ai select { padding: 6px 8px; border-radius: 6px; background: #0c1e3e;
          color: #eef9ff; border: 1px solid rgba(126,231,240,.28); font-size: .8rem; }
        .mock-mm2-hint { margin: 8px 0 0; font-size: .72rem; color: #9fc3e8; }

        /* ── 右欄：牌組庫（唯一會捲的區域） ── */
        .mock-mm2-library { grid-area: library; min-height: 0;
          display: grid; grid-template-rows: auto minmax(0,1fr); gap: 10px; }
        .mock-mm2-library-head { display: flex; justify-content: space-between; align-items: center; }
        .mock-mm2-library-head button { min-height: 32px; padding: 0 12px; border-radius: 8px;
          border: 1px solid rgba(126,231,240,.28); background: transparent; color: #7ee7f0;
          font-size: .78rem; font-weight: 700; cursor: pointer; }
        .mock-mm2-library-head button:hover { border-color: #7ee7f0; }
        .mock-mm2-count { font-size: .68rem; color: #9fc3e8; font-weight: 400; letter-spacing: 0; }
        .mock-mm2-decklist { overflow: auto; display: grid; gap: 8px; align-content: start;
          padding-right: 4px; }

        .mock-mm2-deckcard { border-radius: 8px; padding: 10px 12px; background: rgba(7,27,61,.78);
          border: 1px solid rgba(255,255,255,.08); transition: border-color .12s; }
        .mock-mm2-deckcard:hover { border-color: rgba(126,231,240,.5); }
        .mock-mm2-deckcard.is-selected { border-color: #ffda62; background: rgba(14,40,82,.9); }
        .mock-mm2-deckrow { display: flex; justify-content: space-between; align-items: center;
          gap: 8px; width: 100%; background: none; border: 0; padding: 0; cursor: pointer;
          color: inherit; text-align: left; }
        .mock-mm2-tag { border-radius: 999px; padding: 2px 10px; font-size: .66rem; font-weight: 800;
          white-space: nowrap; }
        .mock-mm2-tag.ok { color: #8ef0c8; background: rgba(142,240,200,.14); }
        .mock-mm2-tag.warn { color: #ffd66f; background: rgba(255,214,111,.14); }
        .mock-mm2-deckops { display: flex; gap: 8px; margin-top: 8px; }
        .mock-mm2-deckops button { padding: 4px 10px; border-radius: 6px; font-size: .7rem;
          cursor: pointer; background: transparent; color: #9fc3e8;
          border: 1px solid rgba(126,231,240,.28); }
        .mock-mm2-deckops button.danger { color: #ff9db8; border-color: rgba(255,157,184,.4); }
        .mock-mm2-empty { border: 1px dashed rgba(126,231,240,.3); border-radius: 8px;
          min-height: 180px; display: grid; place-items: center; text-align: center;
          padding: 16px; font-size: .8rem; color: #9fc3e8; line-height: 1.6; }

        /* ── Footer：utility bar（開發者工具）＋ 免責聲明 ── */
        .mock-mm2-footer { width: min(1120px, 100%); display: grid; gap: 8px; margin-top: 12px; }
        .mock-mm2-utility { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
        .mock-mm2-utility-label { font-size: .64rem; font-weight: 800; letter-spacing: .14em;
          color: rgba(159,195,232,.7); text-transform: uppercase; }
        .mock-mm2-utility button { padding: 4px 10px; border-radius: 6px; font-size: .74rem;
          background: transparent; color: rgba(159,195,232,.85);
          border: 1px solid rgba(255,255,255,.12); cursor: pointer; }
        .mock-mm2-utility button:hover { color: #eef9ff; border-color: rgba(126,231,240,.4); }
        .mock-mm2-disclaimer { font-size: .66rem; color: rgba(210,226,252,.5);
          text-align: center; line-height: 1.5; margin: 0; }

        /* 狀態切換器：僅 mockup 用，不屬於提案 */
        .mock-mm2-switch { position: fixed; top: 10px; right: 10px; z-index: 10;
          display: flex; gap: 4px; padding: 5px; border-radius: 8px;
          background: rgba(2,8,23,.9); border: 1px solid rgba(126,231,240,.3); }
        .mock-mm2-switch button { padding: 4px 10px; border-radius: 5px; font-size: .7rem;
          background: transparent; color: #9fc3e8; border: 0; cursor: pointer; }
        .mock-mm2-switch button.on { background: rgba(126,231,240,.18); color: #7ee7f0; font-weight: 700; }

        /* ── 斷點 ── */
        /* 緊湊模式：專為 1366×768 / 1280×720 新增（現行版 680px 與桌機之間完全沒有斷點） */
        @media (max-height: 780px) {
          .mock-mm2-shell { padding: 18px; }
          .mock-mm2-panel { gap: 12px; }
          .mock-mm2-launch { gap: 10px; }
          .mock-mm2-actions { gap: 8px; }
          .mock-mm2-actions button { min-height: 38px; }
          .mock-mm2-actions .primary { min-height: 42px; }
          .mock-mm2-card { padding: 12px; }
          .mock-mm2-footer { margin-top: 8px; }
        }
        @media (max-width: 1180px) {
          .mock-mm2-panel { gap: 14px;
            grid-template-columns: minmax(300px,.9fr) minmax(360px,1.1fr); }
        }
        @media (max-width: 900px) {
          .mock-mm2-panel { grid-template-columns: 1fr;
            grid-template-areas: "launch" "library"; overflow: auto; }
          .mock-mm2-library { max-height: 46vh; }
        }
        @media (max-width: 680px) {
          .mock-mm2-shell { padding: 14px; place-items: stretch; }
        }
      `}</style>

      <div className="mock-mm2-switch">
        {([
          ['has-decks', '有牌組'],
          ['invalid', '牌組不合法'],
          ['empty', '空狀態'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={state === id ? 'on' : ''}
            onClick={() => setState(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="mock-mm2-panel">
        {/* ─── 左欄：開戰台 ─── */}
        <section className="mock-mm2-launch">
          <div>
            <h1 className="mock-mm2-brand" aria-label="薑餅人對戰卡牌 Braverse">
              <span className="mock-mm2-brand-line mock-mm2-brand-top">薑餅人</span>
              <span className="mock-mm2-brand-line mock-mm2-brand-main">對戰卡牌</span>
              <span className="mock-mm2-brand-badge">BRAVERSE</span>
            </h1>
            <p className="mock-mm2-tagline">
              {hasDecks
                ? '選擇一副合法牌組後開始對戰；AI 對手的牌組與等級可在下方指定。'
                : '尚未有自訂牌組。先建立第一副牌組，就能開始對戰。'}
            </p>
          </div>

          <div className="mock-mm2-actions">
            {hasDecks ? (
              <button type="button" className="primary">▶ 對戰入口</button>
            ) : (
              <>
                <button type="button" className="primary">＋ 建立第一副牌組</button>
                <button type="button" disabled aria-describedby="mm2-reason-battle">
                  ▶ 對戰入口
                </button>
                <p className="mock-mm2-reason" id="mm2-reason-battle">
                  尚無自訂牌組，請先建立牌組後再開始對戰。
                </p>
              </>
            )}

            <button
              type="button"
              disabled={!hasDecks}
              aria-label="線上對戰"
              aria-describedby={hasDecks ? undefined : 'mm2-reason-online'}
            >
              📶 線上對戰
            </button>
            {!hasDecks && (
              <p className="mock-mm2-reason" id="mm2-reason-online">
                尚無自訂牌組，請先建立牌組後再進行線上對戰。
              </p>
            )}

            <button type="button">✏ {hasDecks ? '牌組編輯器' : '開啟牌組編輯器'}</button>
          </div>

          {/* loadout：目前牌組 ＋（有問題時）錯誤區，錯誤不再推高整個左欄 */}
          <section className="mock-mm2-card">
            <span className="mock-mm2-eyebrow">目前玩家牌組</span>
            {hasDecks ? (
              <>
                <strong>{selectedDeck.name}</strong>
                <div className="mock-mm2-chips">
                  <span>{selectedDeck.total} / 60 張</span>
                  <span>FLIP {selectedDeck.flip} / 16</span>
                  <span>餅乾 {selectedDeck.cookie}</span>
                  <span>物品 {selectedDeck.item}</span>
                  <span>陷阱 4</span>
                  <span>舞台 2</span>
                </div>
              </>
            ) : (
              <p className="mock-mm2-hint">請先建立或選擇一副自訂牌組。</p>
            )}

            {showError && (
              <div className="mock-mm2-errors" role="alert">
                <span aria-hidden="true">⚠</span>
                <div>
                  <strong>目前牌組尚未合法</strong>
                  <ul>
                    <li>牌組必須剛好 60 張，目前為 57 張</li>
                    <li>FLIP 卡最多 16 張，目前為 14 張（尚可）</li>
                  </ul>
                </div>
              </div>
            )}
          </section>

          <section className="mock-mm2-card">
            <span className="mock-mm2-eyebrow">AI 對手</span>
            <div className="mock-mm2-ai">
              <label>
                牌組
                <select defaultValue="bs2-red">
                  <option value="random">隨機</option>
                  <option value="bs2-red">第二彈紅色牌組</option>
                  <option value="bs2-blue">第二彈藍色牌組</option>
                </select>
              </label>
              <label>
                等級
                <select defaultValue="3">
                  <option value="1">Lv.1</option>
                  <option value="3">Lv.3</option>
                  <option value="4">Lv.4</option>
                </select>
              </label>
            </div>
            <p className="mock-mm2-hint">評估戰局後選擇最佳行動。</p>
          </section>
        </section>

        {/* ─── 右欄：牌組庫（唯一會捲的區域） ─── */}
        <section className="mock-mm2-card mock-mm2-library" aria-label="已儲存牌組">
          <div className="mock-mm2-library-head">
            <span className="mock-mm2-eyebrow" style={{ marginBottom: 0 }}>
              已儲存牌組{' '}
              {hasDecks && (
                <span className="mock-mm2-count">5 副・1 副需調整</span>
              )}
            </span>
            <button type="button">新增牌組</button>
          </div>

          {hasDecks ? (
            <div className="mock-mm2-decklist">
              {DECKS.map((deck) => (
                <article
                  key={deck.id}
                  className={`mock-mm2-deckcard${deck.id === selectedDeck.id ? ' is-selected' : ''}`}
                >
                  <button type="button" className="mock-mm2-deckrow">
                    <strong>{deck.name}</strong>
                    <span
                      className={`mock-mm2-tag ${deck.valid ? 'ok' : 'warn'}`}
                      title={deck.valid ? undefined : '牌組必須剛好 60 張，目前為 57 張'}
                    >
                      {deck.valid ? '合法' : '需調整'}
                    </span>
                  </button>
                  <div className="mock-mm2-chips">
                    <span>{deck.total} 張</span>
                    <span>FLIP {deck.flip}</span>
                    <span>餅乾 {deck.cookie}</span>
                    <span>{deck.updatedAt}</span>
                  </div>
                  <div className="mock-mm2-deckops">
                    <button type="button">編輯</button>
                    <button type="button">複製</button>
                    <button type="button" className="danger">刪除</button>
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mock-mm2-empty">
              尚未有自訂牌組。
              <br />
              請進入牌組編輯器建立第一副牌組。
            </div>
          )}
        </section>
      </div>

      {/* ─── Footer：開發者工具降級到這裡 ─── */}
      <footer className="mock-mm2-footer">
        <nav className="mock-mm2-utility" aria-label="開發者工具">
          <span className="mock-mm2-utility-label">開發者工具</span>
          <button type="button">測試對局設定</button>
          <button type="button">重新讀取</button>
        </nav>
        <p className="mock-mm2-disclaimer">
          本作品為非官方粉絲研究專案，與 Devsisters Corporation 無任何關聯、合作或授權。
          ｜Mockup：P2-5 主選單全面重新設計提案（對照組 /?mockup=main-menu）
        </p>
      </footer>
    </div>
  )
}
