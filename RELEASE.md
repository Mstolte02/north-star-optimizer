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

The source is published to main. GitHub Actions run 38010625474 passed lint, all 38 tests, TypeScript and the production build. It stopped at configure-pages because Pages is not enabled. Select Settings → Pages → Build and deployment → Source → GitHub Actions, then rerun the workflow. Public deployment and real desktop/iPhone rendering remain unverified.

Expected Pages URL: https://mstolte02.github.io/north-star-optimizer/

## Material planning limitations

- Income uses a calibrated marginal retention ratio, not tax tables. Filing status is descriptive.
- Federal debt paydown assumes zero interest and no forgiveness; modeled payments stop as principal is repaid. Parent PLUS is excluded from legal net worth and DTI.
- Solver recommendations are best among sampled candidates, not certified global optima. No feasible sampled path is not a mathematical proof of impossibility.
- Appreciation, future salaries, returns and inflation are explicit assumptions.
- Ownership break-even excludes selling costs and tax benefits.
- Saved scenarios stay in the current browser; contribution caps exclude unallocated surplus from projected assets.
