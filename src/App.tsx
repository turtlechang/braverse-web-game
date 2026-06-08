import { useEffect, useState } from 'react'
import {
  Check,
  ChevronRight,
  Eye,
  Layers3,
  List,
  Pause,
  RotateCcw,
  Sparkles,
  Swords,
  X,
} from 'lucide-react'
import './App.css'
import {
  activateCookieSkill,
  advancePhase,
  attackCookie,
  canActivateCookieSkill,
  canAttack,
  createDemoGame,
  deployCookie,
  executeCardEffect,
  getBreakAreaLevel,
  getAttackEnergyCost,
  getEnergyCostTotal,
  getEffectTargetCandidates,
  getEffectiveAttack,
  getRefreshCandidates,
  isEffectConditionMet,
  OFFICIAL_STARTER_DECK_RED,
  placeSupportCard,
  refreshDeck,
  replaceDefeatedCookie,
  simulateAiMatch,
  selectEnergyPayment,
  takeAiStep,
  validateEnergyPayment,
  type AiMatchResult,
  type CardEffect,
  type CardSkill,
  type EffectContext,
  type EnergyCost,
  type GameCard,
  type GameState,
  type PlayerId,
  type SkillTrigger,
  type TurnPhase,
} from './game'

const phases: TurnPhase[] = ['active', 'draw', 'support', 'main', 'end']
const aiSimulationSeeds = Array.from({ length: 20 }, (_, index) => index + 1)
const cardBackSources = [
  '/card-back.png',
  'https://cookierunbraverse.com/images/card/card-back.png',
] as const

const phaseLabels: Record<TurnPhase, string> = {
  active: '活躍階段',
  draw: '抽牌階段',
  support: '支援階段',
  main: '主要階段',
  end: '結束階段',
}
const nextPhaseLabels: Record<TurnPhase, string> = {
  active: '完成活躍',
  draw: '前往支援',
  support: '前往主要',
  main: '結束主要',
  end: '結束回合',
}

const opponentOf = (playerId: PlayerId): PlayerId =>
  playerId === 'player-one' ? 'player-two' : 'player-one'

interface PendingEffect {
  sourceCard: GameCard
  context: EffectContext
  skill: CardSkill
  trigger: SkillTrigger
  effects: CardEffect[]
  effectIndex: number
  selectedTargetIds: string[]
  selectedPaymentIds: string[]
  skillActivated: boolean
  optional: boolean
  triggerLabel: string
}

const energyLabels = {
  red: '紅',
  yellow: '黃',
  green: '綠',
  blue: '藍',
  purple: '紫',
  black: '黑',
  neutral: '任意',
} as const

type EnergyKey = keyof typeof energyLabels

const energyVisuals: Partial<
  Record<EnergyKey, { symbol: string; imageUrl: string }>
> = {
  red: { symbol: 'R', imageUrl: '/energy/{R}.webp' },
  yellow: { symbol: 'Y', imageUrl: '/energy/{Y}.webp' },
  green: { symbol: 'G', imageUrl: '/energy/{G}.webp' },
  blue: { symbol: 'B', imageUrl: '/energy/{B}.webp' },
  purple: { symbol: 'P', imageUrl: '/energy/{P}.webp' },
  neutral: { symbol: 'N', imageUrl: '/energy/{N}.webp' },
}

const energyTokens: Partial<Record<string, EnergyKey>> = {
  R: 'red',
  Y: 'yellow',
  G: 'green',
  B: 'blue',
  P: 'purple',
  N: 'neutral',
}

const getSkillCostTotal = (skill: CardSkill) =>
  Object.values(skill.cost).reduce(
    (total, amount) => total + (amount ?? 0),
    0,
  )

function EnergyIcon({ energy }: { energy: EnergyKey }) {
  const [imageFailed, setImageFailed] = useState(false)
  const visual = energyVisuals[energy]

  if (!visual || imageFailed) {
    return (
      <span className="energy-symbol-fallback">
        {visual ? `{${visual.symbol}}` : energyLabels[energy]}
      </span>
    )
  }

  return (
    <img
      className="energy-icon"
      src={visual.imageUrl}
      alt={`${energyLabels[energy]}色能量`}
      title={`${energyLabels[energy]}色能量`}
      onError={() => setImageFailed(true)}
    />
  )
}

function SkillCost({ skill }: { skill: CardSkill }) {
  return <EnergyCostIcons cost={skill.cost} />
}

function EnergyCostIcons({ cost }: { cost: EnergyCost }) {
  const energies = Object.entries(cost).flatMap(([energy, amount]) =>
    Array.from(
      { length: amount ?? 0 },
      () => energy as EnergyKey,
    ),
  )

  if (energies.length === 0) {
    return <span>不需能量</span>
  }

  return (
    <span className="energy-icon-list">
      {energies.map((energy, index) => (
        <EnergyIcon key={`${energy}-${index}`} energy={energy} />
      ))}
    </span>
  )
}

function CardEffectText({ text }: { text: string }) {
  const parts = text.split(/(\{(?:mob|ap|R|Y|G|B|P|N)\})/g)

  return (
    <>
      {parts.map((part, index) => {
        const token = part.match(/^\{(.+)\}$/)?.[1]
        const energy = token ? energyTokens[token] : undefined

        if (energy) {
          return <EnergyIcon key={`${part}-${index}`} energy={energy} />
        }

        if (token === 'mob' || token === 'ap') {
          return (
            <span className="inline-skill-label" key={`${part}-${index}`}>
              {token === 'mob' ? 'Activate 啟動' : 'OnPlay 登場'}
            </span>
          )
        }

        return part
      })}
    </>
  )
}

const getSkillLabels = (skill: CardSkill) => [
  skill.trigger === 'activate'
    ? 'Activate 啟動'
    : skill.trigger === 'on-play'
      ? 'OnPlay 登場'
      : 'Skill 技能',
  ...(skill.oncePerTurn ? ['Once per turn 一回合一次'] : []),
  ...(skill.yourTurn ? ['Your Turn 自己的回合'] : []),
]

const describeEffect = (effect: CardEffect) => {
  const target =
    effect.target.side === 'self' ? '我方餅乾' : '對手餅乾'
  const count =
    effect.target.min === effect.target.max
      ? `${effect.target.max} 個`
      : `最多 ${effect.target.max} 個`

  if (effect.kind === 'damage') {
    return `選擇${count}${target}，造成 ${effect.amount} 點效果傷害。`
  }

  const value = effect.amount > 0 ? `+${effect.amount}` : effect.amount
  return effect.kind === 'modify-attack'
    ? `選擇${count}${target}，攻擊傷害 ${value}。`
    : `選擇${count}${target}，受到的攻擊傷害 ${value}。`
}

const describeEffectResult = (
  effect: CardEffect,
  targetNames: string[],
) => {
  if (targetNames.length === 0) {
    return '效果已確認，本次沒有選擇目標。'
  }

  const names = targetNames.join('、')
  if (effect.kind === 'damage') {
    return `${names}受到 ${effect.amount} 點效果傷害。`
  }

  const value = effect.amount > 0 ? `+${effect.amount}` : effect.amount
  return effect.kind === 'modify-attack'
    ? `${names}獲得攻擊傷害 ${value} 修正。`
    : `${names}獲得受到攻擊傷害 ${value} 修正。`
}

interface CardFaceProps {
  card: GameCard
  className?: string
  concealed?: boolean
  rested?: boolean
  selected?: boolean
  targetable?: boolean
  onClick?: () => void
}

function CardFace({
  card,
  className = '',
  concealed = false,
  rested = false,
  selected = false,
  targetable = false,
  onClick,
}: CardFaceProps) {
  const [imageFailed, setImageFailed] = useState(false)
  const [cardBackSourceIndex, setCardBackSourceIndex] = useState(0)
  const cardBackSource = cardBackSources[cardBackSourceIndex]
  const content = concealed ? (
    cardBackSource ? (
      <img
        src={cardBackSource}
        alt="Braverse 卡牌背面"
        onError={() =>
          setCardBackSourceIndex((currentIndex) => currentIndex + 1)
        }
      />
    ) : (
      <div
        className="card-back-fallback"
        role="img"
        aria-label="Braverse 卡牌背面"
      >
        <span>COOKIE RUN</span>
        <strong>BRAVERSE</strong>
      </div>
    )
  ) : card.imageUrl && !imageFailed ? (
    <img
      src={card.imageUrl}
      alt={card.name}
      onError={() => setImageFailed(true)}
    />
  ) : (
    <div className="card-fallback">
      <span>{card.type.toUpperCase()}</span>
      <strong>{card.name}</strong>
      {card.type === 'cookie' && (
        <small>LV {card.level} · HP {card.hp}</small>
      )}
    </div>
  )

  if (!onClick) {
    return (
      <div
        className={`card-face ${className}${rested ? ' is-rested' : ''}${
          selected ? ' is-selected' : ''
        }${targetable ? ' is-targetable' : ''}`}
      >
        {content}
      </div>
    )
  }

  return (
    <button
      className={`card-face ${className}${rested ? ' is-rested' : ''}${
        selected ? ' is-selected' : ''
      }${targetable ? ' is-targetable' : ''}`}
      type="button"
      title={card.name}
      onClick={onClick}
    >
      {content}
    </button>
  )
}

interface BattleRowProps {
  game: GameState
  playerId: PlayerId
  position: 'top' | 'bottom'
  selectedAttackerId: string | null
  effectTargetIds: Set<string>
  selectedEffectTargetIds: Set<string>
  selectedSkillPaymentIds: Set<string>
  selectedAttackPaymentIds: Set<string>
  attackPaymentValid: boolean
  interactionLocked: boolean
  onSelectAttacker?: (instanceId: string) => void
  onAttackTarget?: (instanceId: string) => void
  onEffectTarget?: (instanceId: string) => void
  onSkillPayment?: (instanceId: string) => void
  onAttackPayment?: (instanceId: string) => void
  onActivateSkill?: (instanceId: string) => void
  onPlaceSupport?: (instanceId: string) => void
  onDeployCookie?: (instanceId: string) => void
  onInspectCard: (card: GameCard) => void
}

function BattleRow({
  game,
  playerId,
  position,
  selectedAttackerId,
  effectTargetIds,
  selectedEffectTargetIds,
  selectedSkillPaymentIds,
  selectedAttackPaymentIds,
  attackPaymentValid,
  interactionLocked,
  onSelectAttacker,
  onAttackTarget,
  onEffectTarget,
  onSkillPayment,
  onAttackPayment,
  onActivateSkill,
  onPlaceSupport,
  onDeployCookie,
  onInspectCard,
}: BattleRowProps) {
  const player = game.players[playerId]
  const isActivePlayer = game.activePlayerId === playerId
  const isOpponent = position === 'top'
  const canOperate = isActivePlayer && !isOpponent && !interactionLocked
  const supportZone = (
    <div className="support-zone">
      <span className="zone-watermark">支援區</span>
      <div className="support-cards">
        {player.supportArea.map((support) => (
          <CardFace
            card={support.card}
            className="support-card"
            rested={support.rested}
            selected={
              selectedSkillPaymentIds.has(support.card.instanceId) ||
              selectedAttackPaymentIds.has(support.card.instanceId)
            }
            targetable={
              interactionLocked &&
              !support.rested &&
              Boolean(onSkillPayment)
                ? true
                : canOperate &&
                  Boolean(selectedAttackerId) &&
                  !support.rested &&
                  Boolean(onAttackPayment)
            }
            key={support.card.instanceId}
            onClick={
              interactionLocked && !support.rested && onSkillPayment
                ? () => onSkillPayment(support.card.instanceId)
                : canOperate &&
                    selectedAttackerId &&
                    !support.rested &&
                    onAttackPayment
                  ? () => onAttackPayment(support.card.instanceId)
                : () => onInspectCard(support.card)
            }
          />
        ))}
        {player.supportArea.length === 0 && (
          <span className="empty-zone">尚未配置支援</span>
        )}
      </div>
    </div>
  )

  return (
    <section
      className={`battle-row ${position}-field`}
      aria-label={`${player.name}場地`}
    >
      <div className="break-zone">
        <div className="zone-heading">
          <span>休息區</span>
          <strong>LV. {getBreakAreaLevel(game, playerId)}</strong>
        </div>
        <div className="break-cards">
          {player.breakArea.map((card) => (
            <CardFace
              card={card}
              className="break-card"
              key={card.instanceId}
              onClick={() => onInspectCard(card)}
            />
          ))}
          {player.breakArea.length === 0 && (
            <small className="empty-zone">0 張</small>
          )}
        </div>
      </div>

      <div className="field-stack">
        {position === 'top' && supportZone}
        <div className="combat-zone">
          <div className="row-meta">
            <span>{isOpponent ? 'OPPONENT' : 'PLAYER'}</span>
            <strong>{player.name}</strong>
            <small>
              {isActivePlayer ? '行動中' : '等待'} · 手牌 {player.hand.length}
            </small>
          </div>
          <span className="zone-watermark">戰鬥區</span>
          <div className="combat-slots">
            {player.battleArea.map((cookie) => {
              const canSelectEffectTarget = effectTargetIds.has(
                cookie.card.instanceId,
              )
              const canSelectAttack =
                canOperate &&
                game.phase === 'main' &&
                canAttack(game) &&
                !cookie.rested &&
                selectEnergyPayment(
                  getAttackEnergyCost(cookie.card),
                  player.supportArea,
                ) !== null
              const canTarget =
                !interactionLocked &&
                isOpponent &&
                Boolean(selectedAttackerId) &&
                attackPaymentValid
              const canActivateSkill =
                canOperate &&
                canActivateCookieSkill(
                  game,
                  playerId,
                  cookie.card.instanceId,
                  'activate',
                )

              return (
                <div className="combat-card-wrap" key={cookie.card.instanceId}>
                  <CardFace
                    card={cookie.card}
                    rested={cookie.rested}
                    selected={
                      selectedAttackerId === cookie.card.instanceId ||
                      selectedEffectTargetIds.has(cookie.card.instanceId)
                    }
                    targetable={canSelectEffectTarget}
                    onClick={
                      canSelectEffectTarget
                        ? () => onEffectTarget?.(cookie.card.instanceId)
                        : canTarget
                        ? () => onAttackTarget?.(cookie.card.instanceId)
                        : canSelectAttack
                          ? () => onSelectAttacker?.(cookie.card.instanceId)
                          : () => onInspectCard(cookie.card)
                    }
                  />
                  <div className="card-badges">
                    <span>HP {cookie.hpCards.length}/{cookie.card.hp}</span>
                    <span>
                      ATK {getEffectiveAttack(game, cookie.card.instanceId)}
                    </span>
                  </div>
                  {(canTarget || canSelectEffectTarget) && (
                    <span className="target-hint">
                      {canSelectEffectTarget ? '效果目標' : '攻擊目標'}
                    </span>
                  )}
                  {canActivateSkill && (
                    <button
                      className="skill-action"
                      type="button"
                      onClick={() =>
                        onActivateSkill?.(cookie.card.instanceId)
                      }
                    >
                      啟動技能
                    </button>
                  )}
                </div>
              )
            })}
            {player.battleArea.length === 0 && (
              <span className="empty-zone">等待餅乾登場</span>
            )}
          </div>
        </div>
        {position === 'bottom' && supportZone}
      </div>

      <div className="utility-zones">
        <div className="deck-zone" aria-label={`牌庫 ${player.deck.length} 張`}>
          <div className="mini-deck" />
          <strong>{player.deck.length}</strong>
          <span>牌庫</span>
        </div>
        <div className="stage-zone">
          <span>場景區</span>
          {player.stage ? (
            <CardFace
              card={player.stage}
              className="stage-card"
              onClick={() => onInspectCard(player.stage!)}
            />
          ) : (
            <Layers3 aria-hidden="true" />
          )}
        </div>
        <div className="discard-zone">
          <span>棄牌區</span>
          <strong>{player.discardPile.length}</strong>
        </div>
      </div>

      <div
        className={`hand-fan ${position}-hand`}
        aria-label={`${isOpponent ? '對手' : '我方'}手牌`}
      >
        {player.hand.map((card, index) => {
          const canSupport =
            canOperate &&
            game.phase === 'support' &&
            !game.supportPlacedThisTurn
          const canDeploy =
            canOperate &&
            game.phase === 'main' &&
            card.type === 'cookie' &&
            player.battleArea.length < 2
          const offset = index - (player.hand.length - 1) / 2

          return (
            <div
              className="hand-card-wrap"
              key={card.instanceId}
              style={{
                '--fan-index': index,
                '--fan-offset': offset,
              } as React.CSSProperties}
            >
              <CardFace
                card={card}
                className="hand-card"
                concealed={isOpponent}
                onClick={
                  isOpponent ? undefined : () => onInspectCard(card)
                }
              />
              {(canSupport || canDeploy) && (
                <button
                  className="hand-card-action"
                  type="button"
                  onClick={() =>
                    canDeploy
                      ? onDeployCookie?.(card.instanceId)
                      : onPlaceSupport?.(card.instanceId)
                  }
                >
                  {canDeploy ? '登場' : '支援'}
                </button>
              )}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function App() {
  const [game, setGame] = useState(createDemoGame)
  const [selectedAttackerId, setSelectedAttackerId] = useState<string | null>(
    null,
  )
  const [selectedAttackPaymentIds, setSelectedAttackPaymentIds] = useState<
    string[]
  >([])
  const [message, setMessage] = useState('推進階段，開始這場對戰。')
  const [effectHistory, setEffectHistory] = useState<string[]>([])
  const [pendingEffect, setPendingEffect] =
    useState<PendingEffect | null>(null)
  const [inspectedCard, setInspectedCard] = useState<GameCard | null>(null)
  const [showPause, setShowPause] = useState(false)
  const [showDeckList, setShowDeckList] = useState(false)
  const [aiThinking, setAiThinking] = useState(false)
  const [aiActionCount, setAiActionCount] = useState(0)
  const [simulationResults, setSimulationResults] = useState<
    AiMatchResult[] | null
  >(null)
  const activePlayer = game.players[game.activePlayerId]
  const viewerPlayerId: PlayerId = 'player-one'
  const opponentId = opponentOf(viewerPlayerId)
  const currentEffect =
    pendingEffect?.effects[pendingEffect.effectIndex] ?? null
  const effectTargetCandidates =
    pendingEffect && currentEffect
      ? getEffectTargetCandidates(
          game,
          pendingEffect.context,
          currentEffect.target,
        )
      : []
  const effectTargetIds = new Set(
    effectTargetCandidates.map((cookie) => cookie.card.instanceId),
  )
  const selectedEffectTargetIds = new Set(
    pendingEffect?.selectedTargetIds ?? [],
  )
  const selectedSkillPaymentIds = new Set(
    pendingEffect?.selectedPaymentIds ?? [],
  )
  const selectedAttackPaymentIdSet = new Set(selectedAttackPaymentIds)
  const selectedAttacker = activePlayer.battleArea.find(
    (cookie) => cookie.card.instanceId === selectedAttackerId,
  )
  const selectedAttackCost = selectedAttacker
    ? getAttackEnergyCost(selectedAttacker.card)
    : {}
  const attackPaymentValidation = selectedAttacker
    ? validateEnergyPayment(
        selectedAttackCost,
        activePlayer.supportArea,
        selectedAttackPaymentIds,
      )
    : { valid: false, reason: '尚未選擇攻擊餅乾。' }
  const aiControlsCurrentState =
    game.activePlayerId === 'player-two' ||
    game.pendingRefresh?.playerId === 'player-two' ||
    game.pendingReplacementPlayerId === 'player-two'

  useEffect(() => {
    if (
      showPause ||
      game.status !== 'playing' ||
      !aiControlsCurrentState ||
      pendingEffect
    ) {
      return
    }

    if (aiActionCount >= 200) {
      return
    }

    const thinkingTimer = window.setTimeout(
      () => setAiThinking(true),
      0,
    )
    const timer = window.setTimeout(() => {
      const decision = takeAiStep(game, 'player-two')
      setAiThinking(false)

      if (decision.action === 'error' || decision.state === game) {
        setMessage(`AI 停止：${decision.description}`)
        return
      }

      setGame(decision.state)
      setMessage(`AI：${decision.description}`)
      setAiActionCount((count) => count + 1)
    }, 450)

    return () => {
      window.clearTimeout(thinkingTimer)
      window.clearTimeout(timer)
    }
  }, [
    aiActionCount,
    aiControlsCurrentState,
    game,
    pendingEffect,
    showPause,
  ])

  const beginCookieSkill = (
    nextGame: GameState,
    card: GameCard | undefined,
    playerId: PlayerId,
    trigger: SkillTrigger,
    triggerLabel: string,
    optional = false,
  ) => {
    if (
      !card?.skill ||
      card.skill.trigger !== trigger ||
      nextGame.status !== 'playing'
    ) {
      return
    }

    const context = {
      sourcePlayerId: playerId,
      sourceInstanceId: card.instanceId,
    }
    const availableEffects = card.skill.effects.filter((effect) =>
      isEffectConditionMet(nextGame, context, effect),
    )

    if (availableEffects.length === 0) {
      setMessage(`${card.name}的效果尚未滿足發動條件。`)
      return
    }

    if (
      !canActivateCookieSkill(
        nextGame,
        playerId,
        card.instanceId,
        trigger,
      )
    ) {
      setMessage(`${card.name}目前無法支付或發動技能。`)
      return
    }

    setSelectedAttackerId(null)
    setSelectedAttackPaymentIds([])
    setPendingEffect({
      sourceCard: card,
      context,
      skill: card.skill,
      trigger,
      effects: availableEffects,
      effectIndex: 0,
      selectedTargetIds: [],
      selectedPaymentIds: [],
      skillActivated: false,
      optional,
      triggerLabel,
    })
    setMessage(`${card.name}的技能等待支付能量並選擇目標。`)
  }

  const runAction = (
    action: (current: GameState) => GameState,
    successMessage: string,
    onSuccess?: (nextGame: GameState) => void,
  ) => {
    try {
      const nextGame = action(game)
      setGame(nextGame)
      setMessage(successMessage)
      onSuccess?.(nextGame)
    } catch (error) {
      setMessage(error instanceof Error ? error.message : '動作無法執行。')
    }
  }

  const handleAdvancePhase = () => {
    if (pendingEffect) return
    runAction(advancePhase, '階段已推進。')
    setSelectedAttackerId(null)
    setSelectedAttackPaymentIds([])
  }

  const handleAttackTarget = (targetInstanceId: string) => {
    if (!selectedAttackerId || !attackPaymentValidation.valid) return

    const attacker = activePlayer.battleArea.find(
      (cookie) => cookie.card.instanceId === selectedAttackerId,
    )

    runAction(
      (current) =>
        attackCookie(
          current,
          selectedAttackerId,
          targetInstanceId,
          selectedAttackPaymentIds,
      ),
      `${attacker?.card.name ?? '餅乾'}完成攻擊。`,
      () => {
        setSelectedAttackerId(null)
        setSelectedAttackPaymentIds([])
      },
    )
  }

  const toggleAttackPayment = (instanceId: string) => {
    setSelectedAttackPaymentIds((current) =>
      current.includes(instanceId)
        ? current.filter((id) => id !== instanceId)
        : [...current, instanceId],
    )
  }

  const toggleEffectTarget = (instanceId: string) => {
    if (!pendingEffect || !currentEffect || !effectTargetIds.has(instanceId)) {
      return
    }

    const isSelected = pendingEffect.selectedTargetIds.includes(instanceId)
    const selectedTargetIds = isSelected
      ? pendingEffect.selectedTargetIds.filter((id) => id !== instanceId)
      : pendingEffect.selectedTargetIds.length < currentEffect.target.max
        ? [...pendingEffect.selectedTargetIds, instanceId]
        : pendingEffect.selectedTargetIds

    setPendingEffect({ ...pendingEffect, selectedTargetIds })
  }

  const toggleSkillPayment = (instanceId: string) => {
    if (!pendingEffect || pendingEffect.skillActivated) return

    const isSelected =
      pendingEffect.selectedPaymentIds.includes(instanceId)
    const selectedPaymentIds = isSelected
      ? pendingEffect.selectedPaymentIds.filter((id) => id !== instanceId)
      : [...pendingEffect.selectedPaymentIds, instanceId]

    setPendingEffect({ ...pendingEffect, selectedPaymentIds })
  }

  const skipOptionalSkill = () => {
    if (!pendingEffect?.optional) return

    setMessage(`${pendingEffect.sourceCard.name}的 OnPlay 技能未發動。`)
    setPendingEffect(null)
  }

  const confirmEffect = () => {
    if (!pendingEffect || !currentEffect) return

    const targetNames = pendingEffect.selectedTargetIds.map(
      (instanceId) =>
        effectTargetCandidates.find(
          (cookie) => cookie.card.instanceId === instanceId,
        )?.card.name ?? instanceId,
    )

    try {
      const activatedGame = pendingEffect.skillActivated
        ? game
        : activateCookieSkill(
            game,
            pendingEffect.context.sourcePlayerId,
            pendingEffect.sourceCard.instanceId,
            pendingEffect.trigger,
            pendingEffect.selectedPaymentIds,
          )
      const nextGame = executeCardEffect(
        activatedGame,
        pendingEffect.context,
        currentEffect,
        pendingEffect.selectedTargetIds,
      )
      const result = describeEffectResult(currentEffect, targetNames)
      const nextEffectIndex = pendingEffect.effectIndex + 1

      setGame(nextGame)
      setMessage(result)
      setEffectHistory((history) => [result, ...history].slice(0, 4))
      setPendingEffect(
        nextEffectIndex < pendingEffect.effects.length
          ? {
              ...pendingEffect,
              effectIndex: nextEffectIndex,
              selectedTargetIds: [],
              skillActivated: true,
            }
          : null,
      )
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : '效果無法執行。',
      )
    }
  }

  const pendingPlayerId =
    game.pendingRefresh?.playerId ?? game.pendingReplacementPlayerId
  const pendingPlayer = pendingPlayerId
    ? game.players[pendingPlayerId]
    : null
  const pendingOptions = game.pendingRefresh
    ? getRefreshCandidates(game, game.pendingRefresh.playerId)
    : pendingPlayer?.hand.filter((card) => card.type === 'cookie') ?? []
  const interactionLocked =
    Boolean(pendingEffect) || aiThinking || aiControlsCurrentState

  const runSimulation = () => {
    const results = aiSimulationSeeds.map((seed) =>
      simulateAiMatch(createDemoGame(seed)),
    )
    setSimulationResults(results)
    const completed = results.filter((result) => !result.stuck).length
    setMessage(`AI 驗證完成：${completed}/20 場正常結束。`)
  }

  return (
    <main className="game-shell">
      <div className="board-texture" />

      <aside className="phase-rail" aria-label="回合階段">
        <div className="brand-mark">
          <span>COOKIE RUN</span>
          <strong>BRAVERSE</strong>
        </div>
        <ol>
          {phases.map((phase, index) => (
            <li
              className={game.phase === phase ? 'is-current' : ''}
              key={phase}
            >
              <span>{String(index + 1).padStart(2, '0')}</span>
              <strong>{phaseLabels[phase]}</strong>
            </li>
          ))}
        </ol>
        <button
          className="next-phase-button"
          type="button"
          onClick={handleAdvancePhase}
          disabled={
            game.status === 'finished' ||
            Boolean(game.pendingReplacementPlayerId) ||
            Boolean(game.pendingRefresh) ||
            Boolean(pendingEffect)
          }
        >
          <span>{nextPhaseLabels[game.phase]}</span>
          <ChevronRight aria-hidden="true" />
        </button>
        <span className="turn-counter">TURN {game.turnNumber}</span>
      </aside>

      <header className="match-toolbar">
        <div className="match-status">
          <span>{activePlayer.name}的回合</span>
          <strong>{phaseLabels[game.phase]}</strong>
          <small>{message}</small>
        </div>
        <div className="toolbar-actions">
          <button
            type="button"
            title="重新開始"
            onClick={() => {
              setGame(createDemoGame())
              setSelectedAttackerId(null)
              setSelectedAttackPaymentIds([])
              setPendingEffect(null)
              setEffectHistory([])
              setAiActionCount(0)
              setSimulationResults(null)
              setMessage('已建立新的 Starter Deck RED 範例對局。')
            }}
          >
            <RotateCcw aria-hidden="true" />
          </button>
          <button
            type="button"
            title="查看官方範例牌組"
            onClick={() => setShowDeckList(true)}
          >
            <List aria-hidden="true" />
          </button>
          <button
            type="button"
            title="暫停資訊"
            onClick={() => setShowPause(true)}
          >
            <Pause aria-hidden="true" />
          </button>
        </div>
      </header>

      <section className="table-area" aria-label="Braverse 對戰桌">
        <BattleRow
          game={game}
          playerId={opponentId}
          position="top"
          selectedAttackerId={selectedAttackerId}
          effectTargetIds={effectTargetIds}
          selectedEffectTargetIds={selectedEffectTargetIds}
          selectedSkillPaymentIds={selectedSkillPaymentIds}
          selectedAttackPaymentIds={selectedAttackPaymentIdSet}
          attackPaymentValid={attackPaymentValidation.valid}
          interactionLocked={interactionLocked}
          onAttackTarget={handleAttackTarget}
          onEffectTarget={toggleEffectTarget}
          onInspectCard={setInspectedCard}
        />

        <div className="table-divider">
          <span />
          <strong>
            {aiThinking ? (
              <>
                <Sparkles aria-hidden="true" /> AI 思考中
              </>
            ) : pendingEffect ? (
              <>
                <Sparkles aria-hidden="true" /> 選擇效果目標
              </>
            ) : selectedAttackerId ? (
              <>
                <Swords aria-hidden="true" /> 選擇攻擊目標
              </>
            ) : (
              `${activePlayer.name} · ${phaseLabels[game.phase]}`
            )}
          </strong>
          <span />
        </div>

        <BattleRow
          game={game}
          playerId={viewerPlayerId}
          position="bottom"
          selectedAttackerId={selectedAttackerId}
          effectTargetIds={effectTargetIds}
          selectedEffectTargetIds={selectedEffectTargetIds}
          selectedSkillPaymentIds={selectedSkillPaymentIds}
          selectedAttackPaymentIds={selectedAttackPaymentIdSet}
          attackPaymentValid={attackPaymentValidation.valid}
          interactionLocked={interactionLocked}
          onSelectAttacker={(instanceId) => {
            setSelectedAttackerId(instanceId)
            setSelectedAttackPaymentIds([])
            setMessage('選擇支援卡支付攻擊費用。')
          }}
          onEffectTarget={toggleEffectTarget}
          onPlaceSupport={(instanceId) =>
            runAction(
              (current) => placeSupportCard(current, instanceId),
              '已將卡牌配置到支援區。',
            )
          }
          onSkillPayment={toggleSkillPayment}
          onAttackPayment={toggleAttackPayment}
          onActivateSkill={(instanceId) => {
            const card = activePlayer.battleArea.find(
              (cookie) => cookie.card.instanceId === instanceId,
            )?.card
            beginCookieSkill(
              game,
              card,
              activePlayer.id,
              'activate',
              'Activate 主動發動',
            )
          }}
          onDeployCookie={(instanceId) =>
            runAction(
              (current) => deployCookie(current, instanceId),
              '新餅乾已登場並配置 HP。',
              (nextGame) =>
                beginCookieSkill(
                  nextGame,
                  activePlayer.hand.find(
                    (card) => card.instanceId === instanceId,
                  ),
                  activePlayer.id,
                  'on-play',
                  'OnPlay 登場觸發',
                  true,
                ),
            )
          }
          onInspectCard={setInspectedCard}
        />
      </section>

      {selectedAttacker && !pendingEffect && (
        <aside
          className={`attack-payment-panel ${
            attackPaymentValidation.valid ? 'is-valid' : 'is-invalid'
          }`}
          aria-live="polite"
          data-testid="attack-payment-panel"
        >
          <span>攻擊能量支付</span>
          <strong>{selectedAttacker.card.name}</strong>
          <div className="attack-cost-row">
            <span>需求</span>
            <EnergyCostIcons cost={selectedAttackCost} />
          </div>
          <small>
            已選 {selectedAttackPaymentIds.length}／
            {getEnergyCostTotal(selectedAttackCost)} 張支援卡
          </small>
          <p>{attackPaymentValidation.reason}</p>
          {attackPaymentValidation.valid && (
            <em>付款合法，請選擇對手戰鬥區中的攻擊目標。</em>
          )}
          <button
            type="button"
            onClick={() => {
              setSelectedAttackerId(null)
              setSelectedAttackPaymentIds([])
              setMessage('已取消攻擊。')
            }}
          >
            取消攻擊
          </button>
        </aside>
      )}

      <aside className="ai-status-panel" aria-live="polite">
        <span>簡易 AI 對手</span>
        <strong>{aiThinking ? '正在決策' : '等待下一步'}</strong>
        <small>已執行 {aiActionCount} 個動作</small>
        <button type="button" onClick={runSimulation}>
          執行 20 場 AI 驗證
        </button>
      </aside>

      {simulationResults && (
        <section
          className="simulation-report"
          data-testid="ai-simulation-report"
        >
          <button
            type="button"
            className="close-modal"
            title="關閉"
            onClick={() => setSimulationResults(null)}
          >
            <X aria-hidden="true" />
          </button>
          <span>瀏覽器自動對戰報告</span>
          <h2>
            {
              simulationResults.filter((result) => !result.stuck)
                .length
            }
            /20 場完成
          </h2>
          <div className="simulation-table">
            {simulationResults.map((result, index) => (
              <div
                key={aiSimulationSeeds[index]}
                data-testid={`ai-simulation-match-${index + 1}`}
                data-validation={JSON.stringify(
                  result.stuck
                    ? {
                        seed: aiSimulationSeeds[index],
                        state: result.state,
                        logs: result.logs.slice(-20),
                        error: result.error,
                      }
                    : {
                        seed: aiSimulationSeeds[index],
                        winnerId: result.state.result?.winnerId,
                        reason: result.state.result?.reason,
                        turnNumber: result.state.turnNumber,
                        actions: result.actions,
                        metrics: result.metrics,
                      },
                )}
              >
                <strong>#{index + 1} · 種子 {aiSimulationSeeds[index]}</strong>
                <span>
                  {result.stuck
                    ? '卡住'
                    : `${result.state.players[result.state.result!.winnerId].name}勝利`}
                </span>
                <span>回合 {result.state.turnNumber}</span>
                <span>{result.actions} 步</span>
                <span>技能 {result.metrics.skillActivations}</span>
                <span>Refresh {result.metrics.refreshes}</span>
                <span>補位 {result.metrics.replacements}</span>
                <code>
                  {result.error ??
                    result.state.result?.reason ??
                    'completed'}
                </code>
              </div>
            ))}
          </div>
        </section>
      )}

      {(pendingEffect || effectHistory.length > 0) && (
        <aside className="effect-panel" aria-live="polite">
          {pendingEffect && currentEffect ? (
            <>
              <span>{pendingEffect.triggerLabel}</span>
              <strong>{pendingEffect.sourceCard.name}</strong>
              <div className="skill-labels">
                {getSkillLabels(pendingEffect.skill).map((label) => (
                  <span key={label}>{label}</span>
                ))}
              </div>
              <p>
                <CardEffectText
                  text={pendingEffect.sourceCard.effectText ?? ''}
                />
              </p>
              {!pendingEffect.skillActivated && (
                <div className="skill-cost">
                  <strong>技能費用</strong>
                  <SkillCost skill={pendingEffect.skill} />
                  <small>
                    已選 {pendingEffect.selectedPaymentIds.length} 張支援卡
                  </small>
                </div>
              )}
              <div className="effect-instruction">
                <Sparkles aria-hidden="true" />
                <span>{describeEffect(currentEffect)}</span>
              </div>
              <small>
                已選 {pendingEffect.selectedTargetIds.length}／
                {currentEffect.target.max}
              </small>
              <button
                type="button"
                disabled={
                  (!pendingEffect.skillActivated &&
                    pendingEffect.selectedPaymentIds.length !==
                      getSkillCostTotal(pendingEffect.skill)) ||
                  pendingEffect.selectedTargetIds.length <
                    currentEffect.target.min ||
                  pendingEffect.selectedTargetIds.length >
                    currentEffect.target.max
                }
                onClick={confirmEffect}
              >
                <Check aria-hidden="true" />
                確認效果
              </button>
              {pendingEffect.optional && !pendingEffect.skillActivated && (
                <button
                  className="skip-effect"
                  type="button"
                  onClick={skipOptionalSkill}
                >
                  不發動
                </button>
              )}
            </>
          ) : (
            <>
              <span>效果紀錄</span>
              <strong>{effectHistory[0]}</strong>
            </>
          )}
          {effectHistory.length > 0 && (
            <ol>
              {effectHistory.map((entry, index) => (
                <li key={`${entry}-${index}`}>{entry}</li>
              ))}
            </ol>
          )}
        </aside>
      )}

      <button
        className="inspect-hand-button"
        type="button"
        onClick={() =>
          setInspectedCard(game.players[viewerPlayerId].hand[0] ?? null)
        }
      >
        <Eye aria-hidden="true" />
        <span>查看卡牌</span>
      </button>

      {pendingPlayer && pendingPlayer.id !== 'player-two' && (
        <div className="modal-backdrop" role="presentation">
          <section className="decision-modal" role="alertdialog">
            <div className="modal-title">
              {game.pendingRefresh ? '牌庫 Refresh' : '放置餅乾'}
            </div>
            <div className="modal-body">
              <strong>
                {game.pendingRefresh
                  ? `${pendingPlayer.name}必須選擇一張餅乾放入休息區`
                  : `${pendingPlayer.name}必須在戰鬥區放置新餅乾`}
              </strong>
              <div className="modal-card-options">
                {pendingOptions.map((card) => (
                  <button
                    type="button"
                    key={card.instanceId}
                    disabled={
                      !game.pendingRefresh &&
                      card.type === 'cookie' &&
                      pendingPlayer.deck.length < card.hp
                    }
                    onClick={() => {
                      if (game.pendingRefresh) {
                        runAction(
                          (current) =>
                            refreshDeck(
                              current,
                              pendingPlayer.id,
                              card.instanceId,
                            ),
                          '牌庫 Refresh 已完成。',
                        )
                      } else {
                        runAction(
                          (current) =>
                            replaceDefeatedCookie(current, card.instanceId),
                          '已補充新的戰鬥區餅乾。',
                        )
                      }
                    }}
                  >
                    <CardFace card={card} />
                    <span>{card.name}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {inspectedCard && (
        <div className="modal-backdrop" role="presentation">
          <section className="card-detail-modal" role="dialog">
            <button
              className="close-modal"
              type="button"
              title="關閉"
              onClick={() => setInspectedCard(null)}
            >
              <X aria-hidden="true" />
            </button>
            <CardFace card={inspectedCard} className="detail-card" />
            <div>
              <span>{inspectedCard.id}</span>
              <h2>{inspectedCard.name}</h2>
              <p>
                {inspectedCard.type === 'cookie'
                  ? `LV ${inspectedCard.level} · HP ${inspectedCard.hp} · 攻擊 ${inspectedCard.attack} · 費用 ${inspectedCard.attackCost}`
                  : `卡牌類型：${inspectedCard.type.toUpperCase()}`}
              </p>
              {inspectedCard.effectText && (
                <div className="card-effect-copy">
                  <strong>卡牌效果</strong>
                  {inspectedCard.skill && (
                    <>
                      <div className="skill-labels">
                        {getSkillLabels(inspectedCard.skill).map((label) => (
                          <span key={label}>{label}</span>
                        ))}
                      </div>
                      <small>
                        費用：<SkillCost skill={inspectedCard.skill} />
                      </small>
                    </>
                  )}
                  <p>
                    <CardEffectText text={inspectedCard.effectText} />
                  </p>
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {showPause && (
        <div className="modal-backdrop" role="presentation">
          <section className="pause-modal" role="dialog">
            <Pause aria-hidden="true" />
            <span>對戰資訊</span>
            <h2>遊戲已暫停</h2>
            <p>目前為第 {game.turnNumber} 回合，{phaseLabels[game.phase]}。</p>
            <button type="button" onClick={() => setShowPause(false)}>
              繼續對戰
            </button>
          </section>
        </div>
      )}

      {showDeckList && (
        <div className="modal-backdrop" role="presentation">
          <section className="deck-list-modal" role="dialog">
            <button
              className="close-modal"
              type="button"
              title="關閉"
              onClick={() => setShowDeckList(false)}
            >
              <X aria-hidden="true" />
            </button>
            <div className="deck-reference-image">
              <img
                src="/reference/starter-deck-red.webp"
                alt="官方 Starter Deck RED 套餐組合表"
              />
            </div>
            <div className="deck-list-content">
              <span>官方範例牌組</span>
              <h2>Starter Deck RED</h2>
              <p>依官方套餐組合圖片建立，共 22 種卡、60 張。</p>
              <div className="deck-list-table">
                {OFFICIAL_STARTER_DECK_RED.map((entry) => (
                  <div key={entry.cardNumber}>
                    <code>{entry.cardNumber}</code>
                    <span>{entry.name}</span>
                    <strong>{entry.count}</strong>
                  </div>
                ))}
              </div>
            </div>
          </section>
        </div>
      )}

      {game.result && (
        <div className="modal-backdrop result-backdrop" role="presentation">
          <section className="result-modal" role="alertdialog">
            <span>對局結束</span>
            <h2>{game.players[game.result.winnerId].name}勝利</h2>
            <p>
              {game.result.reason === 'break-level-limit'
                ? '對手休息區等級達到 10。'
                : game.result.reason === 'refresh-unavailable'
                  ? '對手無法完成牌庫 Refresh。'
                  : '對手沒有可登場的餅乾。'}
            </p>
            <button
              type="button"
              onClick={() => {
                setGame(createDemoGame())
                setSelectedAttackerId(null)
                setSelectedAttackPaymentIds([])
                setPendingEffect(null)
                setEffectHistory([])
                setAiActionCount(0)
                setSimulationResults(null)
              }}
            >
              再來一局
            </button>
          </section>
        </div>
      )}
    </main>
  )
}

export default App
