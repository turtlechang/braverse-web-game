import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { GameCard } from '../../game'
import { CardFace } from '../cards/CardVisuals'
import './PendingDecisionModals.css'

export interface DrawUpToSelectorProps {
  max: number
  deckSize: number
  onConfirm: (drawCount: number) => void
}

export function DrawUpToSelector({
  max,
  deckSize,
  onConfirm,
}: DrawUpToSelectorProps) {
  const [drawCount, setDrawCount] = useState(0)
  const effectiveMax = Math.min(max, deckSize)

  return (
    <div className="draw-up-to-selector">
      <div className="draw-up-to-options">
        {Array.from({ length: effectiveMax + 1 }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`draw-up-to-option ${drawCount === i ? 'is-selected' : ''}`}
            onClick={() => setDrawCount(i)}
          >
            <span className="draw-up-to-option-label">
              {i === 0 ? '不抽' : `抽 ${i} 張`}
            </span>
            {i > 0 && (
              <span className="draw-up-to-option-hint">
                從牌庫頂抽取
              </span>
            )}
          </button>
        ))}
      </div>
      <div className="faint-modal-actions">
        <button
          type="button"
          className="modal-button primary"
          onClick={() => onConfirm(drawCount)}
        >
          {drawCount === 0 ? '略過抽牌' : `抽取 ${drawCount} 張牌`}
        </button>
      </div>
    </div>
  )
}

export interface OptionalCostAttackModalProps {
  sourceCardName: string
  effectText: string
  discardHandCost: number
  playerHand: GameCard[]
  opponentBattleCards: { card: GameCard; instanceId: string }[]
  onSkip: () => void
  onPay: (discardIds: string[], targetId: string) => void
}

type AttackPayStep = 'decision' | 'pay'

export function OptionalCostAttackModal({
  sourceCardName,
  effectText,
  discardHandCost,
  playerHand,
  opponentBattleCards,
  onSkip,
  onPay,
}: OptionalCostAttackModalProps) {
  const [step, setStep] = useState<AttackPayStep>('decision')
  const [selectedDiscardIds, setSelectedDiscardIds] = useState<string[]>([])
  const [selectedTargetId, setSelectedTargetId] = useState<string | null>(null)

  const canPay =
    playerHand.length >= discardHandCost &&
    opponentBattleCards.length >= 1

  const toggleDiscard = useCallback((instanceId: string) => {
    setSelectedDiscardIds((current) =>
      current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : current.length < discardHandCost
          ? [...current, instanceId]
          : current,
    )
  }, [discardHandCost])

  const toggleTarget = useCallback((instanceId: string) => {
    setSelectedTargetId((current) =>
      current === instanceId ? null : instanceId,
    )
  }, [])

  const handlePay = useCallback(() => {
    if (selectedDiscardIds.length !== discardHandCost || !selectedTargetId) return
    onPay(selectedDiscardIds, selectedTargetId)
  }, [selectedDiscardIds, selectedTargetId, discardHandCost, onPay])

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal optional-cost-attack-modal"
        role="alertdialog"
      >
        <span>攻擊可選效果</span>
        <h2>{sourceCardName}</h2>
        <p className="optional-cost-attack-text">{effectText}</p>
        <p className="optional-cost-attack-cost">
          代價：棄置 {discardHandCost} 張手牌
        </p>

        {step === 'decision' && (
          <div className="modal-actions">
            <button type="button" onClick={onSkip}>
              略過
            </button>
            <button
              type="button"
              disabled={!canPay}
              onClick={() => setStep('pay')}
            >
              支付
            </button>
          </div>
        )}

        {step === 'pay' && (
          <>
            <strong>
              選擇 {discardHandCost} 張手牌棄置
            </strong>
            <div className="modal-card-options">
              {playerHand.map((card) => (
                <button
                  type="button"
                  key={card.instanceId}
                  className={
                    selectedDiscardIds.includes(card.instanceId)
                      ? 'is-selected'
                      : ''
                  }
                  onClick={() => toggleDiscard(card.instanceId)}
                >
                  <CardFace card={card} />
                  <span>{card.name}</span>
                </button>
              ))}
            </div>

            <strong>選擇 1 個對手餅乾作為目標</strong>
            <div className="modal-card-options">
              {opponentBattleCards.map((entry) => (
                <button
                  type="button"
                  key={entry.instanceId}
                  className={
                    selectedTargetId === entry.instanceId
                      ? 'is-selected'
                      : ''
                  }
                  onClick={() => toggleTarget(entry.instanceId)}
                >
                  <CardFace card={entry.card} />
                  <span>{entry.card.name}</span>
                </button>
              ))}
            </div>

            <div className="modal-actions">
              <button
                type="button"
                onClick={() => {
                  setSelectedDiscardIds([])
                  setSelectedTargetId(null)
                  setStep('decision')
                }}
              >
                返回
              </button>
              <button
                type="button"
                disabled={
                  selectedDiscardIds.length !== discardHandCost ||
                  !selectedTargetId
                }
                onClick={handlePay}
              >
                確認
              </button>
            </div>
          </>
        )}
      </section>
    </div>
  )
}

export interface InspectDeckModalProps {
  sourceCardName: string
  revealedCards: GameCard[]
  pickCount: number
  onConfirm: (pickedId: string, restOrder: string[]) => void
}

export function InspectDeckModal({
  sourceCardName,
  revealedCards,
  pickCount,
  onConfirm,
}: InspectDeckModalProps) {
  const [pickedId, setPickedId] = useState<string | null>(null)
  const [restOrder, setRestOrder] = useState<string[]>(
    () => revealedCards.map((c) => c.instanceId),
  )

  const handlePick = (instanceId: string) => {
    if (pickedId === instanceId) {
      setPickedId(null)
      setRestOrder(revealedCards.map((c) => c.instanceId))
      return
    }
    setRestOrder(
      revealedCards.map((c) => c.instanceId).filter((id) => id !== instanceId),
    )
    setPickedId(instanceId)
  }

  const nonPickedOrder = restOrder.filter((id) => id !== pickedId)

  const moveUp = (index: number) => {
    if (index <= 0 || !pickedId) return
    const fullOrder = [...nonPickedOrder]
    ;[fullOrder[index - 1], fullOrder[index]] =
      [fullOrder[index], fullOrder[index - 1]]
    setRestOrder([pickedId, ...fullOrder])
  }

  const moveDown = (index: number) => {
    if (index >= nonPickedOrder.length - 1 || !pickedId) return
    const fullOrder = [...nonPickedOrder]
    ;[fullOrder[index], fullOrder[index + 1]] =
      [fullOrder[index + 1], fullOrder[index]]
    setRestOrder([pickedId, ...fullOrder])
  }

  const handleConfirm = () => {
    if (!pickedId) return
    const finalRest = restOrder.filter((id) => id !== pickedId)
    onConfirm(pickedId, finalRest)
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal inspect-deck-modal"
        role="alertdialog"
      >
        <span>牌庫檢視</span>
        <h2>{sourceCardName}</h2>
        <p>
          查看 {revealedCards.length} 張牌，選擇 {pickCount} 張加入手牌，其餘以指定順序放回牌庫底。
        </p>
        <div className="inspect-deck-grid">
          {revealedCards.map((card) => (
            <button
              type="button"
              key={card.instanceId}
              className={
                pickedId === card.instanceId ? 'is-selected' : ''
              }
              onClick={() => handlePick(card.instanceId)}
              aria-label={`選擇${card.name}`}
            >
              <CardFace card={card} />
              <span>{card.name}</span>
            </button>
          ))}
        </div>
        {pickedId && nonPickedOrder.length > 0 && (
          <div className="inspect-deck-sort">
            <strong>排序剩餘牌（上到下 = 牌庫頂到底）</strong>
            <div className="inspect-deck-sort-list">
              {nonPickedOrder.map((id, index) => {
                const card = revealedCards.find(
                  (c) => c.instanceId === id,
                )
                return (
                  <div key={id} className="inspect-deck-sort-row">
                    <span>{card?.name ?? id}</span>
                    <div className="inspect-deck-sort-actions">
                      <button
                        type="button"
                        aria-label={`${card?.name ?? id} 上移`}
                        disabled={index === 0}
                        onClick={() => moveUp(index)}
                      >
                        <ChevronUp aria-hidden="true" />
                      </button>
                      <button
                        type="button"
                        aria-label={`${card?.name ?? id} 下移`}
                        disabled={
                          index === nonPickedOrder.length - 1
                        }
                        onClick={() => moveDown(index)}
                      >
                        <ChevronDown aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
        <div className="modal-actions">
          <button
            type="button"
            disabled={!pickedId}
            onClick={handleConfirm}
          >
            確認並放回
          </button>
        </div>
      </section>
    </div>
  )
}
