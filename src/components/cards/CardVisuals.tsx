import { useState } from 'react'
import type { CardSkill, EnergyCost, GameCard } from '../../game'
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
  return <EnergyCostIcons cost={skill.cost} />
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

export function CardEffectText({ text }: { text: string }) {
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

export interface CardFaceProps {
  card: GameCard
  className?: string
  concealed?: boolean
  rested?: boolean
  selected?: boolean
  targetable?: boolean
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
