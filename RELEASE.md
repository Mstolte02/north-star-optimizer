# Release verification — 2026-10-10

## Completed

- Standalone React/TypeScript/Vite application; Penny Pilot was not accessed or changed.
- Pure client-side calculation engine and worker-based bounded optimizer.
- Thirteen goals, ordered priorities, locks/ranges, conflict explanations and feasible alternatives.
- Interactive cash, equity, mortgage and net-worth projections with an accessible month inspector.
- Default household summary profile, inclusion controls, scheduled payments, editable assumptions and alternative salaries.
- Browser-local scenarios, naming/duplication/deletion/preference, comparison, versioned JSON and opt-in financial share links.
- GitHub Pages base path and automatic validation/deployment workflow for main.
- **38 tests pass**: 33 engine/accounting/persistence tests and 5 UI/accessibility interaction tests.
- Lint passes; TypeScript and production build pass.
- Independent Decimal annuity check and iterative amortization reconciliation.
- Cash and net-worth chart reconciliation at closing and later horizons.
- Automated axe DOM checks pass; color contrast is excluded from axe's jsdom check. Text contrast against ivory: navy 14.63:1, teal 5.40:1, stone 5.58:1, accessible copper text 4.93:1. Original copper remains for decorative/milestone marks.

## Publication

Repository: https://github.com/Mstolte02/north-star-optimizer

The source is published to main. GitHub Actions run 38010765989 (attempt 2) passed lint, all 38 tests, TypeScript, the production build and GitHub Pages deployment.

Live site: https://mstolte02.github.io/north-star-optimizer/

Live browser checks confirmed the default optimizer result, goal changes, priority reordering, salary locks and scenario persistence across reload. Desktop viewport 1363px had no horizontal overflow (document width 1348px). A deployment screenshot is saved in docs/north-star-live.jpg. No application-origin console errors were observed; browser extension metadata errors were unrelated to the app. Actual iPhone rendering and browser reduced-motion rendering remain unverified.

A competing branch-based Pages deployment subsequently published the source HTML and caused a blank page. The compiled artifact was redeployed, and the repository owner switched Pages Source to GitHub Actions. This documentation update also verifies that subsequent main pushes use the intended workflow.

Dependency audit after updating Vitest to 5.0.3: zero reported vulnerabilities.

## Material planning limitations

- Income uses a calibrated marginal retention ratio, not tax tables. Filing status is descriptive.
- Federal debt paydown assumes zero interest and no forgiveness; modeled payments stop as principal is repaid. Parent PLUS is excluded from legal net worth and DTI.
- Solver recommendations are best among sampled candidates, not certified global optima. No feasible sampled path is not a mathematical proof of impossibility.
- Appreciation, future salaries, returns and inflation are explicit assumptions.
- Ownership break-even excludes selling costs and tax benefits.
- Saved scenarios stay in the current browser; contribution caps exclude unallocated surplus from projected assets.
