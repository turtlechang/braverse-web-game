/**
 * 牌組編輯器 mockup（docs/ui-reference/03-deck-editor-wireframe.md 的可渲染版）。
 * 呈現卡池 grid、篩選列、側欄即時合法性與 W1 hover 預覽位置；靜態樣本資料，
 * 僅供 UI 審查。dev server 開 /?mockup=deck-editor。
 */

interface MockPoolCard {
  id: string
  name: string
  color: string
  count: number
  max?: boolean
}

const POOL: MockPoolCard[] = [
  { id: 'ST5-001', name: '黑莓紳士餅乾', color: '#9a6fd0', count: 2 },
  { id: 'ST5-004', name: '洋蔥幽靈餅乾', color: '#9a6fd0', count: 4, max: true },
  { id: 'ST1-003', name: '勇敢餅乾', color: '#c94f5f', count: 0 },
  { id: 'ST3-010', name: '蘆薈餅乾', color: '#3f6fa8', count: 1 },
  { id: 'ST2-004', name: '馬卡龍餅乾', color: '#c9a24f', count: 0 },
  { id: 'ST4-021', name: '鹽晶三叉戟', color: '#3f6fa8', count: 3 },
  { id: 'BS2-061', name: '繡球花餅乾', color: '#9a6fd0', count: 0 },
  { id: 'BS1-006', name: '麻辣醬餅乾', color: '#c94f5f', count: 2 },
]

const ERRORS = ['總張數需為 60（目前 57）']

export function DeckEditorMockup() {
  return (
    <div className="mock-de-root">
      <style>{`
        .mock-de-root { position: fixed; inset: 0; display: grid; grid-template-rows: auto 1fr;
          background: linear-gradient(135deg, rgba(8,38,89,.96), rgba(22,62,126,.9)), #07162f;
          color: #eef9ff; font-family: system-ui, 'Noto Sans TC', sans-serif; overflow: hidden; }
        .mock-de-header { display: flex; align-items: center; gap: 12px; padding: 12px 16px;
          background: rgba(5,21,52,.62); border-bottom: 1px solid rgba(126,231,240,.28); }
        .mock-de-header input { flex: 1; max-width: 280px; padding: 6px 10px; border-radius: 8px;
          background: #0c1e3e; color: #eef9ff; border: 1px solid rgba(126,231,240,.28); font-size: .9rem; }
        .mock-de-header .spacer { flex: 1; }
        .mock-de-btn { padding: 7px 14px; border-radius: 8px; font-size: .78rem; font-weight: 700; cursor: pointer;
          background: transparent; color: #9fc3e8; border: 1px solid rgba(126,231,240,.28); }
        .mock-de-btn.primary { color: #7ee7f0; border-color: #7ee7f0; background: rgba(82,230,255,.14); }
        .mock-de-body { display: grid; grid-template-columns: 1fr 300px; gap: 12px; padding: 12px 16px; min-height: 0; }
        .mock-de-pool { display: flex; flex-direction: column; gap: 10px; min-height: 0; }
        .mock-de-filters { display: flex; gap: 8px; flex-wrap: wrap; }
        .mock-de-filters input, .mock-de-filters select { padding: 6px 8px; border-radius: 8px; font-size: .78rem;
          background: #0c1e3e; color: #eef9ff; border: 1px solid rgba(126,231,240,.28); }
        .mock-de-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 10px;
          overflow: auto; padding-right: 4px; }
        .mock-de-card { position: relative; aspect-ratio: 5/7; border-radius: 8px; padding: 8px; cursor: pointer;
          display: flex; flex-direction: column; justify-content: space-between;
          border: 1px solid rgba(255,255,255,.18);
          box-shadow: 0 8px 24px rgba(3,14,36,.45), 0 2px 6px rgba(3,14,36,.6); transition: transform .12s; }
        .mock-de-card:hover { transform: translateY(-4px); }
        .mock-de-card.is-max { opacity: .45; cursor: not-allowed; }
        .mock-de-card.is-max:hover { transform: none; }
        .mock-de-card .name { font-size: .72rem; font-weight: 700; line-height: 1.25; }
        .mock-de-card .cardno { font-size: .62rem; color: rgba(238,249,255,.7); }
        .mock-de-info { position: absolute; top: 6px; right: 6px; width: 20px; height: 20px; border-radius: 999px;
          border: 1px solid rgba(238,249,255,.5); background: rgba(3,14,36,.6); color: #eef9ff;
          font-size: .64rem; display: grid; place-items: center; }
        .mock-de-count { position: absolute; bottom: 6px; right: 6px; border-radius: 999px; padding: 1px 8px;
          background: #7ee7f0; color: #07162f; font-size: .7rem; font-weight: 900; }
        .mock-de-side { border-radius: 12px; padding: 14px; background: rgba(5,21,52,.62);
          border: 1px solid rgba(255,255,255,.05); display: flex; flex-direction: column; gap: 10px;
          font-size: .8rem; min-height: 0; }
        .mock-de-stats { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; }
        .mock-de-stat { border-radius: 8px; padding: 8px; background: rgba(7,27,61,.78); color: #9fc3e8; }
        .mock-de-stat strong { display: block; font-size: 1.05rem; color: #eef9ff; }
        .mock-de-stat.warn strong { color: #ffd66f; }
        .mock-de-errors { border-radius: 8px; padding: 8px 10px; background: rgba(255,139,116,.12);
          border: 1px solid rgba(255,139,116,.42); color: #ffd4ca; font-size: .74rem; }
        .mock-de-list { overflow: auto; display: flex; flex-direction: column; gap: 6px; }
        .mock-de-entry { display: flex; justify-content: space-between; align-items: center; border-radius: 8px;
          padding: 6px 8px; background: rgba(7,27,61,.78); font-size: .74rem; }
        .mock-de-entry button { border-radius: 6px; border: 1px solid rgba(126,231,240,.28); background: transparent;
          color: #9fc3e8; cursor: pointer; padding: 1px 8px; }
        .mock-de-note { font-size: .64rem; color: rgba(210,226,252,.55); }
      `}</style>

      <header className="mock-de-header">
        <button type="button" className="mock-de-btn">← 返回</button>
        <input defaultValue="實驗中：藍綠混" aria-label="牌組名稱" />
        <span className="spacer" />
        <button type="button" className="mock-de-btn">匯入 JSON</button>
        <button type="button" className="mock-de-btn">匯出 JSON</button>
        <button type="button" className="mock-de-btn primary">儲存牌組</button>
      </header>

      <div className="mock-de-body">
        <section className="mock-de-pool">
          <div className="mock-de-filters">
            <input placeholder="搜尋卡名或卡號…" aria-label="搜尋" />
            <select defaultValue="all"><option value="all">顏色：全部</option></select>
            <select defaultValue="all"><option value="all">類型：全部</option></select>
            <select defaultValue="all"><option value="all">費用：全部</option></select>
            <select defaultValue="all"><option value="all">稀有度：全部</option></select>
          </div>
          <div className="mock-de-grid">
            {POOL.map((card) => (
              <div
                key={card.id}
                className={`mock-de-card${card.max ? ' is-max' : ''}`}
                style={{ background: `linear-gradient(165deg, ${card.color}, #10233f 135%)` }}
              >
                <span className="name">{card.name}</span>
                <span className="cardno">{card.id}</span>
                <span className="mock-de-info">i</span>
                {card.count > 0 && <span className="mock-de-count">{card.count}</span>}
              </div>
            ))}
          </div>
        </section>

        <aside className="mock-de-side">
          <div className="mock-de-stats">
            <div className="mock-de-stat warn">總張數<strong>57 / 60</strong></div>
            <div className="mock-de-stat">FLIP<strong>14 / 16</strong></div>
            <div className="mock-de-stat">餅乾卡<strong>22 ✓</strong></div>
            <div className="mock-de-stat">同卡上限<strong>≤ 4 ✓</strong></div>
          </div>
          <div className="mock-de-errors">
            {ERRORS.map((error) => (
              <div key={error}>・{error}</div>
            ))}
          </div>
          <div className="mock-de-list">
            {POOL.filter((card) => card.count > 0).map((card) => (
              <div key={card.id} className="mock-de-entry">
                <span>{card.count}×{card.id} {card.name}</span>
                <button type="button">－</button>
              </div>
            ))}
          </div>
          <div className="mock-de-note">
            Mockup：wireframe 03 可渲染版；單擊加卡、達 4 張禁用樣式、側欄即時合法性為現行行為的規格化。
          </div>
        </aside>
      </div>
    </div>
  )
}
