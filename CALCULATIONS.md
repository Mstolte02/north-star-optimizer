# Financial calculation notes

## Mortgage

For principal L, monthly interest r = annualRate / 1200 and n = termYears × 12:

`payment = L × r / (1 − (1 + r)^−n)`

At zero interest, `payment = L / n`. Scheduled balance is computed analytically and verified independently against month-by-month amortization. At the final payment, P&I is zero.

- $360,000 principal, 6.5%, 30 years → **$2,275.444884574669** monthly P&I.
- $120,000 principal, 0%, 10 years → **$1,000** monthly; $84,000 after 36 payments.
- $400,000 home, 10% down, 3% closing, $2,000 moving → **$54,000** cash withdrawn at closing.
- Initial PMI: 0.5% × $360,000 / 12 → **$150/month**. At 20% down there is no PMI. Existing PMI is modeled to terminate when scheduled LTV reaches 78% of original value. This assumes a conventional loan in good standing; lender rules and mortgage products differ.

Reference: [Consumer Financial Protection Bureau — PMI termination](https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/).

The numerical P&I check was independently reproduced with Python Decimal at 45-digit precision using the standard annuity equation. Balance tests use an independent iterative recurrence rather than duplicating the closed-form function.

## Cash flow and reserves

Before purchase: `net income − household expenses − investments`.

After purchase: subtract total ownership cost and remove the included rent. Ownership includes P&I, tax, insurance, PMI, maintenance, HOA and incremental utilities.

Included components are not added again. A separate future loan is added only from its effective month. If the baseline already includes that future payment, it is removed before its effective month. Dining adjustments use the difference from the included original amount. The baseline must be at least the sum of its included components; inconsistent totals are reported as infeasible.

Emergency cash = maximum of the configured dollar reserve and emergency months × modeled monthly living expenses. Fixed federal and Parent PLUS payments are not inflated with lifestyle expenses. Investing and unallocated saving surplus are excluded from emergency living expenses. Negative cash flow reduces cash; it is not clamped into a fictitious zero deficit.

Income changes use `annual salary change × incremental retention / 1200`. Scheduled raises start at the configured month; growth is explicit. This is a planning conversion, not a tax calculation.

Cash follows `cash[m+1] = cash[m] × (1 + annual cash rate / 1200) + contribution[m]`, followed by the closing withdrawal at the purchase point. Positive contribution caps exclude any unallocated surplus from projected assets. If a cap exceeds available cash flow, the plan is flagged instead of reporting that cap as feasible savings.

## Thresholds

Salary-only thresholds use bisection to dollar precision at the entered purchase month, home price and down payment. Break-even sets cash reserve, emergency-month reserve and post-purchase savings floor to zero, while retaining the selected goal and other limits. Comfortable retains user-configured cushions. If a payment cap or another non-income constraint cannot be solved by salary, the threshold is null.

For constant monthly saving C and rate r over n months:

`futureCash = startingCash × (1 + r)^n + C × ((1 + r)^n − 1) / r`.

At zero interest, the required monthly contribution for default closing and reserves is `(54,000 + 20,000 − 5,700) / 32 = $2,134.375`.

Maximum home price at the entered income/date uses bisection, including closing cash and total housing costs. Because PMI has a discontinuity at 20% down, comparisons use the selected down-payment method rather than varying it inside this inverse solve.

## Search and priorities

Every candidate is checked against hard limits and the selected objective. Locked levers remain unchanged. Grid resolution is 13 prices, 10 down percentages, 5 dining levels, 9 purchase months, and 17 rates when rate is selected, with current values and the explicit deadline also included. Salary bisection searches only the permitted range. Fixed-dollar down payments require the percentage lever to be locked.

Primary objective values are scored first (maximum feasible sampled price for housing-payment and post-purchase-saving goals, minimum primary salary, or maximum sampled rate). Other goals are target constraints. Preferences are scored in priority order, using floor(value/tolerance) bands, followed by unrounded preference tie breakers. Reserve preference rewards at most one additional configured reserve tolerance beyond the required reserve to avoid indefinitely rewarding delay.

The first reported path is therefore best among tested candidates under this ranking. No global optimality claim is made. Alternative searches hold distinct levers fixed and only report distinct feasible results. The engine never fabricates a path when none passes.

## Net worth and ownership break-even

Net worth is modeled cash + investments + home equity − remaining federal household loan principal. Federal loans use zero-interest paydown in this version, with modeled payments stopping when principal is repaid. Parent PLUS remains cash flow, excluded from legal net worth and DTI. PMI is removed on the amortization schedule. No loan forgiveness, future asset liquidation costs or tax benefits are modeled.

Ownership break-even is measured from closing: owner cash starts at negative down payment, closing and moving costs. It earns (or incurs the opportunity cost of) the cash interest assumption. Rent minus owner housing costs is added monthly, and home equity is added for the comparison. Break-even is the first month owner incremental wealth is nonnegative, up to 360 months. This is financial cost recovery versus renting, not necessarily a recommended sale date.

## Verification scope

Automated checks cover mathematics, inverse thresholds, default cash flow, inclusion toggles, negative cash flow, caps, loan distinctions, locked conflicts, priority ordering, deadline behavior, safe imports, browser-style storage, privacy links, accessible interaction and axe DOM checks. Palette text contrast is calculated separately against the page background; jsdom cannot verify rendered contrast or responsive geometry. Real desktop/iPhone rendering and deployed-site checks remain pending until browser publishing access is available.
