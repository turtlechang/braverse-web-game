/**
 * 戰場 mockup（docs/ui-reference/01-battlefield-wireframe.md 的可渲染版）。
 * 靜態樣本資料，呈現參考 Master Duel 排版校正後的現行桌機版面：大卡圖預覽為
 * 純 hover 浮窗（不佔用常駐左欄寬度）、支援/戰鬥上下堆疊、休息區與牌庫等
 * 依對手/我方左右鏡射、PhaseRail 縮成貼近中央分隔列的置中小區塊、手牌置中
 * 放大且只露出部分高度、行動按鈕集中右下角。不接規則引擎，僅供 UI 審查。
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

function FieldStack({
  supportCount,
  battle,
  isOpponent,
  onPreview,
}: {
  supportCount: number
  battle: MockCard[]
  isOpponent: boolean
  onPreview: (card: MockCard | null) => void
}) {
  const supportZone = (
    <div className="mock-bf-zone mock-bf-support-zone">
      <span className="mock-bf-zone-label">支援區</span>
      {Array.from({ length: supportCount }).map((_, i) => (
        <div key={i} className={`mock-bf-support${i === 0 ? ' is-rested' : ''}`} />
      ))}
    </div>
  )
  const battleZone = (
    <div className="mock-bf-zone mock-bf-battle-zone">
      {battle.map((card) => (
        <BattleCard key={card.id} card={card} onPreview={onPreview} />
      ))}
    </div>
  )
  return (
    <div className="mock-bf-field-stack">
      {isOpponent ? supportZone : battleZone}
      {isOpponent ? battleZone : supportZone}
    </div>
  )
}

export function BattlefieldMockup() {
  const [preview, setPreview] = useState<MockCard | null>(null)

  return (
    <div className="mock-bf-root">
      <style>{`
        .mock-bf-root { position: fixed; inset: 0; display: grid; grid-template-columns: 1fr;
          background: linear-gradient(135deg, rgba(8,38,89,.96), rgba(22,62,126,.9)), #07162f;
          color: #eef9ff; font-family: system-ui, 'Noto Sans TC', sans-serif; overflow: hidden; }

        .mock-bf-preview-rail { position: absolute; z-index: 28; top: 40px; left: 14px; width: 180px;
          display: grid; justify-items: center; gap: 10px; padding: 16px 10px; border-radius: 12px;
          border: 1px solid rgba(129,224,255,.4);
          background: linear-gradient(160deg, rgba(2,16,45,.94), rgba(2,16,45,.8));
          box-shadow: 0 18px 42px rgba(1,8,28,.42); pointer-events: none; }
        .mock-bf-preview-rail .mock-bf-card { position: static; width: 100%; height: 160px; cursor: default; }
        .mock-bf-preview-name { font-size: .82rem; font-weight: 800; text-align: center; }

        .mock-bf-phase-block { position: absolute; top: 50%; right: 0; transform: translateY(-50%); z-index: 15;
          width: 92px; display: grid; gap: 6px; padding: 8px; border-radius: 12px;
          border: 1px solid rgba(130,194,255,.3); background: linear-gradient(160deg, rgba(3,20,57,.94), rgba(2,12,37,.9));
          box-shadow: 0 18px 40px rgba(1,8,28,.35); }
        .mock-bf-phase-badge { display: grid; gap: 2px; padding: 6px; border-radius: 8px; text-align: center; font-size: .64rem; font-weight: 800; }
        .mock-bf-phase-badge.mine { background: linear-gradient(160deg, rgba(37,99,235,.55), rgba(3,20,53,.5)); border: 1px solid rgba(96,165,250,.7); }
        .mock-bf-phase-badge span { font-size: .56rem; color: rgba(255,255,255,.7); }
        .mock-bf-cta { padding: 8px 6px; border-radius: 10px; border: 2px solid #7ee7f0;
          background: rgba(82,230,255,.16); color: #7ee7f0; font-size: .62rem; font-weight: 800; cursor: pointer; }

        .mock-bf-table { position: relative; display: grid;
          grid-template-rows: 40px 1fr auto 1fr 40px; gap: 4px; padding: 10px 100px 10px 14px; min-height: 0; }

        .mock-bf-row { display: grid; grid-template-columns: 84px 1fr 84px; gap: 8px; min-height: 0; }
        .mock-bf-row.opponent { grid-template-columns: 84px 1fr 84px; }
        .mock-bf-field-stack { min-width: 0; display: grid; grid-template-rows: 1fr 0.82fr; gap: 6px; }
        .mock-bf-row.opponent .mock-bf-field-stack { grid-template-rows: 0.82fr 1fr; }

        .mock-bf-zone { position: relative; display: flex; align-items: center; gap: 10px; padding: 8px 12px; border-radius: 12px;
          background: rgba(7,27,61,.5); border: 1px solid rgba(255,255,255,.05); min-height: 0; }
        .mock-bf-zone-label { position: absolute; top: 6px; left: 10px; font-size: .6rem; letter-spacing: .1em; color: #9fc3e8; }
        .mock-bf-battle-zone { justify-content: center; }

        .mock-bf-rest-zone { display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 2px; }
        .mock-bf-rest-zone strong { font-size: 1rem; color: #fff3a6; }
        .mock-bf-rest-zone span { font-size: .6rem; color: #9fc3e8; }

        .mock-bf-divider { position: relative; display: flex; align-items: center; justify-content: center; padding: 6px;
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

        .mock-bf-utility { display: grid; grid-template-rows: repeat(3, 1fr); gap: 6px; }
        .mock-bf-utility > div { border-radius: 8px; padding: 4px 6px; display: grid; place-content: center;
          background: rgba(3,14,36,.58); border: 1px solid rgba(126,231,240,.28); font-size: .58rem; color: #9fc3e8; text-align: center; }
        .mock-bf-utility strong { display: block; color: #eef9ff; font-size: .74rem; }

        .mock-bf-hand-window { position: relative; overflow: hidden; display: flex; justify-content: center; }
        .mock-bf-hand-window.opponent { height: 34px; }
        .mock-bf-hand-window.player { height: 52px; }
        .mock-bf-hand { display: flex; justify-content: center; }
        .mock-bf-handcard { width: 74px; height: 100px; border-radius: 8px; margin-left: -30px; flex: none;
          border: 1px solid rgba(255,255,255,.2); background: linear-gradient(150deg, #1d3f74, #0c1e3e);
          box-shadow: 0 6px 16px rgba(3,14,36,.5); transition: transform .15s ease-out; }
        .mock-bf-hand-window.player .mock-bf-handcard:hover { transform: translateY(-10px); }
        .mock-bf-handcard.disabledCard { opacity: .45; }

        .mock-bf-action-cluster { position: absolute; right: 6px; bottom: 8px; display: flex; flex-direction: column; gap: 6px; align-items: flex-end; }
        .mock-bf-action-cluster button { padding: 5px 10px; border-radius: 999px; border: 1px solid rgba(129,224,255,.45);
          background: rgba(2,18,49,.78); color: #e8f8ff; font-size: .62rem; font-weight: 700; cursor: pointer; }

        .mock-bf-note { position: absolute; left: 14px; bottom: 8px; font-size: .64rem; color: rgba(210,226,252,.55); }
      `}</style>

      {preview && (
        <aside className="mock-bf-preview-rail">
          <div className="mock-bf-card" style={{ background: `linear-gradient(160deg, ${preview.color}, #10233f 130%)` }}>
            <span className="mock-bf-card-name">{preview.name}</span>
            <span className="mock-bf-card-lv">LV.{preview.level}</span>
            <span className="mock-bf-badges">
              <span className="mock-bf-badge hp">❤{preview.hp}</span>
              <span className="mock-bf-badge atk">⚔{preview.atk}</span>
            </span>
          </div>
          <div className="mock-bf-preview-name">{preview.name}</div>
        </aside>
      )}

      <main className="mock-bf-table">
        <div className="mock-bf-hand-window opponent">
          <div className="mock-bf-hand">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="mock-bf-handcard" style={{ transform: `rotate(${(i - 2) * -7}deg)` }} />
            ))}
          </div>
        </div>

        <div className="mock-bf-row opponent">
          <div className="mock-bf-zone mock-bf-utility">
            <div>牌庫<strong>57</strong></div>
            <div>場景<strong>–</strong></div>
            <div>棄牌<strong>0</strong></div>
          </div>
          <FieldStack supportCount={3} battle={OPPONENT_BATTLE} isOpponent onPreview={setPreview} />
          <div className="mock-bf-zone mock-bf-rest-zone">
            <span>休息</span>
            <strong>×2</strong>
          </div>
        </div>

        <div className="mock-bf-divider">
          選擇攻擊目標——點擊對手戰鬥區的餅乾
          <div className="mock-bf-phase-block">
            <div className="mock-bf-phase-badge mine">
              <span>TURN 3</span>
              <strong>主要階段</strong>
            </div>
            <button className="mock-bf-cta" type="button">結束主要階段</button>
          </div>
        </div>

        <div className="mock-bf-row">
          <div className="mock-bf-zone mock-bf-rest-zone">
            <span>休息</span>
            <strong>×0</strong>
          </div>
          <FieldStack supportCount={4} battle={PLAYER_BATTLE} isOpponent={false} onPreview={setPreview} />
          <div className="mock-bf-zone mock-bf-utility">
            <div>牌庫<strong>31</strong></div>
            <div>場景<strong>1</strong></div>
            <div>棄牌<strong>8</strong></div>
          </div>
        </div>

        <div className="mock-bf-hand-window player">
          <div className="mock-bf-hand">
            {[0, 1, 2, 3, 4, 5].map((i) => (
              <div
                key={i}
                className={`mock-bf-handcard${i === 4 ? ' disabledCard' : ''}`}
                style={{ transform: `rotate(${(i - 2.5) * 7}deg)` }}
              />
            ))}
          </div>
        </div>

        <div className="mock-bf-action-cluster">
          <button type="button">≡ 選單</button>
          <button type="button">戰鬥記錄</button>
        </div>
      </main>

      <div className="mock-bf-note">
        Mockup：靜態樣本資料，僅供 UI 審查（wireframe 01，依實機預覽回饋校正後版面）
      </div>
    </div>
  )
}
