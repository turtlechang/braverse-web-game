import { useState } from 'react'
import type { CardSkill, EnergyCost, GameCard } from '../../game'
import {
  getCardEffectTokenLabel,
  getCardEffectTokenVisual,
  normalizeCardEffectToken,
} from './cardVisualUtils'
import './CardVisuals.css'

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
  black: { symbol: 'K', imageUrl: '/energy/{K}.webp' },
  neutral: { symbol: 'N', imageUrl: '/energy/{N}.webp' },
}

const energyTokens: Partial<Record<string, EnergyKey>> = {
  R: 'red',
  Y: 'yellow',
  G: 'green',
  B: 'blue',
  P: 'purple',
  K: 'black',
  N: 'neutral',
}

export function EnergyIcon({ energy }: { energy: EnergyKey }) {
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

export function SkillCost({ skill }: { skill: CardSkill }) {
  return (
    <span className="skill-cost-text">
      <EnergyCostIcons cost={skill.cost.energy ?? skill.cost} />
      {skill.cost.supportToTrash && (
        <span className="support-to-trash-cost">
          + 棄置 {skill.cost.supportToTrash} 張支援區卡牌
        </span>
      )}
      {(skill.cost.discardHand ?? 0) > 0 && (
        <span className="discard-hand-cost">
          + 棄置 {skill.cost.discardHand} 張手牌
        </span>
      )}
    </span>
  )
}

export function EnergyCostIcons({ cost }: { cost: EnergyCost }) {
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

const effectTokenPattern =
  /(\{[A-Za-z0-9_]+\}|【(?:Equip|On Play|Your Turn|Once Per Turn|Activate|Blocker)】)/gi

const getEffectToken = (part: string) => {
  const braceToken = part.match(/^\{(.+)\}$/)?.[1]
  if (braceToken) return braceToken

  return part.match(/^【(.+)】$/)?.[1]
}

function CardEffectTokenImage({
  token,
  label,
}: {
  token: string
  label: string
}) {
  const [imageFailed, setImageFailed] = useState(false)
  const visual = getCardEffectTokenVisual(token)

  if (!visual || imageFailed) {
    return (
      <span className="inline-skill-label" title={label}>
        {label}
      </span>
    )
  }

  return (
    <span className="inline-skill-label-image" title={label}>
      <img
        className="card-effect-token-image"
        src={visual.imageUrl}
        alt={visual.alt}
        onError={() => setImageFailed(true)}
      />
      <span className="card-effect-token-accessible-label">{label}</span>
    </span>
  )
}

export function CardEffectText({ text }: { text: string }) {
  const parts = text.split(effectTokenPattern)

  return (
    <>
      {parts.map((part, index) => {
        const token = getEffectToken(part)
        const normalizedToken = token
          ? normalizeCardEffectToken(token)
          : undefined
        const energy = token?.match(/^[A-Z]$/) ? energyTokens[token] : undefined
        const label = normalizedToken
          ? getCardEffectTokenLabel(normalizedToken)
          : undefined
        const visual = normalizedToken
          ? getCardEffectTokenVisual(normalizedToken)
          : undefined

        if (energy) {
          return <EnergyIcon key={`${part}-${index}`} energy={energy} />
        }

        if (label !== undefined) {
          if (label === '') return null

          if (visual) {
            return (
              <CardEffectTokenImage
                key={`${part}-${index}`}
                token={normalizedToken ?? token ?? ''}
                label={label}
              />
            )
          }

          return (
            <span className="inline-skill-label" key={`${part}-${index}`}>
              {label}
            </span>
          )
        }

        return part
      })}
    </>
  )
}

export interface CardFaceProps {
  card: GameCard
  className?: string
  concealed?: boolean
  rested?: boolean
  selected?: boolean
  targetable?: boolean
  attackable?: boolean
  ariaPressed?: boolean
  ariaLabel?: string
  onClick?: () => void
}

const cardBackSources = [
  '/card-back.png',
  'https://cookierunbraverse.com/images/card/card-back.png',
] as const

export function CardFace({
  card,
  className = '',
  concealed = false,
  rested = false,
  selected = false,
  targetable = false,
  attackable = false,
  ariaPressed,
  ariaLabel,
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
        }${targetable ? ' is-targetable' : ''}${
          attackable ? ' is-attackable' : ''
        }`}
      >
        {content}
      </div>
    )
  }

  return (
    <button
      className={`card-face ${className}${rested ? ' is-rested' : ''}${
        selected ? ' is-selected' : ''
      }${targetable ? ' is-targetable' : ''}${
        attackable ? ' is-attackable' : ''
      }`}
      type="button"
      title={card.name}
      aria-label={ariaLabel}
      aria-pressed={ariaPressed}
      onClick={onClick}
    >
      {content}
    </button>
  )
}
