# Lesson Studio — design direction

The lesson workspace (`#/learn/g/:g/c/:c/s/:s`) is a **studio**: one calm command bar on top and
up to four glass panels underneath that the teacher arranges like instruments on a desk.
It reuses the Aurora Lab tokens (`--lt-*`, `src/learn/learnTheme.css`) and never hardcodes
theme-specific colours: every tint is `color-mix()` of a token, so dark neon, paper, chalk
and high-contrast all work.

## Principles
- **Calm and spacious.** 12 / 16 / 20 px spacing rhythm, 14–16 px radii on controls, `--lt-radius`
  (16) on panels, `--lt-radius-lg` on fullscreen sheets. One accent gradient (`--lt-grad-primary`)
  is reserved for the single primary action on screen («Завершить урок») and for selected state.
- **Layered glass.** Page glow → panel (`--lt-surface` + blur) → panel head (tone wash) →
  cards (`--lt-surface-2`) → inputs (`--lt-surface-3`). Never more than three layers deep.
- **Per-panel tone.** Each panel root sets `--studio-tone` (and `--studio-tone-2` for gradients):
  cockpit = violet (`--lt-primary-2`), 3D = cyan (`--lt-accent-cyan`), work zone = amber
  (`--lt-accent-amber`), AI teacher = pink → primary (`--lt-accent-pink`). Kit primitives read the
  tone for icon tiles, active segments, focus rings and the 2 px top edge — so a control looks
  “at home” inside any panel without extra classes.
- **Type scale (px, root rem ≈ 9 px):** 12 caption · 13 body-small · 14 body · 16 title · 20 display.
  Nothing below 11 px. Long Russian / Uzbek labels wrap with `overflow-wrap: anywhere` +
  `hyphens: manual` — no mid-word cuts; titles use ellipsis with the full text in `title`.
- **Obvious states.** hover (surface-hover + 1 px lift), pressed (`aria-pressed` → tone wash +
  inset ring), selected (gradient + check badge), disabled (0.5 opacity, no lift), loading
  (skeleton shimmer), focus (`--lt-ring`, always visible for keyboard).
- **Subtle motion.** 150–220 ms, `--lt-ease`; panels slide/fade in, presets cross-fade;
  everything collapses to 0 ms under `prefers-reduced-motion`.
- **Touch first.** ≥ 44 px targets on touch/phone, bottom tab bar with safe-area padding,
  header actions collapse into an overflow sheet ≤ 720 px.
- **Keyboard visible.** Shortcuts are shown as small `kbd` hints on the controls themselves:
  `1 2 3` panels · `B` board · `F` fullscreen focused panel · `Esc` collapse · `?` help.

## Files
- `StudioKit.module.css` — token-only primitives (panel, panelHead, iconTile, buttons, segmented,
  tabs, chips, cards, fields, kbd, badge, stat, stepper, emptyState, skeleton, scrollArea, srOnly).
- `StudioKit.tsx` — thin React helpers: `kit`, `StudioPanelHead`, `Kbd`, `StudioEmptyState`, `studioToneStyle`.
- `StudioShell.module.css` — the lesson shell itself: command bar, presets, panel switch,
  resizers, mobile tab bar, overflow sheet, shortcuts popover, done card.
- `studioLayout.ts` — presets, column width model and localStorage persistence (try/catch).
- `useStudioShortcuts.ts`, `StudioResizer.tsx`, `StudioControls.tsx`, `StudioShortcuts.tsx`.

## Layout presets
«Урок» all panels · «Тест» cockpit + work zone · «3D» cockpit + 3D · «ИИ» cockpit + AI ·
«Доска» = presentation mode. Presets only call the runner's existing `showPanel / hidePanel /
setPresentationMode`; the active preset is derived from state, so the old toggles still work.
