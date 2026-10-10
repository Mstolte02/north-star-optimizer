# Financial calculation notes

## Mortgage

For loan L, monthly rate r = annualRate / 1200 and n = termYears × 12:

`payment = L × r / (1 − (1 + r)^−n)`

At zero interest, `payment = L / n`. The scheduled balance is computed in closed form and checked against month-by-month amortization. After the final payment, principal and interest are zero.

- $360,000 loan, 6.5%, 30 years → **$2,275.444884574669** monthly P&I.
- $120,000 loan, 0%, 10 years → **$1,000** monthly; $84,000 after 36 payments.
- Example defaults: $300,000 home, 10% down, 3% closing, $2,000 moving → **$41,000** cash at closing.
- Initial PMI: 0.5% × $270,000 / 12 → **$112.50/month**. At 20% down there is no PMI. PMI ends when the scheduled balance reaches 78% of the original price, as on a conventional loan in good standing. Lender rules differ.

Reference: [Consumer Financial Protection Bureau — PMI termination](https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/).

The P&I value was reproduced independently with 45-digit Decimal arithmetic. Balance tests use an iterative recurrence, not the closed-form function.

## Cash flow and reserves

Before purchase: `take-home − spending − investing`.

After purchase: subtract the full cost of owning and remove rent. Owning includes P&I, property tax, insurance, PMI, HOA, upkeep and extra utilities.

Spending is one total. Rent, flexible spending and current debt payments are parts of it and are never added again. Changing a part changes the total by the same amount. If the total is smaller than its parts, the plan is flagged as infeasible.

- **Flexible spending** can move to a planned amount from a chosen month. The planner may lower it inside the range you allow.
- **Current debt** is paid down at its monthly payment with zero interest. The payment stops when the balance reaches zero.
- **New debt** (for example a loan leaving deferment) is added from its start month and paid down the same way.

Inflation applies to lifestyle spending and rent, not to fixed debt payments. Emergency cash = the larger of the dollar reserve and emergency months × monthly living costs after purchase. Negative cash flow reduces savings; it is never clamped to zero.

Income changes use `annual salary change × share kept / 1200`. Scheduled raises start on their month; growth is explicit. This is a planning estimate, not a tax calculation.

Cash follows `cash[m+1] = cash[m] × (1 + cash rate / 1200) + contribution[m]`, then the closing withdrawal at purchase. A positive saving limit caps contributions; surplus above it is treated as spent. A limit larger than available cash flow is flagged.

## Thresholds

Salary thresholds use bisection to the dollar at the entered purchase month, price and down payment. "Lowest salary that works" sets the cash reserve, emergency months and post-purchase saving floor to zero but keeps every other limit. "Comfortable salary" keeps them. If salary alone cannot satisfy a limit (for example a housing cap), the result is "Salary alone can't fix it".

For constant monthly saving C at rate r over n months:

`futureCash = startingCash × (1 + r)^n + C × ((1 + r)^n − 1) / r`.

At zero interest with the example defaults, the required monthly saving is `(41,000 + 10,000 − 20,000) / 24 = $1,291.67`.

"Most home you can afford" uses bisection on price at the entered income and date, including closing cash and full housing costs.

## Search and priorities

Every candidate is checked against your limits and goal. Locked numbers never change. The grid covers 13 prices, 10 down payments, 5 flexible-spending levels, 9 purchase months, and 17 rates when rate is the goal, plus the entered values and any deadline. Salary is solved by bisection inside its allowed range. A fixed-dollar down payment requires the down payment lever to be locked.

The goal's own value is ranked first (largest sampled price for housing-cost and keep-saving goals, lowest salary, or highest rate). Then priorities are compared in order, in steps the size of each tolerance, followed by exact tie-breaks. The default order is: need less extra income, buy sooner, keep flexible spending, keep more cash, keep housing costs low.

The top path is the best of the tested candidates under this ranking. It is not a proof of a global best. Alternative paths hold different numbers fixed and only appear if they pass every limit and differ from earlier paths.

## Net worth and break-even

Net worth = cash + investments + home equity − unpaid debt. No selling costs, tax benefits or loan forgiveness are modeled.

Break-even is measured from closing. Owner cash starts at minus the down payment, closing and moving costs, earns the cash interest rate, and gains rent minus owner costs each month. Home equity is added. Break-even is the first month this is zero or more, up to 360 months. It is cost recovery compared with renting, not a recommended sale date.

## Version 1 scenarios

Earlier saves used named household loans. On import they are migrated: the current loan and any family-loan contribution become current debt, the future partner loan becomes new debt, and dining becomes flexible spending. The total spending figure is preserved.

## Verification scope

Automated tests cover the mortgage math, inverse thresholds, cash flow, debt scheduling, contribution caps, locked conflicts, priority ordering, deadlines, imports and migration, storage, share-link privacy, accessible interaction and axe DOM checks. jsdom cannot check rendered contrast or layout; those were checked in a browser at desktop and 375 px widths in light and dark mode.
