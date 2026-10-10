# Release notes

## 2.3 — wizard first (2026-10-09)

- The app opens on the setup wizard alone: no landing page, menus or answer until the questions are done.
- The wizard now has seven steps: question, income, spending (including flexible spending), savings, home, what matters most (tap to rank), and what you are willing to change.
- Returning visitors also start in the wizard with their answers filled in and a Skip to my plan link.

## 2.2 — plan wizard (2026-10-09)

- Results is now a four-step wizard: Your answer, Pick a path, Fine-tune, Your plan.
- Sliders edit a draft with a live one-line preview; the chart and options only change after Apply changes.
- New final action plan: target date, monthly saving target, cash needed at closing, savings milestones, a checklist, Save and Print.
- The working plan is kept across reloads, separate from the setup answers.
- Notices close on their own after four seconds.

## 2.1 — guided journey (2026-10-09)

- New landing page that states the value in one line.
- Setup starts with four plain question cards; the home step only asks what that question needs.
- New answer page: a one-sentence verdict, "ways to get there" cards with plain changes and a "Choose this path" button, and live sliders.
- Navigation is now Your answer · Advanced · Saved. Goal, Priorities, Explore and Assumptions moved under Advanced.
- Fixed horizontal overflow on Explore and Priorities at phone width.
- Checks: 54 tests pass; lint, TypeScript and build pass; browser-checked at 375 px and 1280 px, light and dark.

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
