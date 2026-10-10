# North Star

**Your goals. Your priorities. Your path.**

A standalone, static financial planning studio built with React, TypeScript and Vite. It has no relationship to the Penny Pilot source repository, no bank connections, database, authentication or analytics. All calculations run in the browser; optimization runs in a Web Worker.

## Run

Requires Node 22+.

```sh
npm ci
npm run dev
npm test
npm run lint
npm run build
```

Development URL includes `/north-star-optimizer/`. Production files are in `dist/`. Vite's base path is `/north-star-optimizer/` for project-level GitHub Pages. Navigation stays on a single static document; scenario links use the URL fragment.

## GitHub Pages

The included `.github/workflows/pages.yml` validates lint, tests and TypeScript before deployment. Pushes to `main` publish automatically; pull requests run validation only.

1. Create a public repository named `Mstolte02/north-star-optimizer`.
2. Push this checkout to its `main` branch.
3. In repository **Settings → Pages**, select **GitHub Actions** as the source.
4. Run the workflow, or push a new commit.
5. Confirm the successful `github-pages` deployment and visit `https://mstolte02.github.io/north-star-optimizer/`.

This URL is the expected URL, not evidence that a deployment has occurred. See RELEASE.md for the actual verification state.

## Planning experience

First visits begin with a four-step setup wizard (income, spending, savings cushion, home goal). Starting plans are validated and remembered in browser-local storage; saved scenarios use their existing storage and remain available. Shared scenario links open directly into the planner. Setup can be revisited from Assumptions without changing the plan until completion.

The workspace is split into **Plan** (goal, results, projection), **Priorities** (ranking, locks and ranges), **Explore** (paths, thresholds, arithmetic and sensitivities), **Assumptions** (editable financial details), and **Scenarios** (saving, comparison and transfer). Calculation methodology is available in the footer.

- Thirteen selectable goals, including house price, monthly savings, purchase deadline, required salary, reserves, net worth and tolerable interest rate.
- Hard housing, reserve, savings and DTI requirements; explicit locks and ranges for six supported optimization levers.
- Five ranked preferences with editable tolerances, desktop dragging and touch/keyboard-friendly reorder buttons.
- Feasible alternative paths, loan amortization, closing cash, salary thresholds, sensitivity analysis and interactive trajectories.
- Saved/named/duplicated/preferred scenarios, side-by-side comparison, versioned JSON imports/exports, goal-only links and explicit opt-in full-scenario links.
- Ivory, navy, teal, sage and copper design; editorial serif and sans-serif pairing, responsive layout, reduced-motion support.

## Summary profile and privacy

Defaults use the explicitly authorized summary figures: $70,000/$45,000 salary, $7,399 household monthly take-home, $6,726 spending, $5,700 savings and a $400,000 home goal. The $85,000/$47,000 alternative is available with one button. These summary defaults will be visible in public source and to site visitors. No accounts, transaction exports, credentials, addresses or private institution information are included.

The spending baseline includes the $298.67 primary federal payment, $500 medication component and, as a visible initial assumption, the $745.88 Parent PLUS contribution. The $250 future partner federal payment is separate, starting at month 24. Inclusion toggles prevent double counting. Editing included spending components changes the total baseline by the delta. Completed treatment has no future cash obligation. Parent PLUS is cash flow only, excluded from household legal-debt balances and modeled DTI; other-parent loans are excluded.

An unchanged profile reproduces **$673/month**, dropping to **$423/month** when the future $250 payment activates. The 6.5% rate, 1% annual property tax, $150 insurance, 0.5% PMI, $1,826 rent, 3% cash interest, $2,000 moving cost, June 2029 timing, $20,000 reserve and $750 monthly savings floor are configurable planning assumptions, not verified quotes or forecasts.

## Mathematics and limitations

See [CALCULATIONS.md](CALCULATIONS.md) for formulas, independently verified cases and solver limitations. Income is calibrated to supplied take-home and uses an editable marginal retention ratio. Filing status is descriptive; there is no tax-table engine. Additional retirement and benefit inputs are deductions beyond the supplied net baseline. State/local tax edits adjust net relative to previous assumptions.

The optimizer searches explicitly permitted ranges using a finite deterministic grid and salary bisection, then ranks feasible candidates lexicographically. It never silently adjusts growth, taxes, inflation, returns or appreciation. A missing path is not a proof that no feasible point exists between samples. Salary-only thresholds can exceed permitted optimization bounds and are labeled separately.

Net worth includes home equity, cash and modeled investments, less household federal balances. Initial federal-loan principal paydown assumes zero interest and no forgiveness; modeled federal payments stop as that zero-interest principal is repaid. Parent PLUS balance is contextual and does not become household legal debt. Ownership break-even includes rent-versus-owner costs and forgone cash interest, but excludes selling costs and tax benefits. It is measured after closing.

## Architecture

- `src/model.ts`: versioned profile, goal and constraint definitions
- `src/engine.ts`: pure financial calculations and optimization
- `src/optimizer.worker.ts`: browser worker isolation
- `src/persistence.ts`: validation, storage, imports and links
- `src/App.tsx`: objectives, priorities, assumptions and scenarios
- `src/Chart.tsx`: interactive financial trajectory
- `src/engine.test.ts`: mathematical and persistence regressions
- `src/ui.test.tsx`: accessible controls, scenarios and automated axe checks

Browser storage does not sync across devices. JSON exports include financial assumptions; keep them private. Goal-only links omit the household profile; full links are readable by anyone with the link. Fonts load from Google Fonts with local fallbacks; financial values never enter those font requests.
