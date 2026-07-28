/**
 * 主選單 Master Duel 風格提案 mockup。dev server 開 /?mockup=main-menu-md。
 * 並列比較對象：
 *   /?mockup=main-menu           現行版面
 *   /?mockup=main-menu-redesign  P2-5 提案（保留雙欄牌組庫）
 *   /?mockup=main-menu-md        本檔（Master Duel 骨架）
 *
 * 依使用者 2026-07-27 決定改寫的四點（與 Master Duel 原版的差異都是刻意的）：
 *   1. 右側主視覺放「放大的卡牌視覺」而非角色立繪 —— 專案無立繪素材，且 D-012 限制新增公開素材
 *   2. 牌組庫不放主畫面，只留「目前牌組」摘要 ＋ 輕量切換器（‹ ›）；
 *      瀏覽全部牌組／新增／編輯／複製／刪除都在獨立的「我的牌組」畫面（/?mockup=my-decks），
 *      對應 MD 實機截圖顯示的 DECK 是獨立第三畫面、不在主選單也不在牌組編輯器內
 *   3. 完全省略頂列（MD 的頭像／等級／寶石／通知／好友在本專案全部不存在，不做空殼）
 *   4. 本版與 P2-5 版並存供選型，尚未定案
 *
 * 借用的 Master Duel 視覺語言：斜切幾何、深藍＋青色高光、左側 accent bar 的文字型導覽
 * （主項特大、次項遞減）、右側出血主視覺、紅色警示徽章（此處對應「牌組需調整」）。
 * 靜態樣本資料，僅供 UI 審查。
 */
import { useState } from 'react'

interface MockDeck {
  name: string
  total: number
  flip: number
  cookie: number
  item: number
  valid: boolean
  /** 牌組代表卡：同時作為右側主視覺 */
  heroCard: string
}

const DECKS: MockDeck[] = [
  { name: '紫色控制', total: 60, flip: 12, cookie: 24, item: 10, valid: true, heroCard: 'https://cookierunbraverse.com/data/en_storage/ebU68c8QqSAV5JnwQVopEQ.webp' },
  { name: '紅色快攻', total: 60, flip: 16, cookie: 26, item: 8, valid: true, heroCard: 'https://cookierunbraverse.com/data/en_storage/HaWkaxv1TnJ3A-SMA5jN8w.webp' },
  { name: '實驗中：藍綠混', total: 57, flip: 14, cookie: 22, item: 9, valid: false, heroCard: 'https://cookierunbraverse.com/data/en_storage/5kaPkgRaxJDsWQIQ3pGwAQ.webp' },
  { name: '黃色資源', total: 60, flip: 13, cookie: 25, item: 11, valid: true, heroCard: 'https://cookierunbraverse.com/data/en_storage/OobUcWDexyPKEspKHcBNmA.webp' },
  { name: '第二彈藍色', total: 60, flip: 15, cookie: 23, item: 12, valid: true, heroCard: 'https://cookierunbraverse.com/data/en_storage/6mOixxZzqatRDXctoNqI6A.webp' },
]

type MockState = 'has-decks' | 'invalid' | 'empty'

export function MainMenuMasterDuelMockup() {
  const [state, setState] = useState<MockState>('has-decks')
  // 牌組為可變狀態，才能真的示範「刪除目前牌組之後會怎樣」
  const [decks, setDecks] = useState<MockDeck[]>(DECKS)
  // 輕量牌組切換器：高頻的「換牌組」留在主畫面，
  // 瀏覽／新增／複製／刪除都在獨立的「我的牌組」畫面（/?mockup=my-decks）
  const [deckIndex, setDeckIndex] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  const hasDecks = decks.length > 0
  const safeIndex = Math.min(deckIndex, Math.max(decks.length - 1, 0))
  const deck = hasDecks ? decks[safeIndex] : null
  const showError = !!deck && !deck.valid
  const step = (delta: number) =>
    setDeckIndex((i) => (i + delta + decks.length) % decks.length)

  const applyScenario = (next: MockState) => {
    setState(next)
    setNotice(null)
    if (next === 'empty') {
      setDecks([])
      setDeckIndex(0)
    } else {
      setDecks(DECKS)
      setDeckIndex(next === 'invalid' ? 2 : 0)
    }
  }

  return (
    <div className="mock-md-shell">
      <style>{`
        .mock-md-shell { position: fixed; inset: 0; overflow: hidden; min-height: 0;
          display: grid; grid-template-columns: minmax(380px, 44%) 1fr;
          color: #eef9ff; font-family: system-ui, 'Noto Sans TC', sans-serif;
          background: #050c1c; }

        /* 斜切條紋背景：Master Duel 的招牌質感 */
        .mock-md-shell::before { content: ''; position: absolute; inset: 0; z-index: 0;
          background:
            repeating-linear-gradient(115deg, transparent 0 60px,
              rgba(126,231,240,.028) 60px 61px, transparent 61px 130px),
            linear-gradient(118deg, #07142e 0%, #0a1c3d 42%, #061024 72%, #04091a 100%); }

        /* ── 右側主視覺：放大的卡牌（取代 MD 的角色立繪） ── */
        .mock-md-hero { position: absolute; inset: 0 0 0 34%; z-index: 1;
          overflow: hidden; pointer-events: none; }
        .mock-md-hero-glow { position: absolute; top: 50%; left: 46%; width: 78%; aspect-ratio: 1;
          transform: translate(-50%,-50%);
          background: radial-gradient(circle, rgba(126,231,240,.22) 0%, rgba(82,150,255,.1) 42%, transparent 68%); }
        .mock-md-hero-card { position: absolute; top: 50%; right: 4%; transform: translateY(-50%) rotate(-4deg);
          height: min(92%, 780px); width: auto; border-radius: 14px;
          box-shadow: 0 30px 80px rgba(0,0,0,.62), 0 0 0 1px rgba(126,231,240,.22),
            0 0 60px rgba(82,230,255,.16); }
        /* 卡圖載入前／失敗時的替身，避免 mockup 開天窗 */
        .mock-md-hero-fallback { position: absolute; top: 50%; right: 8%; transform: translateY(-50%) rotate(-4deg);
          height: min(78%, 640px); aspect-ratio: 5 / 7; border-radius: 14px;
          border: 1px solid rgba(126,231,240,.28);
          background: linear-gradient(150deg, rgba(18,48,96,.9), rgba(8,20,44,.9));
          display: grid; place-items: center; color: rgba(159,195,232,.5); font-size: .8rem; }
        /* 左緣把主視覺融進左欄，避免硬切線 */
        .mock-md-hero::after { content: ''; position: absolute; inset: 0; width: 42%;
          background: linear-gradient(90deg, #050c1c 8%, rgba(5,12,28,.72) 46%, transparent 100%); }

        /* ── 左欄 ── */
        .mock-md-left { position: relative; z-index: 2; min-height: 0; padding: 26px 22px 18px 30px;
          display: grid; grid-template-rows: auto auto minmax(0,1fr) auto; gap: 16px; }

        /* 字標：與 /?mockup=main-menu-redesign 相同（App.css:69-117 正式版原值） */
        .mock-md-brand { width: min(100%, 390px); margin: 0 0 18px; color: #ffda62;
          font-family: "Noto Sans TC", "Microsoft JhengHei", sans-serif;
          font-weight: 900; text-align: center; }
        .mock-md-brand-line { display: block; color: #ffda62; line-height: .86;
          letter-spacing: -.14em; white-space: nowrap;
          -webkit-text-stroke: 3px #6d351b; paint-order: stroke fill;
          text-shadow: 0 4px 0 #6d351b, 2px 4px 0 #6d351b, -2px 4px 0 #6d351b; }
        .mock-md-brand-top { font-size: clamp(3rem, 6vw, 4.8rem); text-align: center; }
        .mock-md-brand-main { font-size: clamp(4.5rem, 8vw, 5.4rem); text-align: center; }
        .mock-md-brand-badge { display: block; width: min(86%, 320px); margin: 12px auto 0;
          padding: 5px 18px 7px; border-radius: 999px; background: #70401f;
          box-shadow: inset 0 -2px 0 rgba(60,27,13,.45); color: #ffda62;
          font-size: clamp(1.5rem, 3vw, 2.25rem); font-weight: 900; letter-spacing: .14em;
          line-height: 1; text-align: center; text-shadow: 0 2px 0 #4e2915; }

        /* 文字型導覽：MD 的 DUEL / DECK / SOLO / SHOP */
        .mock-md-nav { display: grid; gap: 2px; align-content: start; }
        .mock-md-navitem { position: relative; display: flex; align-items: center; gap: 12px;
          padding: 6px 0 6px 18px; background: none; border: 0; cursor: pointer;
          color: #eef9ff; text-align: left; font-weight: 900; letter-spacing: .01em;
          text-decoration: none; transition: transform .14s, color .14s; }
        .mock-md-navitem::before { content: ''; position: absolute; left: 0; top: 50%;
          transform: translateY(-50%); width: 4px; height: 58%; border-radius: 2px;
          background: rgba(126,231,240,.55); transition: background .14s, height .14s; }
        .mock-md-navitem:hover:not(:disabled) { transform: translateX(5px); color: #7ee7f0; }
        .mock-md-navitem:hover:not(:disabled)::before { background: #7ee7f0; height: 76%; }
        .mock-md-navitem:disabled { color: rgba(159,195,232,.34); cursor: not-allowed; }
        .mock-md-navitem:disabled::before { background: rgba(159,195,232,.18); }
        /* 主項特大，次項遞減 —— MD 的層級手法 */
        .mock-md-navitem.lv1 { font-size: clamp(2.1rem, 4.6vh, 3.1rem); }
        .mock-md-navitem.lv2 { font-size: clamp(1.15rem, 2.5vh, 1.55rem); }
        .mock-md-navitem.lv1.primary { color: #ffda62; }
        .mock-md-navitem.lv1.primary::before { background: #ffda62; width: 5px; }
        .mock-md-badge { display: grid; place-items: center; width: 19px; height: 19px;
          border-radius: 999px; background: #e2455c; color: #fff;
          font-size: .72rem; font-weight: 900; line-height: 1; flex: none; }
        .mock-md-reason { margin: 2px 0 6px 18px; font-size: .72rem;
          color: rgba(159,195,232,.85); line-height: 1.45; }

        /* 目前牌組摘要（取代 MD 左下的 banner 輪播＋MISSION 卡） */
        .mock-md-loadout { align-self: end; position: relative; padding: 14px 16px;
          border-radius: 4px; background: linear-gradient(100deg, rgba(9,26,56,.94), rgba(6,17,38,.82));
          border: 1px solid rgba(126,231,240,.2); border-left: 3px solid #7ee7f0;
          box-shadow: 0 14px 34px rgba(0,0,0,.4); min-height: 0; }
        .mock-md-eyebrow { display: block; color: #7ee7f0; font-size: .66rem;
          font-weight: 800; letter-spacing: .16em; margin-bottom: 6px; }
        .mock-md-loadout-head { display: flex; align-items: baseline; justify-content: space-between;
          gap: 8px; margin-bottom: 6px; }
        .mock-md-counter { font-size: .64rem; letter-spacing: .1em; color: rgba(159,195,232,.7);
          font-variant-numeric: tabular-nums; }

        /* 輕量牌組切換器：高頻動作留在主畫面 */
        .mock-md-switcher { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 8px; }
        .mock-md-arrow { display: grid; place-items: center; width: 26px; height: 26px; flex: none;
          border-radius: 3px; background: rgba(126,231,240,.08);
          border: 1px solid rgba(126,231,240,.26); color: #7ee7f0;
          font-size: .9rem; line-height: 1; cursor: pointer; transition: background .12s, border-color .12s; }
        .mock-md-arrow:hover { background: rgba(126,231,240,.2); border-color: #7ee7f0; }
        .mock-md-deckname { display: flex; align-items: center; gap: 8px; min-width: 0;
          font-size: 1.1rem; font-weight: 800; }
        .mock-md-deckname > span:first-child { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .mock-md-dots { display: flex; gap: 4px; justify-content: center; margin-top: 8px; }
        .mock-md-dots button { width: 6px; height: 6px; padding: 0; border: 0; border-radius: 999px;
          background: rgba(159,195,232,.28); cursor: pointer; }
        .mock-md-dots button.on { background: #7ee7f0; width: 16px; }
        .mock-md-tag { border-radius: 999px; padding: 2px 9px; font-size: .64rem; font-weight: 800; }
        .mock-md-tag.ok { color: #8ef0c8; background: rgba(142,240,200,.14); }
        .mock-md-tag.warn { color: #ffd66f; background: rgba(255,214,111,.14); }
        .mock-md-chips { display: flex; flex-wrap: wrap; gap: 5px; margin-top: 8px; }
        .mock-md-chips span { padding: 2px 8px; border-radius: 999px; font-size: .66rem;
          color: #ffda62; border: 1px solid rgba(255,218,98,.32); background: rgba(255,218,98,.06); }
        .mock-md-errors { display: grid; grid-template-columns: auto 1fr; gap: 8px; margin-top: 10px;
          padding-top: 10px; border-top: 1px solid rgba(226,69,92,.3);
          max-height: 84px; overflow: auto; }
        .mock-md-errors strong { color: #ff9db8; font-size: .78rem; }
        .mock-md-errors ul { margin: 3px 0 0; padding-left: 15px; font-size: .72rem; color: #ffc7d6; }
        .mock-md-empty { font-size: .8rem; color: #9fc3e8; line-height: 1.6; }

        .mock-md-ai { display: flex; gap: 8px; margin-top: 12px; padding-top: 10px;
          border-top: 1px solid rgba(126,231,240,.14); }
        .mock-md-ai label { flex: 1; min-width: 0; display: grid; gap: 3px;
          font-size: .64rem; letter-spacing: .1em; color: rgba(159,195,232,.8); font-weight: 700; }
        .mock-md-ai select { padding: 5px 7px; border-radius: 3px; background: #0a1b3a;
          color: #eef9ff; border: 1px solid rgba(126,231,240,.26); font-size: .78rem; }

        /* Footer：開發者工具 utility bar ＋ 免責聲明 */
        .mock-md-footer { display: grid; gap: 7px; }
        .mock-md-utility { display: flex; align-items: center; gap: 7px; flex-wrap: wrap; }
        .mock-md-utility-label { font-size: .6rem; font-weight: 800; letter-spacing: .16em;
          color: rgba(159,195,232,.55); }
        .mock-md-utility button { padding: 3px 9px; border-radius: 3px; font-size: .71rem;
          background: transparent; color: rgba(159,195,232,.8);
          border: 1px solid rgba(255,255,255,.1); cursor: pointer; }
        .mock-md-utility button:hover { color: #eef9ff; border-color: rgba(126,231,240,.38); }
        .mock-md-disclaimer { margin: 0; font-size: .62rem; line-height: 1.5;
          color: rgba(210,226,252,.42); }

        /* 操作結果提示 */
        .mock-md-notice { position: fixed; left: 50%; bottom: 22px; transform: translateX(-50%);
          z-index: 18; display: flex; align-items: center; gap: 12px;
          max-width: min(560px, calc(100vw - 32px));
          padding: 10px 12px 10px 16px; border-radius: 4px;
          background: rgba(9,26,56,.97); border: 1px solid rgba(126,231,240,.4);
          border-left: 3px solid #7ee7f0; box-shadow: 0 14px 40px rgba(0,0,0,.55);
          font-size: .8rem; color: #eef9ff; line-height: 1.5; }
        .mock-md-notice button { flex: none; width: 22px; height: 22px; border-radius: 3px;
          background: transparent; color: #9fc3e8; border: 1px solid rgba(255,255,255,.14);
          cursor: pointer; font-size: .7rem; }

        /* 狀態切換器：僅 mockup 用 */
        .mock-md-switch { position: fixed; top: 10px; right: 10px; z-index: 20;
          display: flex; gap: 4px; padding: 5px; border-radius: 6px;
          background: rgba(2,8,23,.92); border: 1px solid rgba(126,231,240,.3); }
        .mock-md-switch button { padding: 4px 10px; border-radius: 4px; font-size: .7rem;
          background: transparent; color: #9fc3e8; border: 0; cursor: pointer; }
        .mock-md-switch button.on { background: rgba(126,231,240,.18); color: #7ee7f0; font-weight: 700; }

        @media (max-height: 780px) {
          .mock-md-left { padding: 18px 18px 14px 24px; gap: 11px; }
          .mock-md-loadout { padding: 11px 13px; }
          .mock-md-ai { margin-top: 9px; padding-top: 8px; }
        }
        @media (max-width: 1180px) {
          .mock-md-shell { grid-template-columns: minmax(340px, 50%) 1fr; }
          .mock-md-hero { inset: 0 0 0 40%; }
        }
        @media (max-width: 900px) {
          .mock-md-shell { grid-template-columns: 1fr; }
          .mock-md-hero { inset: 0; opacity: .7; }
          .mock-md-hero::after { width: 100%;
            background: linear-gradient(180deg, rgba(5,12,28,.55), rgba(5,12,28,.9)); }
          .mock-md-left { overflow-y: auto; }
        }
      `}</style>

      <div className="mock-md-switch">
        {([
          ['has-decks', '有牌組'],
          ['invalid', '牌組不合法'],
          ['empty', '空狀態'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={state === id ? 'on' : ''}
            onClick={() => applyScenario(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* 操作結果提示：示範刪除／複製之後主畫面怎麼接手 */}
      {notice && (
        <div className="mock-md-notice" role="status">
          {notice}
          <button type="button" aria-label="關閉提示" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {/* 右側主視覺：目前牌組的代表卡，隨切換器連動 */}
      <div className="mock-md-hero" aria-hidden="true">
        <div className="mock-md-hero-glow" />
        {!deck && (
          <img
            className="mock-md-hero-card"
            src="https://cookierunbraverse.com/data/en_storage/2HgB5QrG10BzWXr00hCI0w.webp"
            alt="勇敢餅乾"
          />
        )}
        {deck && (
          <img
            className="mock-md-hero-card"
            key={deck.heroCard}
            src={deck.heroCard}
            alt=""
          />
        )}
      </div>

      {/* ── 左欄 ── */}
      <div className="mock-md-left">
        <h1 className="mock-md-brand" aria-label="薑餅人對戰卡牌 Braverse">
          <span className="mock-md-brand-line mock-md-brand-top">薑餅人</span>
          <span className="mock-md-brand-line mock-md-brand-main">對戰卡牌</span>
          <span className="mock-md-brand-badge">BRAVERSE</span>
        </h1>

        {/* 文字型導覽（MD 的 DUEL / DECK / SOLO / SHOP） */}
        <nav className="mock-md-nav" aria-label="主選單">
          {hasDecks ? (
            <button type="button" className="mock-md-navitem lv1 primary">
              AI 對戰
              {showError && <span className="mock-md-badge">!</span>}
            </button>
          ) : (
            <>
              <a className="mock-md-navitem lv1 primary" href="/?mockup=my-decks">
                建立第一副牌組
              </a>
              <button
                type="button"
                className="mock-md-navitem lv2"
                disabled
                aria-describedby="md-reason-battle"
              >
                AI 對戰
              </button>
              <p className="mock-md-reason" id="md-reason-battle">
                尚無自訂牌組，請先建立牌組後再開始對戰。
              </p>
            </>
          )}

          <button
            type="button"
            className="mock-md-navitem lv2"
            disabled={!hasDecks}
            aria-label="線上對戰"
            aria-describedby={hasDecks ? undefined : 'md-reason-online'}
          >
            線上對戰
          </button>
          {!hasDecks && (
            <p className="mock-md-reason" id="md-reason-online">
              建立房間或加入房間，與好友進行對戰。
            </p>
          )}

          {/* 牌組管理已獨立成「我的牌組」畫面（/?mockup=my-decks） */}
          <a className="mock-md-navitem lv2" href="/?mockup=my-decks">
            牌組
          </a>
        </nav>

        {/* 目前牌組摘要：完整清單已移入牌組編輯器 */}
        <section className="mock-md-loadout">
          <div className="mock-md-loadout-head">
            <span className="mock-md-eyebrow" style={{ marginBottom: 0 }}>目前玩家牌組</span>
            {deck && (
              <span className="mock-md-counter">{safeIndex + 1} / {decks.length}</span>
            )}
          </div>

          {deck ? (
            <>
              {/* 輕量切換器：左右鍵換牌組；瀏覽全部／新增／編輯／複製／刪除進「我的牌組」 */}
              <div className="mock-md-switcher">
                <button
                  type="button"
                  className="mock-md-arrow"
                  aria-label="上一副牌組"
                  onClick={() => step(-1)}
                >
                  ‹
                </button>
                <div className="mock-md-deckname">
                  <span>{deck.name}</span>
                  <span className={`mock-md-tag ${showError ? 'warn' : 'ok'}`}>
                    {showError ? '需調整' : '合法'}
                  </span>
                </div>
                <button
                  type="button"
                  className="mock-md-arrow"
                  aria-label="下一副牌組"
                  onClick={() => step(1)}
                >
                  ›
                </button>
              </div>

              <div className="mock-md-chips">
                <span>{deck.total} / 60 張</span>
                <span>FLIP {deck.flip} / 16</span>
                <span>餅乾 {deck.cookie}</span>
                <span>物品 {deck.item}</span>
                <span>陷阱 4</span>
                <span>舞台 2</span>
              </div>

              {decks.length > 1 && (
                <div className="mock-md-dots">
                  {decks.map((d, i) => (
                    <button
                      key={`${d.name}-${i}`}
                      type="button"
                      className={i === safeIndex ? 'on' : ''}
                      aria-label={`切換到 ${d.name}`}
                      onClick={() => setDeckIndex(i)}
                    />
                  ))}
                </div>
              )}

              {showError && (
                <div className="mock-md-errors" role="alert">
                  <span aria-hidden="true">⚠</span>
                  <div>
                    <strong>目前牌組尚未合法</strong>
                    <ul>
                      <li>牌組必須剛好 60 張，目前為 {deck.total} 張</li>
                    </ul>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="mock-md-empty">
              尚未有自訂牌組。
              <br />
              請進入「我的牌組」建立第一副牌組。
            </p>
          )}

          <div className="mock-md-ai">
            <label>
              AI 牌組
              <select defaultValue="bs2-red">
                <option value="random">隨機</option>
                <option value="bs2-red">第二彈紅色牌組</option>
                <option value="bs2-blue">第二彈藍色牌組</option>
              </select>
            </label>
            <label>
              AI 等級
              <select defaultValue="3">
                <option value="1">Lv.1</option>
                <option value="3">Lv.3</option>
                <option value="4">Lv.4</option>
              </select>
            </label>
          </div>
        </section>

        <footer className="mock-md-footer">
          <nav className="mock-md-utility" aria-label="開發者工具">
            <span className="mock-md-utility-label">開發者工具</span>
            <button type="button">測試對局設定</button>
          </nav>
          <p className="mock-md-disclaimer">
            本作品為非官方粉絲研究專案，與 Devsisters Corporation 無任何關聯、合作或授權。
            ｜Mockup：Master Duel 風格提案，牌組管理見 /?mockup=my-decks（對照組 /?mockup=main-menu-redesign）
          </p>
        </footer>
      </div>
    </div>
  )
}
