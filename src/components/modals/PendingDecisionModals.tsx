import { useState, useCallback } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { EnergyColor, GameCard, PendingEffectOrderItem } from '../../game'
import { CardFace } from '../cards/CardVisuals'
import './PendingDecisionModals.css'

const effectOrderLabels: Record<PendingEffectOrderItem['kind'], string> = {
  'faint-effect': '昏厥效果',
  'after-damage-effect': '受傷後效果',
  'draw-up-to': '抽牌效果',
  'inspect-deck': '檢視牌庫',
  'stage-trigger': '場景效果',
}

export interface EffectOrderModalProps {
  items: PendingEffectOrderItem[]
  onConfirm: (orderedIds: string[]) => void
}

export function EffectOrderModal({
  items,
  onConfirm,
}: EffectOrderModalProps) {
  const chooseFirst = (firstId: string) => {
    onConfirm([
      firstId,
      ...items
        .filter((item) => item.id !== firstId)
        .map((item) => item.id),
    ])
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <section
        className="battle-response-modal effect-order-modal"
        role="alertdialog"
      >
        <span>同時觸發</span>
        <h2>選擇效果處理順序</h2>
        <p className="faint-effect-text">
          這些效果屬於同一位玩家，請選擇要先處理的效果。
        </p>
        <div className="modal-card-options">
          {items.map((item) => (
            <button
              type="button"
              key={item.id}
              onClick={() => chooseFirst(item.id)}
            >
              <strong>{item.sourceCardName}</strong>
              <span>{effectOrderLabels[item.kind]}</span>
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

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
                  <CardFace card={card} selected={selectedDiscardIds.includes(card.instanceId)} />
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
                  <CardFace card={entry.card} selected={selectedTargetId === entry.instanceId} />
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
  filterColor?: EnergyColor
  onConfirm: (pickedId: string | null, restOrder: string[]) => void
}

export function InspectDeckModal({
  sourceCardName,
  revealedCards,
  pickCount,
  filterColor,
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

  const hasNoMatchingColor =
    filterColor != null &&
    revealedCards.every((c) => c.energyColor !== filterColor)

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
    if (hasNoMatchingColor) {
      onConfirm(null, restOrder)
      return
    }
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
        {hasNoMatchingColor && (
          <p className="inspect-deck-no-match">
            沒有符合 {filterColor} 顏色的卡牌，將全部放回牌庫底。
          </p>
        )}
        <div className="inspect-deck-grid">
          {revealedCards.map((card) => {
            const isDisabled = filterColor != null && card.energyColor !== filterColor
            return (
              <button
                type="button"
                key={card.instanceId}
                className={
                  pickedId === card.instanceId ? 'is-selected' : ''
                }
                disabled={isDisabled}
                onClick={() => handlePick(card.instanceId)}
                aria-label={`選擇${card.name}`}
              >
                <CardFace card={card} />
                <span>{card.name}</span>
              </button>
            )
          })}
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
            disabled={!pickedId && !hasNoMatchingColor}
            onClick={handleConfirm}
          >
            {hasNoMatchingColor ? '確認並放回' : '確認並放回'}
          </button>
        </div>
      </section>
    </div>
  )
}
