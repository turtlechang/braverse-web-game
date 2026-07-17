# Main menu heading design QA

## Source visual truth

- Source: `C:\Users\WH3FTURTLE\Downloads\CookieRun_BRAVERSE_CT-01.png`
- Note: the supplied file is AVIF data with a `.png` extension; it was decoded only for visual comparison. The implementation intentionally uses HTML text and CSS rather than placing the source image in the app.

## Implementation evidence

- URL: `http://127.0.0.1:5173/`
- Screenshot: `C:\Users\WH3FTURTLE\Documents\braverse-web-game\test-results\design-qa\main-menu-heading-text-implementation.png`
- Focused comparison: `C:\Users\WH3FTURTLE\Documents\braverse-web-game\test-results\design-qa\comparison-source-vs-text-implementation.png`
- Viewport: 1280 × 720
- State: main menu with two saved decks visible; no modal open.

## Comparison

- Full view: the styled text heading replaces the former plain title in the left heading column without changing the existing menu actions, deck management, or footer regions.
- Focused region: the source logo is shown beside the rendered text heading in the comparison image. The Chinese title stacking, gold fill, dark brown outline, brown `BRAVERSE` badge, and centered hierarchy are preserved with editable HTML text.
- Responsive check: at 600 × 338 there was no horizontal or vertical document overflow; the text remained inside the main menu shell.
- Interaction check: `對戰入口` and `線上對戰` remain present and actionable in the DOM snapshot; no console errors were captured.

## Findings

No actionable P0/P1/P2 visual differences found. The source is a standalone logo while the implementation places the matching text treatment on the existing Braverse menu background, which is the intended product context.

## Comparison history

1. Initial comparison established the source palette, stacked title hierarchy, outline, and `BRAVERSE` badge proportions.
2. Post-fix comparison confirms the same visual direction using editable HTML text, with no remaining P0/P1/P2 findings.

## Implementation checklist

- [x] Use editable text rather than placing the supplied logo image in the app.
- [x] Keep an accessible `h1` with a descriptive `aria-label`.
- [x] Preserve existing menu actions and deck-management behavior.
- [x] Verify desktop and compact viewport layout.
- [x] Check console errors and targeted component tests.

final result: passed

## Guided effect prompt QA (2026-07-17)

- Scope: ST3-019 support-area trash selection, BS2-021 target overflow, confirm-only action alignment, and BS2-044 optional attack integration.
- Shared prompt: BS2-044 was exercised at `http://127.0.0.1:5173/?test-state=blue-attack-payable`; the payment and target controls stayed inside one `.modal-backdrop`, and the prompt disappeared after confirmation without opening a nested modal.
- Interaction: the optional attack flow accepted two hand-card costs plus one opponent target, while the confirm control remained disabled until all required selections were complete.
- Layout: trap target choices now use a wrapping, vertically scrollable grid; confirm-only effect actions use a compact right-aligned button while multi-action prompts retain their paired action layout.

final result: passed
