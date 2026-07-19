/**
 * 戰場 mockup（docs/ui-reference/01-battlefield-wireframe.md 的可渲染版）。
 * 靜態樣本資料，呈現 P2-1 戰場線稿圖重新設計四階段 PR 完成後的桌機版面：
 * 左欄卡片預覽、右欄簡化階段列、支援/戰鬥/休息橫向三欄、牌庫等統一右側、
 * 手牌置中、行動按鈕集中右下角。不接規則引擎，僅供 UI 審查。
 * dev server 開 /?mockup=battlefield。
 */
import { useState } from 'react'

interface MockCard {
  id: string
  name: string
  level: number
  hp: number
  atk: number
  color: string
  rested?: boolean
  actionable?: boolean
}

const OPPONENT_BATTLE: MockCard[] = [
  { id: 'o1', name: '莓果騎士餅乾', level: 2, hp: 4, atk: 3, color: '#c94f5f' },
  { id: 'o2', name: '奶油法師餅乾', level: 1, hp: 2, atk: 2, color: '#c9a24f', rested: true },
]

const PLAYER_BATTLE: MockCard[] = [
  { id: 'p1', name: '薄荷勇者餅乾', level: 3, hp: 6, atk: 4, color: '#3f9a6e', actionable: true },
  { id: 'p2', name: '海鹽游俠餅乾', level: 1, hp: 3, atk: 2, color: '#3f6fa8' },
]

function BattleCard({ card, onPreview }: { card: MockCard; onPreview: (card: MockCard | null) => void }) {
  return (
    <div
      className={`mock-bf-card${card.rested ? ' is-rested' : ''}${card.actionable ? ' is-actionable' : ''}`}
      style={{ background: `linear-gradient(160deg, ${card.color}, #10233f 130%)` }}
      onMouseEnter={() => onPreview(card)}
      onMouseLeave={() => onPreview(null)}
    >
      <span className="mock-bf-card-name">{card.name}</span>
      <span className="mock-bf-card-lv">LV.{card.level}</span>
      <span className="mock-bf-badges">
        <span className="mock-bf-badge hp">❤{card.hp}</span>
        <span className="mock-bf-badge atk">⚔{card.atk}</span>
      </span>
    </div>
  )
}

function ZoneRow({
  supportCount,
  restCount,
  battle,
  onPreview,
}: {
  supportCount: number
  restCount: number
  battle: MockCard[]
  onPreview: (card: MockCard | null) => void
}) {
  return (
    <div className="mock-bf-zone-row">
      <div className="mock-bf-zone mock-bf-support-zone">
        <span className="mock-bf-zone-label">支援區</span>
        {Array.from({ length: supportCount }).map((_, i) => (
          <div key={i} className={`mock-bf-support${i === 0 ? ' is-rested' : ''}`} />
        ))}
      </div>
      <div className="mock-bf-zone mock-bf-battle-zone">
        {battle.map((card) => (
          <BattleCard key={card.id} card={card} onPreview={onPreview} />
        ))}
      </div>
      <div className="mock-bf-zone mock-bf-rest-zone">
        <span className="mock-bf-zone-label">休息</span>
        <strong>×{restCount}</strong>
      </div>
    </div>
  )
}

export function BattlefieldMockup() {
  const [preview, setPreview] = useState<MockCard | null>(null)

  return (
    <div className="mock-bf-root">
      <style>{`
        .mock-bf-root { position: fixed; inset: 0; display: grid; grid-template-columns: 180px 1fr 96px;
          background: linear-gradient(135deg, rgba(8,38,89,.96), rgba(22,62,126,.9)), #07162f;
          color: #eef9ff; font-family: system-ui, 'Noto Sans TC', sans-serif; overflow: hidden; }

        .mock-bf-preview-rail { display: grid; align-content: center; justify-items: center; gap: 10px;
          padding: 16px 10px; background: rgba(5,21,52,.62); border-right: 1px solid rgba(126,231,240,.28); }
        .mock-bf-preview-rail .mock-bf-card { position: static; width: 100%; height: 160px; cursor: default; }
        .mock-bf-preview-hint { display: grid; justify-items: center; gap: 6px; padding: 18px 10px;
          border: 1px dashed rgba(126,231,240,.3); border-radius: 8px; text-align: center; }
        .mock-bf-preview-hint small:first-child { font-weight: 800; letter-spacing: .04em; color: rgba(219,239,255,.55); }
        .mock-bf-preview-hint small:last-child { color: rgba(219,239,255,.4); }
        .mock-bf-preview-name { font-size: .82rem; font-weight: 800; text-align: center; }

        .mock-bf-phase-rail { display: flex; flex-direction: column; gap: 10px; padding: 16px 8px 12px; }
        .mock-bf-phase-badge { padding: 9px 6px; border-radius: 10px; text-align: center; font-size: .68rem; font-weight: 800; }
        .mock-bf-phase-badge.mine { background: linear-gradient(160deg, rgba(37,99,235,.55), rgba(3,20,53,.5)); border: 1px solid rgba(96,165,250,.7); }
        .mock-bf-cta { margin-top: auto; padding: 10px 6px; border-radius: 12px; border: 2px solid #7ee7f0;
          background: rgba(82,230,255,.16); color: #7ee7f0; font-size: .68rem; font-weight: 800; cursor: pointer; }
        .mock-bf-turn-counter { text-align: center; font-size: .62rem; color: rgba(255,255,255,.42); font-weight: 800; }

        .mock-bf-table { position: relative; display: grid; grid-template-rows: 1fr 1.15fr auto 1.15fr 1fr; gap: 6px; padding: 10px 14px; min-height: 0; }

        .mock-bf-zone-row { display: grid; grid-template-columns: 0.85fr 1fr 84px; gap: 8px; min-height: 0; }
        .mock-bf-zone { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px;
          background: rgba(7,27,61,.5); border: 1px solid rgba(255,255,255,.05); min-height: 0; }
        .mock-bf-zone-label { position: absolute; top: 6px; left: 10px; font-size: .6rem; letter-spacing: .1em; color: #9fc3e8; }
        .mock-bf-battle-zone { justify-content: center; }
        .mock-bf-rest-zone { flex-direction: column; justify-content: center; align-items: center; gap: 2px; }
        .mock-bf-rest-zone strong { font-size: 1rem; color: #fff3a6; }

        .mock-bf-divider { display: flex; align-items: center; justify-content: center; padding: 6px;
          border-radius: 10px; background: rgba(255,214,111,.14); border: 1px dashed rgba(255,214,111,.5);
          color: #ffd66f; font-size: .82rem; font-weight: 700; }

        .mock-bf-card { position: relative; width: 108px; height: 82%; max-height: 128px; border-radius: 8px; padding: 6px;
          display: flex; flex-direction: column; justify-content: space-between; cursor: pointer;
          border: 1px solid rgba(255,255,255,.18);
          box-shadow: 0 8px 24px rgba(3,14,36,.45), 0 2px 6px rgba(3,14,36,.6); transition: transform .15s ease-out; }
        .mock-bf-card:hover { transform: translateY(-6px) scale(1.02); }
        .mock-bf-card.is-rested { transform: rotate(90deg) scale(.86); opacity: .85; }
        .mock-bf-card.is-actionable { border-color: #7ee7f0; box-shadow: 0 0 16px rgba(82,230,255,.4), 0 8px 24px rgba(3,14,36,.45); }
        .mock-bf-card-name { font-size: .66rem; font-weight: 700; line-height: 1.2; }
        .mock-bf-card-lv { font-size: .6rem; color: rgba(238,249,255,.75); }
        .mock-bf-badges { display: flex; gap: 4px; }
        .mock-bf-badge { border-radius: 999px; padding: 1px 7px; font-size: .66rem; font-weight: 800; background: rgba(3,14,36,.72); }
        .mock-bf-badge.hp { color: #ff9db8; } .mock-bf-badge.atk { color: #ffd66f; }
        .mock-bf-support { width: 56px; height: 84%; max-height: 88px; border-radius: 6px; background: #16325c;
          border: 1px solid rgba(126,231,240,.28); margin-left: -22px; }
        .mock-bf-support.is-rested { transform: rotate(90deg) scale(.9); opacity: .8; }

        .mock-bf-utility { position: absolute; top: 6px; right: 6px; display: flex; gap: 6px; }
        .mock-bf-utility > div { border-radius: 8px; padding: 4px 8px; background: rgba(3,14,36,.58);
          border: 1px solid rgba(126,231,240,.28); font-size: .62rem; color: #9fc3e8; text-align: center; }
        .mock-bf-utility strong { display: block; color: #eef9ff; font-size: .8rem; }

        .mock-bf-hand { display: flex; justify-content: center; }
        .mock-bf-hand.opponent { padding-top: 4px; }
        .mock-bf-handcard { width: 74px; height: 100px; border-radius: 8px; margin-left: -30px;
          border: 1px solid rgba(255,255,255,.2); background: linear-gradient(150deg, #1d3f74, #0c1e3e);
          box-shadow: 0 6px 16px rgba(3,14,36,.5); transition: transform .15s ease-out; }
        .mock-bf-hand:not(.opponent) .mock-bf-handcard:hover { transform: translateY(-10px); }
        .mock-bf-handcard.disabledCard { opacity: .45; }

        .mock-bf-action-cluster { position: absolute; right: 100px; bottom: 10px; display: flex; flex-direction: column; gap: 8px; align-items: flex-end; }
        .mock-bf-action-cluster button { padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(129,224,255,.45);
          background: rgba(2,18,49,.78); color: #e8f8ff; font-size: .68rem; font-weight: 700; cursor: pointer; }

        .mock-bf-note { position: absolute; left: 190px; bottom: 8px; font-size: .64rem; color: rgba(210,226,252,.55); }
      `}</style>

      <aside className="mock-bf-preview-rail">
        {preview ? (
          <>
            <div className="mock-bf-card" style={{ background: `linear-gradient(160deg, ${preview.color}, #10233f 130%)` }}>
              <span className="mock-bf-card-name">{preview.name}</span>
              <span className="mock-bf-card-lv">LV.{preview.level}</span>
              <span className="mock-bf-badges">
                <span className="mock-bf-badge hp">❤{preview.hp}</span>
                <span className="mock-bf-badge atk">⚔{preview.atk}</span>
              </span>
            </div>
            <div className="mock-bf-preview-name">{preview.name}</div>
          </>
        ) : (
          <div className="mock-bf-preview-hint">
            <small>Hover Preview</small>
            <small>滑鼠移到卡牌顯示大圖</small>
          </div>
        )}
      </aside>

      <main className="mock-bf-table">
        <div className="mock-bf-hand opponent">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="mock-bf-handcard" style={{ transform: `rotate(${(i - 2) * -7}deg)` }} />
          ))}
        </div>

        <ZoneRow supportCount={3} restCount={2} battle={OPPONENT_BATTLE} onPreview={setPreview} />

        <div className="mock-bf-divider">選擇攻擊目標——點擊對手戰鬥區的餅乾</div>

        <ZoneRow supportCount={4} restCount={0} battle={PLAYER_BATTLE} onPreview={setPreview} />

        <div className="mock-bf-hand">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`mock-bf-handcard${i === 4 ? ' disabledCard' : ''}`}
              style={{ transform: `rotate(${(i - 2.5) * 7}deg)` }}
            />
          ))}
        </div>

        <div className="mock-bf-utility">
          <div>牌庫<strong>31</strong></div>
          <div>棄牌<strong>8</strong></div>
          <div>場景<strong>1</strong></div>
        </div>

        <div className="mock-bf-action-cluster">
          <button type="button">≡ 選單</button>
          <button type="button">戰鬥記錄</button>
        </div>
      </main>

      <aside className="mock-bf-phase-rail">
        <div className="mock-bf-phase-badge mine">我方 · 主要階段</div>
        <button className="mock-bf-cta" type="button">結束主要階段</button>
        <span className="mock-bf-turn-counter">TURN 3</span>
      </aside>

      <div className="mock-bf-note">
        Mockup：靜態樣本資料，僅供 UI 審查（wireframe 01，P2-1 戰場重新設計四階段完成後版面）
      </div>
    </div>
  )
}
