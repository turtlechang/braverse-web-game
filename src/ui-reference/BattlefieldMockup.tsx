/**
 * 戰場 mockup（docs/ui-reference/01-battlefield-wireframe.md 的可渲染版）。
 * 靜態樣本資料，呈現「現行版面 + W1 放大預覽 + W3 甜點質感」的目標樣貌；
 * 不接規則引擎，僅供 UI 審查。dev server 開 /?mockup=battlefield。
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

const PHASES = ['活躍', '抽牌', '支援', '主要', '結束']

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

export function BattlefieldMockup() {
  const [preview, setPreview] = useState<MockCard | null>(null)

  return (
    <div className="mock-bf-root">
      <style>{`
        .mock-bf-root { position: fixed; inset: 0; display: grid; grid-template-columns: 96px 1fr;
          background: linear-gradient(135deg, rgba(8,38,89,.96), rgba(22,62,126,.9)), #07162f;
          color: #eef9ff; font-family: system-ui, 'Noto Sans TC', sans-serif; overflow: hidden; }
        .mock-bf-rail { display: flex; flex-direction: column; gap: 8px; padding: 12px 8px;
          background: rgba(5,21,52,.62); border-right: 1px solid rgba(126,231,240,.28); }
        .mock-bf-phase { padding: 8px 6px; border-radius: 8px; font-size: .72rem; text-align: center;
          color: #9fc3e8; border: 1px solid transparent; }
        .mock-bf-phase.is-current { color: #7ee7f0; border-color: rgba(126,231,240,.6);
          box-shadow: 0 0 14px rgba(82,230,255,.22); font-weight: 800; }
        .mock-bf-cta { margin-top: auto; padding: 10px 6px; border-radius: 8px; border: 1px solid #7ee7f0;
          background: rgba(82,230,255,.16); color: #7ee7f0; font-size: .74rem; font-weight: 800; cursor: pointer; }
        .mock-bf-table { display: grid; grid-template-rows: 1fr 1.22fr auto 1.22fr 1fr; gap: 6px; padding: 10px 14px; min-height: 0; }
        .mock-bf-zone { display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px;
          background: rgba(7,27,61,.5); border: 1px solid rgba(255,255,255,.05); min-height: 0; }
        .mock-bf-zone .zone-label { font-size: .68rem; letter-spacing: .12em; color: #9fc3e8; writing-mode: vertical-rl; }
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
        .mock-bf-support { width: 64px; height: 84%; max-height: 92px; border-radius: 6px; background: #16325c;
          border: 1px solid rgba(126,231,240,.28); margin-left: -26px; }
        .mock-bf-support.is-rested { transform: rotate(90deg) scale(.9); opacity: .8; }
        .mock-bf-pile { margin-left: auto; display: flex; gap: 8px; }
        .mock-bf-pile > div { border-radius: 8px; padding: 6px 10px; background: rgba(3,14,36,.58);
          border: 1px solid rgba(126,231,240,.28); font-size: .7rem; color: #9fc3e8; text-align: center; }
        .mock-bf-pile strong { display: block; color: #eef9ff; font-size: .9rem; }
        .mock-bf-hand { display: flex; justify-content: flex-end; padding-right: 40px; }
        .mock-bf-hand.opponent { justify-content: flex-start; padding-left: 40px; }
        .mock-bf-handcard { width: 74px; height: 100px; border-radius: 8px; margin-left: -30px;
          border: 1px solid rgba(255,255,255,.2); background: linear-gradient(150deg, #1d3f74, #0c1e3e);
          box-shadow: 0 6px 16px rgba(3,14,36,.5); transition: transform .15s ease-out; }
        .mock-bf-hand:not(.opponent) .mock-bf-handcard:hover { transform: translateY(-10px); }
        .mock-bf-handcard.disabledCard { opacity: .45; }
        .mock-bf-preview { position: absolute; right: 16px; top: 50%; transform: translateY(-50%); width: 218px;
          border-radius: 12px; padding: 14px; background: rgba(5,21,52,.94); border: 1px solid rgba(126,231,240,.5);
          box-shadow: 0 12px 32px rgba(3,14,36,.7); z-index: 5; }
        .mock-bf-preview h3 { margin: 0 0 6px; font-size: .95rem; }
        .mock-bf-preview p { margin: 4px 0; font-size: .74rem; color: #9fc3e8; }
        .mock-bf-note { position: absolute; left: 110px; bottom: 8px; font-size: .64rem; color: rgba(210,226,252,.55); }
      `}</style>

      <aside className="mock-bf-rail">
        {PHASES.map((phase, index) => (
          <div key={phase} className={`mock-bf-phase${index === 3 ? ' is-current' : ''}`}>
            {phase}
          </div>
        ))}
        <button type="button" className="mock-bf-cta">結束主要階段</button>
      </aside>

      <main className="mock-bf-table">
        <div className="mock-bf-hand opponent">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="mock-bf-handcard" style={{ transform: `rotate(${(i - 2) * -7}deg)` }} />
          ))}
        </div>

        <div className="mock-bf-zone">
          <span className="zone-label">對手支援</span>
          {[0, 1, 2].map((i) => (
            <div key={i} className={`mock-bf-support${i === 0 ? ' is-rested' : ''}`} />
          ))}
          <div className="mock-bf-pile">
            <div>牌庫<strong>24</strong></div>
            <div>休息<strong>2</strong></div>
          </div>
        </div>

        <div className="mock-bf-zone" style={{ justifyContent: 'center', alignItems: 'flex-end' }}>
          {OPPONENT_BATTLE.map((card) => (
            <BattleCard key={card.id} card={card} onPreview={setPreview} />
          ))}
        </div>

        <div className="mock-bf-divider">選擇攻擊目標——點擊對手戰鬥區的餅乾</div>

        <div className="mock-bf-zone" style={{ justifyContent: 'center', alignItems: 'flex-start' }}>
          {PLAYER_BATTLE.map((card) => (
            <BattleCard key={card.id} card={card} onPreview={setPreview} />
          ))}
          <div className="mock-bf-pile">
            <div>牌庫<strong>31</strong></div>
            <div>棄牌<strong>8</strong></div>
            <div>場景<strong>1</strong></div>
          </div>
        </div>

        <div className="mock-bf-hand">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div
              key={i}
              className={`mock-bf-handcard${i === 4 ? ' disabledCard' : ''}`}
              style={{ transform: `rotate(${(i - 2.5) * 7}deg)` }}
            />
          ))}
        </div>
      </main>

      {preview && (
        <div className="mock-bf-preview">
          <h3>{preview.name}</h3>
          <p>LV.{preview.level} ／ ❤{preview.hp} ／ ⚔{preview.atk}</p>
          <p>【W1 放大預覽】hover 任一可見卡即顯示全文，離開即關閉；不遮擋操作目標。</p>
        </div>
      )}
      <div className="mock-bf-note">
        Mockup：靜態樣本資料，僅供 UI 審查（wireframe 01；W1 hover 預覽、W3 雙層陰影已套用）
      </div>
    </div>
  )
}
