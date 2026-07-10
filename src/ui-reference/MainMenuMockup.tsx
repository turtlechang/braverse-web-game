/**
 * 主選單 mockup（docs/ui-reference/02-main-menu-wireframe.md 的可渲染版）。
 * 呈現「現行雙欄 grid + W5 氛圍改進（漸層字標、牌組代表色條）」的目標樣貌；
 * 靜態樣本資料，僅供 UI 審查。dev server 開 /?mockup=main-menu。
 */

interface MockDeck {
  id: string
  name: string
  color: string
  total: number
  flip: number
  cookie: number
  valid: boolean
  updatedAt: string
}

const DECKS: MockDeck[] = [
  { id: 'd1', name: '紫色控制', color: '#9a6fd0', total: 60, flip: 12, cookie: 24, valid: true, updatedAt: '07/09 21:40' },
  { id: 'd2', name: '紅色快攻', color: '#c94f5f', total: 60, flip: 16, cookie: 26, valid: true, updatedAt: '07/08 18:12' },
  { id: 'd3', name: '實驗中：藍綠混', color: '#3f9a6e', total: 57, flip: 14, cookie: 22, valid: false, updatedAt: '07/10 09:03' },
]

export function MainMenuMockup() {
  return (
    <div className="mock-mm-root">
      <style>{`
        .mock-mm-root { position: fixed; inset: 0; display: grid; grid-template-rows: minmax(0,1fr) auto;
          place-items: center; padding: 28px; overflow: hidden;
          background: linear-gradient(135deg, rgba(8,38,89,.96), rgba(22,62,126,.9)), #07162f;
          color: #eef9ff; font-family: system-ui, 'Noto Sans TC', sans-serif; }
        .mock-mm-panel { width: min(1120px, 100%); display: grid; gap: 18px;
          grid-template-columns: minmax(280px,.82fr) minmax(420px,1.18fr); }
        .mock-mm-kicker { color: #7ee7f0; font-size: .76rem; font-weight: 800; letter-spacing: .12em; }
        .mock-mm-title { margin: 4px 0 8px; font-size: 2rem; font-weight: 900;
          background: linear-gradient(90deg, #ff9db8, #ffd66f); -webkit-background-clip: text;
          background-clip: text; color: transparent; }
        .mock-mm-desc { margin: 0 0 16px; font-size: .84rem; color: #9fc3e8; line-height: 1.5; }
        .mock-mm-actions { display: grid; gap: 8px; margin-bottom: 16px; }
        .mock-mm-actions button { padding: 10px 14px; border-radius: 8px; text-align: left; font-size: .86rem;
          font-weight: 700; color: #eef9ff; background: rgba(7,27,61,.78);
          border: 1px solid rgba(126,231,240,.28); cursor: pointer; transition: border-color .12s; }
        .mock-mm-actions button:hover { border-color: #7ee7f0; }
        .mock-mm-actions button.primary { background: linear-gradient(90deg, rgba(82,230,255,.3), rgba(82,230,255,.12));
          border-color: #7ee7f0; color: #7ee7f0; }
        .mock-mm-status { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; }
        .mock-mm-statusbox { border-radius: 12px; padding: 10px 12px; background: rgba(5,21,52,.62);
          border: 1px solid rgba(255,255,255,.05); font-size: .78rem; color: #9fc3e8; }
        .mock-mm-statusbox strong { display: block; color: #eef9ff; margin: 4px 0; font-size: .92rem; }
        .mock-mm-statusbox select { width: 100%; margin-top: 4px; padding: 4px 6px; border-radius: 6px;
          background: #0c1e3e; color: #eef9ff; border: 1px solid rgba(126,231,240,.28); }
        .mock-mm-decks { border-radius: 12px; padding: 14px; background: rgba(5,21,52,.62);
          border: 1px solid rgba(255,255,255,.05); display: flex; flex-direction: column; gap: 10px; min-height: 0; }
        .mock-mm-decks-head { display: flex; justify-content: space-between; align-items: center;
          color: #7ee7f0; font-size: .76rem; font-weight: 800; letter-spacing: .12em; }
        .mock-mm-decks-head button { padding: 6px 12px; border-radius: 8px; border: 1px solid rgba(126,231,240,.28);
          background: transparent; color: #7ee7f0; cursor: pointer; }
        .mock-mm-deckcard { position: relative; border-radius: 10px; padding: 10px 12px 10px 18px;
          background: rgba(7,27,61,.78); border: 1px solid rgba(255,255,255,.08); cursor: pointer;
          transition: border-color .12s; }
        .mock-mm-deckcard:hover { border-color: rgba(126,231,240,.5); }
        .mock-mm-deckcard.is-selected { border-color: #7ee7f0; box-shadow: 0 0 14px rgba(82,230,255,.22); }
        .mock-mm-deckbar { position: absolute; left: 0; top: 8px; bottom: 8px; width: 6px; border-radius: 999px; }
        .mock-mm-deckrow { display: flex; justify-content: space-between; align-items: center; }
        .mock-mm-deckrow strong { font-size: .92rem; }
        .mock-mm-tag { border-radius: 999px; padding: 2px 10px; font-size: .68rem; font-weight: 800; }
        .mock-mm-tag.ok { color: #8ef0c8; background: rgba(142,240,200,.14); }
        .mock-mm-tag.warn { color: #ffd66f; background: rgba(255,214,111,.14); }
        .mock-mm-deckmeta { display: flex; gap: 12px; margin-top: 6px; font-size: .72rem; color: #9fc3e8; }
        .mock-mm-deckops { display: flex; gap: 8px; margin-top: 8px; }
        .mock-mm-deckops button { padding: 4px 10px; border-radius: 6px; font-size: .7rem; cursor: pointer;
          background: transparent; color: #9fc3e8; border: 1px solid rgba(126,231,240,.28); }
        .mock-mm-deckops button.danger { color: #ff9db8; border-color: rgba(255,157,184,.4); }
        .mock-mm-footer { font-size: .68rem; color: rgba(210,226,252,.55); text-align: center; margin-top: 10px; }
      `}</style>

      <div className="mock-mm-panel">
        <section>
          <div className="mock-mm-kicker">COOKIERUN BRAVERSE</div>
          <h1 className="mock-mm-title">薑餅人對戰卡牌</h1>
          <p className="mock-mm-desc">選擇一副合法牌組後開始對戰；AI 對手的牌組與等級可在下方指定，或維持隨機。</p>

          <div className="mock-mm-actions">
            <button type="button" className="primary">▶ 對戰入口</button>
            <button type="button">📶 線上對戰</button>
            <button type="button">✏ 牌組編輯器</button>
            <button type="button">🧪 測試對局設定</button>
          </div>

          <div className="mock-mm-status">
            <div className="mock-mm-statusbox">
              目前玩家牌組
              <strong>紫色控制</strong>
              60 / 60 張 ・ FLIP 12 / 16 ・ 餅乾卡 24
            </div>
            <div className="mock-mm-statusbox">
              AI 對手
              <select defaultValue="bs2-red">
                <option value="bs2-red">第二彈紅色牌組</option>
                <option value="random">隨機（五色起始）</option>
              </select>
              <select defaultValue="3">
                <option value="3">Lv.3 評估戰局</option>
                <option value="4">Lv.4 兩層前瞻</option>
              </select>
            </div>
          </div>
        </section>

        <section className="mock-mm-decks">
          <div className="mock-mm-decks-head">
            已儲存牌組
            <button type="button">新增牌組</button>
          </div>
          {DECKS.map((deck, index) => (
            <article key={deck.id} className={`mock-mm-deckcard${index === 0 ? ' is-selected' : ''}`}>
              <span className="mock-mm-deckbar" style={{ background: deck.color }} />
              <div className="mock-mm-deckrow">
                <strong>{deck.name}</strong>
                <span className={`mock-mm-tag ${deck.valid ? 'ok' : 'warn'}`}>
                  {deck.valid ? '合法' : '需調整'}
                </span>
              </div>
              <div className="mock-mm-deckmeta">
                <span>{deck.total} 張</span>
                <span>FLIP {deck.flip}</span>
                <span>餅乾 {deck.cookie}</span>
                <span>{deck.updatedAt}</span>
              </div>
              <div className="mock-mm-deckops">
                <button type="button">編輯</button>
                <button type="button">複製</button>
                <button type="button" className="danger">刪除</button>
              </div>
            </article>
          ))}
        </section>
      </div>

      <footer className="mock-mm-footer">
        本作品為非官方粉絲研究專案，與 Devsisters Corporation 無任何關聯、合作或授權。
        ｜Mockup：wireframe 02 的可渲染版（W5 漸層字標與牌組代表色條已套用）
      </footer>
    </div>
  )
}
