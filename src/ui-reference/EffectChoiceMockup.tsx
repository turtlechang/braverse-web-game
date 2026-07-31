import { useEffect, useState } from 'react'
import {
  ArrowRight,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Shield,
  Sparkles,
  Target,
  X,
} from 'lucide-react'
import { convertOfficialCardToGameCard } from '../cards/official-card-adapter'
import { CardEffectText, CardFace, EnergyCostIcons } from '../components/cards/CardVisuals'
import type { GameCard } from '../game'
import { getCardPoolEntry } from '../game/card-pool'
import './EffectChoiceMockup.css'

type VariantKey = 'A' | 'B' | 'C'

const VARIANTS: Array<{ key: VariantKey; title: string; summary: string }> = [
  { key: 'A', title: '選項卡', summary: '推薦：把二選一變成清楚的單選卡片。' },
  { key: 'B', title: '步驟導覽', summary: '以能量、效果、目標三段流程建立方向感。' },
  { key: 'C', title: '雙欄決策板', summary: '桌面版快速比較兩個效果與目前選擇。' },
]

const EFFECT_OPTIONS = [
  {
    label: 'During this turn, your opponent cannot activate Blocker.',
    helper: '本回合對手無法啟動 Blocker。',
    Icon: Shield,
  },
  {
    label: 'Deal 1 damage to 1 opponent Cookie.',
    helper: '選擇 1 個對手餅乾，造成 1 傷害。',
    Icon: Target,
  },
] as const

function createMockupCard(cardNumber: string, instanceSuffix: string): GameCard {
  const entry = getCardPoolEntry(cardNumber)
  if (!entry) throw new Error(`Missing mockup card ${cardNumber}`)

  const conversion = convertOfficialCardToGameCard(entry, instanceSuffix)
  if (conversion.status !== 'converted') {
    throw new Error(`Unsupported mockup card ${cardNumber}`)
  }

  return conversion.gameCard
}

const SOURCE_CARD = createMockupCard('BS3-018', 'mockup-source')
const PAYMENT_CARDS = [
  createMockupCard('BS3-020', 'mockup-payment-1'),
  createMockupCard('BS3-020', 'mockup-payment-2'),
]
const TARGET_CARD = createMockupCard('BS3-017', 'mockup-target')

type VariantAStep = 'energy' | 'choice' | 'target' | 'confirm'

function SourceSummary({ compact = false }: { compact?: boolean }) {
  const sourceText = SOURCE_CARD.item?.text ?? SOURCE_CARD.effectText ?? ''

  return (
    <section className={`effect-choice-source${compact ? ' is-compact' : ''}`}>
      <CardFace card={SOURCE_CARD} className="effect-choice-source-face" />
      <div className="effect-choice-source-copy">
        <span className="effect-choice-card-id">BS3-018 · ITEM</span>
        <h2>{SOURCE_CARD.name}</h2>
        <div className="effect-choice-tags">
          <span>Activate 啟動</span>
          <span>你的回合</span>
        </div>
        {!compact && (
          <p className="effect-choice-source-text">
            <CardEffectText text={sourceText} />
          </p>
        )}
      </div>
    </section>
  )
}

function PaymentSummary({ compact = false }: { compact?: boolean }) {
  return (
    <section className={`effect-choice-payment${compact ? ' is-compact' : ''}`}>
      <div className="effect-choice-section-heading">
        <span className="effect-choice-step-number">1</span>
        <div>
          <strong>能量支付</strong>
          <small>已完成測試支付</small>
        </div>
        <span className="effect-choice-payment-status">
          <Check aria-hidden="true" /> 2／2
        </span>
      </div>
      <div className="effect-choice-payment-body">
        <div className="effect-choice-energy-line">
          <EnergyCostIcons cost={{ red: 2 }} />
          <span>已選 2／2 張能量支援卡</span>
        </div>
        {!compact && (
          <div className="effect-choice-payment-cards" aria-label="已選能量支援卡">
            {PAYMENT_CARDS.map((card) => (
              <div className="effect-choice-payment-card" key={card.instanceId}>
                <CardFace card={card} className="effect-choice-payment-face" selected />
                <strong>{card.name}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    </section>
  )
}

function InteractivePaymentSummary({
  selectedIndexes,
  onToggle,
}: {
  selectedIndexes: Set<number>
  onToggle: (index: number) => void
}) {
  const selectedCount = selectedIndexes.size
  const paymentReady = selectedCount === PAYMENT_CARDS.length

  return (
    <section className="effect-choice-payment effect-choice-payment-interactive">
      <div className="effect-choice-section-heading">
        <span className="effect-choice-step-number">1</span>
        <div>
          <strong>能量支付</strong>
          <small>選擇 2 張能量支援卡後才能下一步。</small>
        </div>
        <span className="effect-choice-payment-status">
          {paymentReady ? <Check aria-hidden="true" /> : <Circle aria-hidden="true" />}
          {selectedCount}／{PAYMENT_CARDS.length}
        </span>
      </div>
      <div className="effect-choice-payment-body">
        <div className="effect-choice-energy-line">
          <EnergyCostIcons cost={{ red: 2 }} />
          <span>已選 {selectedCount}／{PAYMENT_CARDS.length} 張能量支援卡</span>
        </div>
        <div className="effect-choice-payment-cards" aria-label="選擇能量支援卡">
          {PAYMENT_CARDS.map((card, index) => {
            const selected = selectedIndexes.has(index)
            return (
              <button
                className={`effect-choice-payment-card is-interactive${selected ? ' is-selected' : ''}`}
                key={card.instanceId}
                type="button"
                aria-pressed={selected}
                aria-label={`${selected ? '取消' : '選擇'}${card.name}`}
                onClick={() => onToggle(index)}
              >
                <CardFace card={card} className="effect-choice-payment-face" selected={selected} />
                <strong>{card.name}</strong>
                <span className="effect-choice-payment-check" aria-hidden="true">
                  {selected ? <Check /> : <Circle />}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </section>
  )
}

function ChoiceCard({
  index,
  selected,
  onSelect,
  dense = false,
}: {
  index: number
  selected: boolean
  onSelect: () => void
  dense?: boolean
}) {
  const option = EFFECT_OPTIONS[index]
  const { Icon } = option

  return (
    <button
      className={`effect-choice-option${selected ? ' is-selected' : ''}${dense ? ' is-dense' : ''}`}
      type="button"
      aria-pressed={selected}
      onClick={onSelect}
    >
      <span className="effect-choice-option-number">{String(index + 1).padStart(2, '0')}</span>
      <span className="effect-choice-option-icon" aria-hidden="true">
        <Icon />
      </span>
      <span className="effect-choice-option-copy">
        <small>效果 {index + 1}</small>
        <strong>{option.label}</strong>
        <span>{option.helper}</span>
      </span>
      <span className="effect-choice-option-action" aria-hidden="true">
        {selected ? <Check /> : <ArrowRight />}
      </span>
    </button>
  )
}

function MockupFooter({
  selectedMode,
  onCancel,
}: {
  selectedMode: number | null
  onCancel: () => void
}) {
  return (
    <footer className="effect-choice-actions">
      <button className="effect-choice-cancel" type="button" onClick={onCancel}>
        <X aria-hidden="true" />
        取消技能
      </button>
      <button
        className="effect-choice-confirm"
        type="button"
        disabled={selectedMode === null}
      >
        <Check aria-hidden="true" />
        {selectedMode === null ? '請先選擇一項效果' : '確認發動'}
      </button>
    </footer>
  )
}

const VARIANT_A_STEPS: Array<{ key: VariantAStep; label: string }> = [
  { key: 'energy', label: '能量' },
  { key: 'choice', label: '效果' },
  { key: 'target', label: '目標' },
  { key: 'confirm', label: '確認' },
]

function VariantAProgress({
  step,
  targetRequired,
}: {
  step: VariantAStep
  targetRequired: boolean
}) {
  const activeIndex = VARIANT_A_STEPS.findIndex((item) => item.key === step)

  return (
    <nav className="effect-choice-a-progress" aria-label="效果處理步驟">
      {VARIANT_A_STEPS.map((item, index) => {
        const done = index < activeIndex
        const active = index === activeIndex
        const skipped = item.key === 'target' && !targetRequired && activeIndex >= 3
        return (
          <span
            className={`effect-choice-a-progress-step${done ? ' is-done' : ''}${active ? ' is-active' : ''}${skipped ? ' is-skipped' : ''}`}
            key={item.key}
          >
            <span>{skipped ? '—' : index + 1}</span>
            <strong>{item.label}</strong>
          </span>
        )
      })}
    </nav>
  )
}

function VariantAStepFooter({
  step,
  canAdvance,
  onBack,
  onCancel,
  onNext,
}: {
  step: VariantAStep
  canAdvance: boolean
  onBack: () => void
  onCancel: () => void
  onNext: () => void
}) {
  const nextLabel =
    step === 'energy'
      ? '下一步：選擇效果'
      : step === 'choice'
        ? '下一步：繼續'
        : step === 'target'
          ? '確認目標'
          : '完成'

  return (
    <footer className="effect-choice-actions effect-choice-step-actions">
      <button className="effect-choice-cancel" type="button" onClick={onCancel}>
        <X aria-hidden="true" />
        取消技能
      </button>
      {step !== 'energy' && (
        <button className="effect-choice-back" type="button" onClick={onBack}>
          <ChevronLeft aria-hidden="true" />
          上一步
        </button>
      )}
      <button
        className="effect-choice-confirm"
        type="button"
        disabled={!canAdvance}
        onClick={onNext}
      >
        <ArrowRight aria-hidden="true" />
        {nextLabel}
      </button>
    </footer>
  )
}

function TargetSelection({
  selected,
  onSelect,
}: {
  selected: boolean
  onSelect: () => void
}) {
  return (
    <section className="effect-choice-stage-card">
      <div className="effect-choice-stage-title">
        <span className="effect-choice-step-number">3</span>
        <div>
          <strong>選擇目標</strong>
          <small>選擇 1 個對手餅乾造成 1 傷害。</small>
        </div>
      </div>
      <button
        className={`effect-choice-target${selected ? ' is-selected' : ''}`}
        type="button"
        aria-pressed={selected}
        onClick={onSelect}
      >
        <CardFace card={TARGET_CARD} className="effect-choice-target-face" selected={selected} />
        <span>
          <small>對手戰鬥區</small>
          <strong>{TARGET_CARD.name}</strong>
          <span>目前 HP 5 · 可造成 1 傷害</span>
        </span>
        <span className="effect-choice-option-action" aria-hidden="true">
          {selected ? <Check /> : <Target />}
        </span>
      </button>
    </section>
  )
}

function ConfirmSummary({
  selectedMode,
  targetRequired,
}: {
  selectedMode: number
  targetRequired: boolean
}) {
  return (
    <section className="effect-choice-stage-card effect-choice-confirm-stage">
      <div className="effect-choice-stage-title">
        <span className="effect-choice-step-number">4</span>
        <div>
          <strong>確認發動</strong>
          <small>{targetRequired ? '能量、效果與目標都已完成。' : '能量與效果都已完成；此效果不需要目標。'}</small>
        </div>
      </div>
      <div className="effect-choice-confirm-summary">
        <Check aria-hidden="true" />
        <strong>{EFFECT_OPTIONS[selectedMode].label}</strong>
      </div>
    </section>
  )
}

function DialogHeading({ variant }: { variant: VariantKey }) {
  const metadata = VARIANTS.find((item) => item.key === variant) ?? VARIANTS[0]

  return (
    <header className="effect-choice-dialog-heading">
      <div>
        <span className="effect-choice-kicker">UI MOCKUP · BS3-018</span>
        <h1>使用物品 <strong>{SOURCE_CARD.name}</strong></h1>
        <p>{metadata.summary}</p>
        <span className="effect-choice-scope-note">
          僅適用於二選一效果；單一效果維持原先流程
        </span>
      </div>
      <span className="effect-choice-readonly">READ ONLY</span>
    </header>
  )
}

interface VariantProps {
  selectedMode: number | null
  onSelect: (index: number) => void
  onCancel: () => void
}

function VariantA({ selectedMode, onSelect, onCancel }: VariantProps) {
  const [step, setStep] = useState<VariantAStep>('energy')
  const [selectedPaymentIndexes, setSelectedPaymentIndexes] = useState<Set<number>>(new Set())
  const [targetSelected, setTargetSelected] = useState(false)
  const targetRequired = selectedMode === 1
  const paymentReady = selectedPaymentIndexes.size === PAYMENT_CARDS.length
  const choiceReady = selectedMode !== null
  const targetReady = !targetRequired || targetSelected
  const canAdvance =
    step === 'energy'
      ? paymentReady
      : step === 'choice'
        ? choiceReady
        : step === 'target'
          ? targetReady
          : true

  const togglePayment = (index: number) => {
    setSelectedPaymentIndexes((current) => {
      const next = new Set(current)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  const selectMode = (index: number) => {
    setTargetSelected(false)
    onSelect(index)
  }

  const onNext = () => {
    if (!canAdvance) return
    if (step === 'energy') {
      setStep('choice')
    } else if (step === 'choice') {
      setStep(targetRequired ? 'target' : 'confirm')
    } else if (step === 'target') {
      setStep('confirm')
    }
  }

  const onBack = () => {
    if (step === 'choice') setStep('energy')
    else if (step === 'target') setStep('choice')
    else if (step === 'confirm') setStep(targetRequired ? 'target' : 'choice')
  }

  const reset = () => {
    setStep('energy')
    setSelectedPaymentIndexes(new Set())
    setTargetSelected(false)
    onCancel()
  }

  return (
    <section className="effect-choice-dialog effect-choice-variant-a">
      <DialogHeading variant="A" />
      <SourceSummary compact />
      <VariantAProgress step={step} targetRequired={targetRequired} />
      <div className="effect-choice-a-stage-body">
        {step === 'energy' && (
          <InteractivePaymentSummary
            selectedIndexes={selectedPaymentIndexes}
            onToggle={togglePayment}
          />
        )}
        {step === 'choice' && (
          <section className="effect-choice-stage-card">
            <div className="effect-choice-stage-title">
              <span className="effect-choice-step-number">2</span>
              <div>
                <strong>選擇一項效果</strong>
                <small>以下只能選一項；選擇後再進入下一步。</small>
              </div>
            </div>
            <div className="effect-choice-options effect-choice-options-stacked">
              {EFFECT_OPTIONS.map((_, index) => (
                <ChoiceCard
                  key={index}
                  index={index}
                  selected={selectedMode === index}
                  onSelect={() => selectMode(index)}
                />
              ))}
            </div>
          </section>
        )}
        {step === 'target' && (
          <TargetSelection
            selected={targetSelected}
            onSelect={() => setTargetSelected((current) => !current)}
          />
        )}
        {step === 'confirm' && selectedMode !== null && (
          <ConfirmSummary selectedMode={selectedMode} targetRequired={targetRequired} />
        )}
      </div>
      <VariantAStepFooter
        step={step}
        canAdvance={canAdvance}
        onBack={onBack}
        onCancel={reset}
        onNext={onNext}
      />
    </section>
  )
}

function StepRail({ selectedMode }: { selectedMode: number | null }) {
  return (
    <aside className="effect-choice-step-rail" aria-label="效果處理步驟">
      <span className="effect-choice-rail-label">效果處理步驟</span>
      <div className="effect-choice-rail-step is-done">
        <span>1</span>
        <strong>能量</strong>
        <Check aria-hidden="true" />
      </div>
      <div className="effect-choice-rail-connector" />
      <div className={`effect-choice-rail-step${selectedMode === null ? ' is-active' : ' is-done'}`}>
        <span>2</span>
        <strong>效果</strong>
        {selectedMode !== null && <Check aria-hidden="true" />}
      </div>
      <div className="effect-choice-rail-connector" />
      <div className="effect-choice-rail-step is-pending">
        <span>3</span>
        <strong>目標</strong>
      </div>
    </aside>
  )
}

function VariantB({ selectedMode, onSelect, onCancel }: VariantProps) {
  return (
    <section className="effect-choice-dialog effect-choice-variant-b">
      <DialogHeading variant="B" />
      <div className="effect-choice-step-layout">
        <StepRail selectedMode={selectedMode} />
        <div className="effect-choice-step-content">
          <SourceSummary compact />
          <PaymentSummary compact />
          <section className="effect-choice-step-choice">
            <div className="effect-choice-step-choice-heading">
              <span>STEP 2</span>
              <h2>現在選擇效果</h2>
              <p>先把兩個可能結果攤開比較，再進入下一個處理步驟。</p>
            </div>
            <div className="effect-choice-options effect-choice-options-stacked">
              {EFFECT_OPTIONS.map((_, index) => (
                <ChoiceCard
                  key={index}
                  index={index}
                  selected={selectedMode === index}
                  onSelect={() => onSelect(index)}
                />
              ))}
            </div>
          </section>
        </div>
      </div>
      <MockupFooter selectedMode={selectedMode} onCancel={onCancel} />
    </section>
  )
}

function VariantC({ selectedMode, onSelect, onCancel }: VariantProps) {
  return (
    <section className="effect-choice-dialog effect-choice-variant-c">
      <DialogHeading variant="C" />
      <SourceSummary />
      <PaymentSummary />
      <section className="effect-choice-board">
        <div className="effect-choice-board-heading">
          <div>
            <span className="effect-choice-kicker">STEP 2 · CHOOSE ONE</span>
            <h2>你要讓這張物品卡做什麼？</h2>
          </div>
          <span className="effect-choice-board-limit">1 項效果</span>
        </div>
        <div className="effect-choice-options effect-choice-options-columns">
          {EFFECT_OPTIONS.map((_, index) => (
            <ChoiceCard
              key={index}
              index={index}
              selected={selectedMode === index}
              onSelect={() => onSelect(index)}
              dense
            />
          ))}
        </div>
        <div className={`effect-choice-selected-summary${selectedMode === null ? '' : ' is-ready'}`}>
          <Circle aria-hidden="true" />
          <span>
            {selectedMode === null
              ? '尚未選擇。點選其中一張效果卡。'
              : `已選擇效果 ${selectedMode + 1}：${EFFECT_OPTIONS[selectedMode].helper}`}
          </span>
        </div>
      </section>
      <MockupFooter selectedMode={selectedMode} onCancel={onCancel} />
    </section>
  )
}

function MockupSwitcher({
  variant,
  onChange,
}: {
  variant: VariantKey
  onChange: (next: VariantKey) => void
}) {
  const currentIndex = VARIANTS.findIndex((item) => item.key === variant)
  const step = (delta: number) => {
    const nextIndex = (currentIndex + delta + VARIANTS.length) % VARIANTS.length
    onChange(VARIANTS[nextIndex].key)
  }

  return (
    <nav className="effect-choice-switcher" aria-label="切換 UI mockup 版本">
      <button type="button" aria-label="上一個 mockup" onClick={() => step(-1)}>
        <ChevronLeft aria-hidden="true" />
      </button>
      <span>
        <small>MOCKUP VARIANT</small>
        <strong>{variant} · {VARIANTS[currentIndex].title}</strong>
      </span>
      <button type="button" aria-label="下一個 mockup" onClick={() => step(1)}>
        <ChevronRight aria-hidden="true" />
      </button>
    </nav>
  )
}

function readVariant(): VariantKey {
  const queryVariant = new URLSearchParams(window.location.search).get('variant')
  return queryVariant === 'A' || queryVariant === 'B' || queryVariant === 'C'
    ? queryVariant
    : 'A'
}

/** dev server 開 /?mockup=effect-choice；僅供二選一效果提示框研究。 */
export function EffectChoiceMockup() {
  const [variant, setVariant] = useState<VariantKey>(readVariant)
  const [selectedMode, setSelectedMode] = useState<number | null>(null)

  const changeVariant = (next: VariantKey) => {
    setVariant(next)
    setSelectedMode(null)
    const url = new URL(window.location.href)
    url.searchParams.set('variant', next)
    window.history.replaceState({}, '', url)
  }

  useEffect(() => {
    document.querySelector<HTMLElement>('.effect-choice-mockup')?.scrollTo({
      top: 0,
      behavior: 'auto',
    })

    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]')) return
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return

      event.preventDefault()
      const currentIndex = VARIANTS.findIndex((item) => item.key === variant)
      const delta = event.key === 'ArrowLeft' ? -1 : 1
      const nextIndex = (currentIndex + delta + VARIANTS.length) % VARIANTS.length
      changeVariant(VARIANTS[nextIndex].key)
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [variant])

  const onCancel = () => setSelectedMode(null)
  const props = { selectedMode, onSelect: setSelectedMode, onCancel }

  return (
    <main className="effect-choice-mockup tactical-surface">
      <div className="effect-choice-mockup-content">
        <div className="effect-choice-prototype-label">
          <Sparkles aria-hidden="true" />
          Prototype · 二選一效果提示框
        </div>
        {variant === 'A' && <VariantA {...props} />}
        {variant === 'B' && <VariantB {...props} />}
        {variant === 'C' && <VariantC {...props} />}
      </div>
      <MockupSwitcher variant={variant} onChange={changeVariant} />
    </main>
  )
}

export default EffectChoiceMockup
