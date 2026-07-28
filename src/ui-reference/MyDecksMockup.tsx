/**
 * 「我的牌組」獨立畫面 mockup（Master Duel DECK 畫面的 Braverse 版）。
 * dev server 開 /?mockup=my-decks
 *
 * 由來：使用者提供 Master Duel「我的牌組」實機截圖後發現，MD 的牌組管理既不在主畫面、
 * 也不在牌組編輯器內，而是第三個獨立畫面。本檔把該畫面對應到 Braverse 實際有的功能，
 * 供與「複製／刪除放進牌組編輯器」的做法（/?mockup=main-menu-md）二選一。
 *
 * 對應關係（左為 Master Duel，右為本專案實際可接的功能）：
 *   牌盒立體盒繪磚   → 牌組代表卡的卡圖（無盒繪素材，D-012 限制新增公開素材）
 *   STANDARD 徽章    → 合法／需調整（validateCustomDeck 既有結果）
 *   3/25 牌組上限     → 僅顯示副數，本專案無上限
 *   垃圾桶＋勾 批次刪除 → 同左，進入後可勾選多副一次刪除
 *   公開牌組搜尋      → 匯入牌組（custom-deck.ts:251 importDeck）
 *   預組套牌清單      → 官方起始牌組（starter-deck.ts:270 OFFICIAL_DECK_RECIPES，共 10 套）
 *   NEURON 外部連結   → 無對應，省略
 * 靜態樣本資料，僅供 UI 審查。
 */
import { useState } from 'react'

interface MockDeck {
  id: string
  name: string
  total: number
  valid: boolean
  heroCard: string
}

const DECKS: MockDeck[] = [
  { id: 'd1', name: '紫色控制', total: 60, valid: true, heroCard: 'https://cookierunbraverse.com/data/en_storage/ebU68c8QqSAV5JnwQVopEQ.webp' },
  { id: 'd2', name: '紅色快攻', total: 60, valid: true, heroCard: 'https://cookierunbraverse.com/data/en_storage/HaWkaxv1TnJ3A-SMA5jN8w.webp' },
  { id: 'd3', name: '實驗中：藍綠混', total: 57, valid: false, heroCard: 'https://cookierunbraverse.com/data/en_storage/5kaPkgRaxJDsWQIQ3pGwAQ.webp' },
  { id: 'd4', name: '黃色資源', total: 60, valid: true, heroCard: 'https://cookierunbraverse.com/data/en_storage/OobUcWDexyPKEspKHcBNmA.webp' },
  { id: 'd5', name: '第二彈藍色', total: 60, valid: true, heroCard: 'https://cookierunbraverse.com/data/en_storage/6mOixxZzqatRDXctoNqI6A.webp' },
]

export function MyDecksMockup() {
  const [decks, setDecks] = useState<MockDeck[]>(DECKS)
  const [selectedId, setSelectedId] = useState('d1')
  const [bulkMode, setBulkMode] = useState(false)
  const [checked, setChecked] = useState<string[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [copySeq, setCopySeq] = useState(1)
  const selectedDeck = decks.find((d) => d.id === selectedId) ?? null

  const toggleCheck = (id: string) =>
    setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]))

  const exitBulk = () => {
    setBulkMode(false)
    setChecked([])
  }

  const duplicate = (src: MockDeck) => {
    setCopySeq((seq) => seq + 1)
    const copy: MockDeck = {
      ...src,
      id: `${src.id}-copy-${copySeq}`,
      name: `${src.name}（複本）`,
    }
    const at = decks.findIndex((d) => d.id === src.id)
    const next = [...decks]
    next.splice(at + 1, 0, copy)
    setDecks(next)
    setNotice(`已複製「${src.name}」。`)
  }

  const deleteChecked = () => {
    const removed = decks.filter((d) => checked.includes(d.id))
    const next = decks.filter((d) => !checked.includes(d.id))
    setDecks(next)
    // 若刪掉的包含目前選定牌組，接手第一副；一副不剩則清空選定
    if (checked.includes(selectedId)) {
      setSelectedId(next[0]?.id ?? '')
      setNotice(
        next.length > 0
          ? `已刪除 ${removed.length} 副牌組，目前牌組自動切換為「${next[0].name}」。`
          : `已刪除 ${removed.length} 副牌組。已無自訂牌組。`,
      )
    } else {
      setNotice(`已刪除 ${removed.length} 副牌組。`)
    }
    exitBulk()
  }

  return (
    <div className="mock-dk-shell">
      <style>{`
        .mock-dk-shell { position: fixed; inset: 0; overflow: hidden;
          display: grid; grid-template-rows: auto minmax(0,1fr) auto;
          color: #eef9ff; font-family: system-ui, 'Noto Sans TC', sans-serif;
          background: #070818; }
        /* MD 的斜切導光背景 */
        .mock-dk-shell::before { content: ''; position: absolute; inset: 0; z-index: 0;
          background:
            linear-gradient(103deg, transparent 0 34%, rgba(122,150,255,.07) 34% 46%, transparent 46%),
            linear-gradient(103deg, transparent 0 58%, rgba(96,120,220,.05) 58% 72%, transparent 72%),
            radial-gradient(ellipse at 72% 74%, rgba(88,58,168,.34) 0%, transparent 58%),
            linear-gradient(160deg, #0a1030 0%, #0b0f2a 46%, #10082a 100%); }

        /* ── 頂列 ── */
        .mock-dk-top { position: relative; z-index: 2; display: flex; align-items: center;
          gap: 16px; padding: 14px 22px; }
        .mock-dk-back { display: grid; place-items: center; width: 42px; height: 42px; flex: none;
          border-radius: 999px; background: rgba(6,12,32,.9); border: 2px solid #a8e832;
          color: #a8e832; font-size: 1.2rem; cursor: pointer; text-decoration: none; }
        .mock-dk-back:hover { background: rgba(168,232,50,.16); }
        .mock-dk-title { margin: 0; font-size: 1.35rem; font-weight: 800; letter-spacing: .04em; }
        .mock-dk-count { margin-left: auto; display: flex; align-items: baseline; gap: 6px;
          font-size: 1.05rem; font-weight: 800; font-variant-numeric: tabular-nums; }
        .mock-dk-count small { font-size: .68rem; font-weight: 600; color: rgba(159,195,232,.7);
          letter-spacing: .1em; }
        .mock-dk-topbtn { display: grid; place-items: center; min-width: 62px; height: 40px;
          padding: 0 14px; border-radius: 5px; cursor: pointer; font-size: 1rem;
          background: rgba(8,16,40,.92); border: 1px solid rgba(150,180,255,.3); color: #cfe2ff; }
        .mock-dk-topbtn:hover { border-color: #7ee7f0; color: #7ee7f0; }
        .mock-dk-topbtn.on { background: rgba(226,69,92,.22); border-color: #ff9db8; color: #ff9db8; }

        /* ── 牌組磚格 ── */
        .mock-dk-grid { position: relative; z-index: 2; overflow: auto; padding: 4px 22px 16px;
          display: grid; gap: 14px; align-content: start;
          grid-template-columns: repeat(auto-fill, minmax(186px, 1fr)); }

        .mock-dk-tile { position: relative; display: grid; grid-template-rows: 1fr auto;
          aspect-ratio: 186 / 186; border-radius: 6px; cursor: pointer; overflow: hidden;
          background: rgba(6,10,28,.86); border: 1px solid rgba(150,180,255,.22);
          transition: border-color .12s, transform .12s; }
        .mock-dk-tile:hover { border-color: rgba(126,231,240,.65); transform: translateY(-2px); }
        .mock-dk-tile.is-selected { border-color: #a8e832;
          box-shadow: 0 0 0 1px #a8e832, 0 0 22px rgba(168,232,50,.24); }
        .mock-dk-tile.is-checked { border-color: #ff9db8; box-shadow: 0 0 0 1px #ff9db8; }

        /* 磚面＝牌組代表卡的卡圖（取代 MD 的牌盒盒繪）。
           卡圖是直式（約 5:7），磚面區塊偏矮。.mock-dk-face 的高度來自巢狀 grid 軌道，
           img 若用 max-height:% 無法正確解析容器高度（會回退成原圖尺寸再被裁切）。
           改用絕對定位＋inset 明確畫出一個有實際尺寸的框，讓 object-fit: contain
           在框內等比例縮放，完整顯示卡圖、不裁切、不變形。 */
        .mock-dk-face { position: relative; overflow: hidden;
          background: radial-gradient(ellipse at 50% 40%, rgba(60,90,180,.34), rgba(4,8,22,.9)); }
        .mock-dk-face img { position: absolute; inset: 6%; width: 100%; height: 100%;
          object-fit: contain; border-radius: 4px;
          filter: drop-shadow(0 8px 16px rgba(0,0,0,.55)); }
        .mock-dk-tag { position: absolute; top: 7px; right: 7px; padding: 2px 8px;
          border-radius: 999px; font-size: .6rem; font-weight: 800; letter-spacing: .05em; }
        .mock-dk-tag.ok { color: #bfe9ff; background: rgba(10,30,70,.9);
          border: 1px solid rgba(126,231,240,.55); }
        .mock-dk-tag.warn { color: #ffd66f; background: rgba(60,40,6,.9);
          border: 1px solid rgba(255,214,111,.6); }
        .mock-dk-current { position: absolute; top: 7px; left: 7px; padding: 2px 8px;
          border-radius: 999px; font-size: .6rem; font-weight: 800;
          color: #0a1020; background: #a8e832; }
        .mock-dk-name { padding: 8px 10px; font-size: .84rem; font-weight: 700; text-align: center;
          white-space: nowrap; overflow: hidden; text-overflow: ellipsis;
          background: rgba(4,8,22,.75); }
        .mock-dk-sub { display: block; margin-top: 2px; font-size: .64rem; font-weight: 500;
          color: rgba(159,195,232,.72); }

        /* 單副操作：hover 才浮出，刪除刻意不在此（只走批次模式，增加不可逆操作的摩擦） */
        .mock-dk-ops { position: absolute; left: 0; right: 0; bottom: 0; z-index: 4;
          display: flex; gap: 6px; padding: 8px; opacity: 0; translate: 0 6px;
          background: linear-gradient(0deg, rgba(3,6,18,.96), rgba(3,6,18,.72) 60%, transparent);
          transition: opacity .14s, translate .14s; }
        .mock-dk-tile:hover .mock-dk-ops,
        .mock-dk-tile:focus-within .mock-dk-ops { opacity: 1; translate: 0 0; }
        .mock-dk-ops button { flex: 1; padding: 5px 0; border-radius: 4px; cursor: pointer;
          font-size: .7rem; font-weight: 700; color: #cfe2ff;
          background: rgba(10,20,48,.94); border: 1px solid rgba(150,180,255,.34); }
        .mock-dk-ops button:hover { color: #7ee7f0; border-color: #7ee7f0; }

        /* 勾選框（批次刪除模式） */
        .mock-dk-check { position: absolute; inset: 0; z-index: 3; display: grid;
          place-items: start end; padding: 8px; background: rgba(4,8,22,.34); }
        .mock-dk-check span { display: grid; place-items: center; width: 26px; height: 26px;
          border-radius: 4px; background: rgba(4,10,26,.92); border: 2px solid rgba(255,255,255,.4);
          font-size: .9rem; color: transparent; }
        .mock-dk-tile.is-checked .mock-dk-check span { background: #e2455c; border-color: #ff9db8; color: #fff; }

        /* 新增磚 */
        .mock-dk-add { display: grid; place-items: center; aspect-ratio: 186 / 186;
          border-radius: 6px; cursor: pointer; background: rgba(6,10,28,.7);
          border: 1px solid rgba(168,232,50,.42); transition: background .12s; }
        .mock-dk-add:hover { background: rgba(168,232,50,.1); }
        .mock-dk-add span { display: grid; place-items: center; width: 72px; height: 72px;
          border-radius: 999px; border: 3px solid #a8e832; color: #a8e832;
          font-size: 2.4rem; line-height: 1; padding-bottom: 6px; }

        .mock-dk-empty { grid-column: 1 / -1; padding: 40px; text-align: center;
          font-size: .84rem; color: rgba(159,195,232,.65); line-height: 1.8;
          border: 1px dashed rgba(126,231,240,.24); border-radius: 6px; }

        /* ── 底列 ── */
        .mock-dk-bottom { position: relative; z-index: 2; display: flex; justify-content: flex-end;
          align-items: center; gap: 12px; padding: 12px 22px 16px; flex-wrap: wrap; }
        .mock-dk-bigbtn { position: relative; min-width: 208px; padding: 12px 22px 12px 26px;
          border-radius: 4px; cursor: pointer; font-size: .88rem; font-weight: 800;
          background: rgba(8,16,40,.94); border: 1px solid rgba(150,180,255,.3); color: #eef9ff; }
        .mock-dk-bigbtn::before { content: ''; position: absolute; left: 10px; top: 50%;
          transform: translateY(-50%) skewX(-14deg); width: 4px; height: 46%; background: #a8e832; }
        .mock-dk-bigbtn:hover:not(:disabled) { border-color: #a8e832; }
        .mock-dk-bigbtn:disabled { opacity: .4; cursor: not-allowed; }
        .mock-dk-danger { min-width: 208px; padding: 12px 22px; border-radius: 4px; cursor: pointer;
          font-size: .88rem; font-weight: 800; color: #fff;
          background: rgba(226,69,92,.34); border: 1px solid #ff9db8; }
        .mock-dk-danger:disabled { opacity: .4; cursor: not-allowed; }
        .mock-dk-hint { margin-right: auto; font-size: .74rem; color: rgba(159,195,232,.72); }

        .mock-dk-notice { position: fixed; left: 50%; bottom: 84px; transform: translateX(-50%);
          z-index: 18; display: flex; align-items: center; gap: 12px;
          max-width: min(560px, calc(100vw - 32px)); padding: 10px 12px 10px 16px;
          border-radius: 4px; background: rgba(9,20,48,.97);
          border: 1px solid rgba(126,231,240,.4); border-left: 3px solid #7ee7f0;
          box-shadow: 0 14px 40px rgba(0,0,0,.55); font-size: .8rem; line-height: 1.5; }
        .mock-dk-notice button { flex: none; width: 22px; height: 22px; border-radius: 3px;
          background: transparent; color: #9fc3e8; border: 1px solid rgba(255,255,255,.14);
          cursor: pointer; font-size: .7rem; }

        .mock-dk-foot { position: relative; z-index: 2; padding: 0 22px 10px;
          font-size: .62rem; color: rgba(210,226,252,.4); line-height: 1.5; }

        @media (max-width: 680px) {
          .mock-dk-grid { grid-template-columns: repeat(auto-fill, minmax(140px, 1fr)); padding: 4px 14px 12px; }
          .mock-dk-top { padding: 12px 14px; gap: 10px; }
          .mock-dk-bottom { padding: 10px 14px 14px; }
          .mock-dk-bigbtn, .mock-dk-danger { min-width: 0; flex: 1; }
        }
      `}</style>

      {/* ── 頂列 ── */}
      <div className="mock-dk-top">
        <a className="mock-dk-back" aria-label="返回主選單" href="/?mockup=main-menu-md">‹</a>
        <h1 className="mock-dk-title">我的牌組</h1>

        <div className="mock-dk-count">
          {decks.length}
          <small>副牌組</small>
        </div>
        <button
          type="button"
          className={`mock-dk-topbtn${bulkMode ? ' on' : ''}`}
          aria-label={bulkMode ? '離開批次刪除' : '批次刪除'}
          title={bulkMode ? '離開批次刪除' : '批次刪除'}
          onClick={() => (bulkMode ? exitBulk() : setBulkMode(true))}
        >
          {bulkMode ? '✕' : '🗑'}
        </button>
      </div>

      {/* ── 牌組磚格 ── */}
      <div className="mock-dk-grid">
        {!bulkMode && (
          <button
            type="button"
            className="mock-dk-add"
            aria-label="新增牌組"
            onClick={() => setNotice('開啟牌組編輯器建立新牌組')}
          >
            <span>＋</span>
          </button>
        )}

        {decks.map((d) => {
          const isChecked = checked.includes(d.id)
          return (
            <div
              key={d.id}
              className={[
                'mock-dk-tile',
                !bulkMode && d.id === selectedId ? 'is-selected' : '',
                isChecked ? 'is-checked' : '',
              ].filter(Boolean).join(' ')}
              role="button"
              tabIndex={0}
              onClick={() => (bulkMode ? toggleCheck(d.id) : setSelectedId(d.id))}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  if (bulkMode) {
                    toggleCheck(d.id)
                  } else {
                    setSelectedId(d.id)
                  }
                }
              }}
            >
              <div className="mock-dk-face">
                <img src={d.heroCard} alt="" />
                {!bulkMode && d.id === selectedId && (
                  <span className="mock-dk-current">目前牌組</span>
                )}
                <span className={`mock-dk-tag ${d.valid ? 'ok' : 'warn'}`}>
                  {d.valid ? '合法' : '需調整'}
                </span>
              </div>
              <div className="mock-dk-name">
                {d.name}
                <span className="mock-dk-sub">{d.total} / 60 張</span>
              </div>
              {!bulkMode && (
                <div className="mock-dk-ops">
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); setNotice(`開啟牌組編輯器：「${d.name}」`) }}
                  >
                    編輯
                  </button>
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); duplicate(d) }}
                  >
                    複製
                  </button>
                </div>
              )}
              {bulkMode && (
                <div className="mock-dk-check">
                  <span aria-hidden="true">✓</span>
                </div>
              )}
            </div>
          )
        })}

        {decks.length === 0 && (
          <div className="mock-dk-empty">
            尚未有自訂牌組。
            <br />
            按左上「＋」建立第一副，或從下方載入官方起始牌組。
          </div>
        )}
      </div>

      {notice && (
        <div className="mock-dk-notice" role="status">
          {notice}
          <button type="button" aria-label="關閉提示" onClick={() => setNotice(null)}>✕</button>
        </div>
      )}

      {/* ── 底列：對應 MD 的「公開牌組搜尋／預組套牌清單」 ── */}
      <div className="mock-dk-bottom">
        {bulkMode ? (
          <>
            <span className="mock-dk-hint">
              已選擇 {checked.length} 副。刪除後無法復原。
            </span>
            <button type="button" className="mock-dk-bigbtn" onClick={exitBulk}>
              取消
            </button>
            <button
              type="button"
              className="mock-dk-danger"
              disabled={checked.length === 0}
              onClick={deleteChecked}
            >
              刪除所選 {checked.length > 0 && `(${checked.length})`}
            </button>
          </>
        ) : (
          <>
            <span className="mock-dk-hint">
              點磚＝設為目前牌組；滑過磚面可編輯／複製
            </span>
            <button
              type="button"
              className="mock-dk-bigbtn"
              disabled={!selectedDeck}
              onClick={() =>
                selectedDeck &&
                setNotice(`已匯出「${selectedDeck.name}」（對應 custom-deck.ts:240 exportDeck，複製 JSON 到剪貼簿）`)
              }
            >
              匯出牌組
            </button>
            <button
              type="button"
              className="mock-dk-bigbtn"
              onClick={() => setNotice('開啟匯入牌組對話框（對應 custom-deck.ts:251 importDeck）')}
            >
              匯入牌組
            </button>
            <button
              type="button"
              className="mock-dk-bigbtn"
              onClick={() => setNotice('開啟官方起始牌組清單（對應 OFFICIAL_DECK_RECIPES 10 套配方）')}
            >
              官方起始牌組
            </button>
          </>
        )}
      </div>

      <p className="mock-dk-foot">
        本作品為非官方粉絲研究專案，與 Devsisters Corporation 無任何關聯、合作或授權。
        ｜Mockup：「我的牌組」獨立畫面（Master Duel DECK 畫面的 Braverse 版）。
        磚面用牌組代表卡卡圖取代盒繪；「匯入牌組」對應 importDeck、「官方起始牌組」對應
        OFFICIAL_DECK_RECIPES 的 10 套配方；本專案無牌組數量上限，故不顯示 n/25。
      </p>
    </div>
  )
}
