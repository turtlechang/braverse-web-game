import { useEffect, useRef } from 'react'

/** Focus management for dismissible information dialogs, not board target decisions. */
export function useModalFocus(onClose: () => void, returnFocusSelector?: string) {
  const modalRef = useRef<HTMLElement>(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])

  useEffect(() => {
    const modal = modalRef.current
    if (!modal) return
    const previousFocus = document.activeElement
    const fallbackFocus = returnFocusSelector
      ? document.querySelector<HTMLElement>(returnFocusSelector)
      : null
    const inertSiblings: Array<{ element: HTMLElement; wasInert: boolean }> = []
    let branch: HTMLElement = modal
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children) {
        if (!(sibling instanceof HTMLElement) || sibling === branch) continue
        inertSiblings.push({ element: sibling, wasInert: sibling.inert })
        sibling.inert = true
      }
      branch = branch.parentElement
      if (branch === document.body) break
    }
    const focusable = () => Array.from(modal.querySelectorAll<HTMLElement>(
      'button:not([disabled]), a[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
    )).filter((element) => !element.closest('[hidden], [inert], [aria-hidden="true"]') &&
      getComputedStyle(element).display !== 'none' && getComputedStyle(element).visibility !== 'hidden')
    const topmost = () => Array.from(document.querySelectorAll('[role="dialog"][aria-modal="true"]')).at(-1) === modal
    const focusStart = () => {
      const preferred = modal.querySelector<HTMLElement>('[data-modal-initial-focus]')
      ;(preferred ?? focusable()[0] ?? modal).focus()
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (!topmost()) return
      if (event.key === 'Escape') {
        event.preventDefault()
        event.stopPropagation()
        closeRef.current()
      } else if (event.key === 'Tab') {
        const elements = focusable()
        const first = elements[0] ?? modal
        const last = elements.at(-1) ?? modal
        if (elements.length === 0 || !modal.contains(document.activeElement) ||
          (event.shiftKey ? document.activeElement === first : document.activeElement === last)) {
          event.preventDefault()
          ;(event.shiftKey ? last : first).focus()
        }
      }
    }
    const onFocusIn = (event: FocusEvent) => {
      if (topmost() && event.target instanceof Node && !modal.contains(event.target)) focusStart()
    }
    focusStart()
    document.addEventListener('keydown', onKeyDown, true)
    document.addEventListener('focusin', onFocusIn)
    return () => {
      document.removeEventListener('keydown', onKeyDown, true)
      document.removeEventListener('focusin', onFocusIn)
      for (const { element, wasInert } of inertSiblings) element.inert = wasInert
      if (previousFocus instanceof HTMLElement && previousFocus !== document.body && previousFocus.isConnected) previousFocus.focus()
      else if (fallbackFocus?.isConnected) fallbackFocus.focus()
    }
  }, [returnFocusSelector])
  return modalRef
}
