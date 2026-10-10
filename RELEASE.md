# Release notes

## 2.0 — general-audience redesign (2026-10-09)

- Removed the single-household profile. Defaults are now generic example numbers for a renter saving for a $300,000 home, and setup tells people to replace them.
- Replaced named household loans (primary federal, partner federal, Parent PLUS, medication, dining) with general fields: flexible spending, current debt and a new debt that starts later. Removed the descriptive filing status and state/local tax fields.
- Scenario schema is now version 2. Version 1 saves, imports and links migrate automatically.
- Default priority order now puts "need less extra income" first, so the first suggestion is a realistic plan instead of a large raise plus a 40% down payment.
- New look: Inter type, card layout, dark hero for the goal, status chips, a "what changes" checklist, icon navigation (bottom tab bar on phones), light and dark themes.
- Plain-language labels and goal names throughout.
- Checks: 43 tests pass (35 engine/persistence, 8 UI/accessibility), lint and TypeScript pass. Browser-checked at desktop and 375 px, light and dark, with no horizontal overflow and no console errors.

## 1.0 — initial release

Static React/TypeScript/Vite planner with a worker-based optimizer, thirteen goals, ranked priorities, locks and ranges, projections, scenarios and GitHub Pages deployment.
