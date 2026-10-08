/// @vitest-environment jsdom
import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it, vi } from 'vitest'
import { createBs12IcePopDemoState } from '../../game/demo'
import { applyGameCommand } from '../../game/commands'
import { RevealTopDeckModal, OptionalCostAttackModal } from './PendingDecisionModals'
import { getOptionalCostAttackPrompt } from './optionalCostAttackPrompt'
import { describeEffect } from '../effects/effectUiUtils'
import { EffectPanel } from '../effects/EffectPanel'

describe.each(['BS12-071', 'BS12-071@1'] as const)('%s public reveal and conditional source cost UI', number => {
  const show = () => {
    const declared = applyGameCommand(createBs12IcePopDemoState('positive', number), { kind: 'begin-activate-skill', playerId: 'player-one', sourceInstanceId: 'bs12-071-source', trigger: 'activate', paymentIds: [] })
    return applyGameCommand(declared, { kind: 'resolve-ability-effect', playerId: 'player-one', targetIds: [] })
  }
  it('revealed bottom offers conditional source payment without claiming a hand return', () => {
    const pending = show().pendingRevealTopDeck!
    const markup = renderToStaticMarkup(<RevealTopDeckModal {...pending} onConfirm={vi.fn()} />)
    expect(markup).toContain('確認後可支付來源餅乾進棄牌區的代價')
    expect(markup).toContain('不支付則保留原狀')
    expect(markup).not.toContain('加入手牌')
    expect(markup).toContain(pending.revealedCard.imageUrl)
  })
  it('names this as a skill play cost rather than an attack Then', () => {
    const confirmed = applyGameCommand(show(), { kind: 'resolve-reveal-top-deck', playerId: 'player-one' })
    const prompt = getOptionalCostAttackPrompt(confirmed, 'player-one')!
    expect(prompt.costText).toBe('將此餅乾送入棄牌區')
    expect(prompt.conditionalSourcePlay).toBe(true)
    expect(prompt.needsTarget).toBe(false)
    const markup = renderToStaticMarkup(<OptionalCostAttackModal {...prompt} onSkip={vi.fn()} onPay={vi.fn()} />)
    expect(markup).toContain('技能登場代價（可選）')
    expect(markup).toContain('Play that Cookie')
    expect(markup).toContain('略過')
    const panel = renderToStaticMarkup(<EffectPanel pendingEffect={null} currentEffect={null} effectHistory={[]}
      onConfirm={vi.fn()} onSkip={vi.fn()} optionalCostAttack={{ ...prompt, onSkip: vi.fn(), onPay: vi.fn() }} />)
    expect(panel).toContain('技能登場代價')
    expect(panel).not.toContain('Then 可選效果')
    if (!prompt.sourceCard) throw new Error('Missing Ice Pop source card')
    expect(panel).toContain(prompt.sourceCard.imageUrl)
  })
  it('describes the exact revealed-card play after source payment', () => {
    expect(describeEffect({ kind: 'play-revealed-bottom-cookie', revealedInstanceId: 'shown' })).toContain('同一張牌庫底餅乾登場')
  })
})
