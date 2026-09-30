import { useId, useState } from 'react'
import { createPortal } from 'react-dom'
import { BookOpen, X } from 'lucide-react'
import { useModalFocus } from '../../hooks/useModalFocus'
import type { TurnPhase } from '../../game'
import './PlayerGuide.css'

const phaseHelp: Record<TurnPhase, string> = {
  active: '系統處理回合開始與活躍狀態；若出現效果選擇，先完成畫面中的決策。',
  draw: '系統處理抽牌；若牌庫需要 Refresh，依畫面指示完成後繼續。',
  support: '選取手牌，再選「支援」。也可以略過支援，進入主要階段。',
  main: '選手牌登場或使用卡牌，或選戰鬥區餅乾攻擊／啟動技能。先完成正在處理的效果，再進行下一個動作。',
  end: '先處理回合結束效果與必要選擇，再交棒給對手。',
}

const lessons = [
  { title: '放置支援', text: '支援區是支付能量的來源。在自己的支援階段，點選手牌，再按「支援」。先想好本回合要用的能量顏色。', action: '收起說明，等到自己的支援階段，試著放置一張支援。' },
  { title: '讓餅乾登場', text: '自己的主要階段可以從手牌讓餅乾登場；一般登場不需支付能量。可否登場仍須符合場上限制；卡牌的登場效果可能另有代價。', action: '點選一張手牌餅乾，查看主要動作及不能登場的原因。' },
  { title: '支付能量與代價', text: '攻擊或技能會列出需要的能量。選擇符合顏色的活躍支援，確認後才正式支付。選取預覽不代表已支付；已支付的代價不能靠關閉說明退回。', action: '打開可用攻擊或技能，依付款畫面選支援；尚未確認時，可使用畫面提供的取消。' },
  { title: '選目標並攻擊', text: '選取戰鬥區餅乾後使用攻擊，依畫面完成支付及合法目標選擇。沒有可用動作時，查看能量、階段或卡牌狀態的提示；不要只憑卡面顏色判斷。', action: '確認目標與支付內容，再送出攻擊。可到對戰紀錄查看實際結果。' },
  { title: '傷害與 FLIP', text: '傷害翻開 HP 卡時，遇到 FLIP 會先詢問是否發動，完成處理後才繼續。不是每次受傷都有 FLIP；依實際卡牌與畫面選擇，不能略過必要的後續決策。', action: '遇到 FLIP 時閱讀來源卡文，再選發動或略過。這是自由練習，沒有遇到時可以繼續下一回合。' },
]

export function PlayerGuide({ onClose, phase }: { onClose: () => void; phase?: TurnPhase }) {
  const [step, setStep] = useState(0)
  const id = useId()
  const ref = useModalFocus(onClose)
  const lesson = lessons[step]
  return createPortal(<div className="modal-backdrop player-guide-backdrop" role="presentation">
    <section ref={ref} className="player-guide" role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}>
      <header><div><span>BRAVERSE / PLAY GUIDE</span><h2 id={id}>新手操作教學</h2></div><button type="button" aria-label="關閉教學" onClick={onClose}><X aria-hidden="true" /></button></header>
      <p className="player-guide-note">隨時可收起、略過或重新閱讀。閱讀進度不代表已完成操作；對局仍依正常規則進行。</p>
      {phase && <p className="player-guide-context">目前階段：{phaseHelp[phase]}</p>}
      <nav aria-label="教學章節">{lessons.map((item, index) => <button key={item.title} type="button" aria-current={step === index ? 'step' : undefined} onClick={() => setStep(index)}>{index + 1}. {item.title}</button>)}</nav>
      <article aria-live="polite"><span>說明 {step + 1} / {lessons.length}</span><h3>{lesson.title}</h3><p>{lesson.text}</p><p className="player-guide-action">試著操作：{lesson.action}</p></article>
      <details><summary>常見卡牌用語</summary><dl><dt>OnPlay／登場</dt><dd>登場時的效果；是否發動與代價依卡文和畫面選擇。</dd><dt>Activate／啟動</dt><dd>在自己的主要階段主動使用，仍須符合條件並支付代價。</dd><dt>Once per turn／每回合一次</dt><dd>同一張場上卡牌實體每回合的使用限制。</dd><dt>Your Turn／你的回合</dt><dd>只在來源玩家自己的回合有效。</dd></dl></details>
      <footer><button type="button" onClick={onClose}>略過／收起教學</button><button type="button" disabled={step === 0} onClick={() => setStep(step - 1)}>上一個說明</button><button type="button" onClick={() => step === lessons.length - 1 ? onClose() : setStep(step + 1)}>{step === lessons.length - 1 ? '回到遊戲練習' : '下一個說明'}</button></footer>
    </section>
  </div>, document.body)
}

export function PlayerGuideButton({ phase }: { phase?: TurnPhase }) {
  const [open, setOpen] = useState(false)
  return <><button type="button" className="player-guide-trigger" onClick={() => setOpen(true)}><BookOpen size={16} aria-hidden="true" />操作教學</button>{open && <PlayerGuide phase={phase} onClose={() => setOpen(false)} />}</>
}
