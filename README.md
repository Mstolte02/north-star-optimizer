# North Star

**Pick one goal. See what it takes.**

North Star is a free, private home-buying planner. Choose the outcome that matters most — a home price, a purchase date, a monthly housing cost, a savings cushion — rank your priorities, and North Star searches thousands of combinations to show the changes that get you there inside your limits.

Everything runs in your browser. There are no accounts, bank connections, servers or analytics.

Live site: https://mstolte02.github.io/north-star-optimizer/

## How it works

1. **Setup** — four quick questions: income, spending, savings and the home you want. Example numbers are filled in; replace them with yours.
2. **Plan** — pick a goal and see the best plan that fits, what has to change, and a month-by-month projection of cash, equity, mortgage and net worth.
3. **Priorities** — rank what matters (need less extra income, buy sooner, keep flexible spending, keep more cash, keep housing costs low) and choose which numbers the planner may change.
4. **Explore** — alternative paths, salary and price thresholds, sensitivity checks and the full arithmetic.
5. **Assumptions** — every input, grouped into income, spending and debt, home and mortgage, savings and investing, and your limits.
6. **Scenarios** — save, compare, export, import and share plans. Goal-only share links leave your numbers out.

### Goals

Buy at a set price · keep housing under a monthly cost · buy by a date · save a set amount now · keep saving after buying · reach a take-home income · find the salary you need · make a set down payment · keep cash after closing · keep an emergency fund · reach a net worth · beat renting within a time · find the highest rate you can handle.

### The money model

You enter one total for monthly spending. Rent, flexible spending (dining, shopping, fun) and debt payments are parts of that total, so nothing is counted twice. A future debt payment — for example a student loan leaving deferment — can start on a later month. After you buy, rent drops out and the full cost of owning replaces it: mortgage, property tax, insurance, PMI, HOA, upkeep and extra utilities.

Income changes use a simple "share of a raise you keep after tax" estimate. It is not a tax calculation. Interest rates, raises, returns, home value growth and inflation are your inputs; the planner never changes them unless you make them flexible.

North Star is a planning tool, not financial advice.

## Run locally

Requires Node 22+.

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
```

The dev URL includes `/north-star-optimizer/`, matching the GitHub Pages base path. Production files are in `dist/`.

## Deploy

`.github/workflows/pages.yml` runs lint, tests and the TypeScript build on every push and pull request. Pushes to `main` publish to GitHub Pages. In **Settings → Pages**, the source must be **GitHub Actions**.

## Architecture

- `src/model.ts` — scenario schema (version 2), goals, priorities and example defaults
- `src/engine.ts` — pure financial calculations and the bounded optimizer
- `src/optimizer.worker.ts` — runs the optimizer off the main thread
- `src/persistence.ts` — validation, browser storage, JSON import/export, share links, and migration of version 1 scenarios
- `src/App.tsx` — pages and controls
- `src/SetupWizard.tsx` — first-run setup
- `src/Chart.tsx` — interactive projection chart
- `src/Icon.tsx` — inline icon set
- `src/engine.test.ts`, `src/ui.test.tsx` — math, persistence, interaction and axe accessibility tests

See [CALCULATIONS.md](CALCULATIONS.md) for formulas and limits.

## Privacy

Saved scenarios live only in this browser and do not sync between devices. JSON exports contain your numbers; keep them private. Full-scenario share links can be read by anyone who has the link. Fonts load from Google Fonts with system fallbacks; no financial values are sent anywhere.
