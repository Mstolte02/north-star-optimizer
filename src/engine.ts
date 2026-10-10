import {
  type Profile,
  type Scenario,
  type Lever,
  type Priority,
} from "./model";
export function mortgage(principal: number, rate: number, years: number) {
  const n = years * 12,
    r = rate / 1200;
  if (principal <= 0) return 0;
  return r === 0
    ? principal / n
    : (principal * r) / -Math.expm1(-n * Math.log1p(r));
}
export function balance(
  principal: number,
  rate: number,
  years: number,
  month: number,
) {
  if (month >= years * 12) return 0;
  const r = rate / 1200,
    pay = mortgage(principal, rate, years);
  return Math.max(
    0,
    r === 0
      ? principal - pay * month
      : principal * Math.exp(month * Math.log1p(r)) -
          (pay * Math.expm1(month * Math.log1p(r))) / r,
  );
}
export function downAmount(p: Profile) {
  return p.downMode === "dollars"
    ? Math.min(p.price, p.downDollars)
    : (p.price * p.down) / 100;
}
export function housing(p: Profile, month = 0) {
  const principal = p.price - downAmount(p);
  const pi = month >= p.term * 12 ? 0 : mortgage(principal, p.rate, p.term);
  const bal = balance(principal, p.rate, p.term, month);
  const pmi =
    principal / p.price > 0.8 && bal / p.price > 0.78
      ? (principal * p.pmi) / 1200
      : 0;
  const piti = pi + (p.price * p.tax) / 1200 + p.insurance + pmi;
  return {
    principal,
    pi,
    pmi,
    balance: bal,
    piti,
    total: piti + p.hoa + (p.price * p.maintenance) / 1200 + p.utilities,
  };
}
export function income(p: Profile, month: number) {
  const baseline = p.net;
  const salary =
    (month >= p.raiseMonth && p.raiseMonth > 0
      ? Math.max(p.salary, p.raiseSalary)
      : p.salary) * Math.pow(1 + p.growth / 100, month / 12);
  const gross =
    salary + p.partnerSalary * Math.pow(1 + p.growth / 100, month / 12);
  return (
    baseline +
    (gross - p.salary - p.partnerSalary) * (p.retention / 1200) -
    (gross * p.retirement) / 1200 -
    p.benefits +
    p.bonus / 12
  );
}
// Primary salary is an explicit hypothetical change relative to the calibrated baseline profile.
export function adjustedProfile(
  s: Scenario,
  changes: Partial<Profile>,
): Profile {
  const p = { ...s.profile, ...changes };
  p.net =
    s.profile.net +
    ((p.salary -
      s.profile.salary +
      (p.partnerSalary - s.profile.partnerSalary)) *
      s.profile.retention) /
      1200;
  return p;
}
export function expenses(p: Profile, month: number) {
  const din = month >= p.reductionMonth ? p.diningTarget : p.dining;
  const includedDebt =
    p.ownLoan +
    (p.includesPlus ? p.plus : 0) +
    (p.includesFutureLoan ? p.partnerLoan : 0);
  const lifestyle = p.expenses - includedDebt + din - p.dining;
  return (
    lifestyle * Math.pow(1 + p.inflation / 100, month / 12) +
    Math.min(p.ownLoan, Math.max(0, p.ownBalance - p.ownLoan * month)) +
    p.plus +
    (month >= p.loanMonth
      ? Math.min(
          p.partnerLoan,
          Math.max(0, p.partnerBalance - p.partnerLoan * (month - p.loanMonth)),
        )
      : 0)
  );
}
export function cashFlow(p: Profile, month: number, owned = false) {
  return (
    income(p, month) -
    expenses(p, month) -
    (owned
      ? housing(p, month - p.months).total -
        p.rent * Math.pow(1 + p.inflation / 100, month / 12)
      : 0) -
    p.investment
  );
}
export function accumulate(p: Profile, months = p.months) {
  let cash = p.savings;
  for (let m = 0; m < months; m++) {
    const available = cashFlow(p, m);
    cash =
      cash * (1 + p.savingsRate / 1200) +
      (p.preContribution > 0
        ? Math.min(available, p.preContribution)
        : available);
  }
  return cash;
}
export function closingCash(p: Profile) {
  return downAmount(p) + (p.price * p.closing) / 100 + p.moving;
}
export interface Evaluation {
  p: Profile;
  house: ReturnType<typeof housing>;
  cash: number;
  remaining: number;
  reserve: number;
  after: number;
  before: number;
  dti: number;
  violations: string[];
  feasible: boolean;
  wealth: number;
  breakEven: number | null;
}
export function wealth(p: Profile, horizon = p.horizon) {
  let cash = p.savings,
    inv = 0;
  const legal =
    Math.max(0, p.ownBalance - p.ownLoan * horizon) +
    Math.max(
      0,
      p.partnerBalance - p.partnerLoan * Math.max(0, horizon - p.loanMonth),
    );
  for (let m = 0; m < horizon; m++) {
    cash *= 1 + p.savingsRate / 1200;
    const flow = cashFlow(p, m, m >= p.months);
    const cap = m >= p.months ? p.postContribution : p.preContribution;
    cash += cap > 0 ? Math.min(cap, flow) : flow;
    if (m + 1 === p.months) cash -= closingCash(p);
    const gross =
      ((m >= p.raiseMonth && p.raiseMonth > 0
        ? Math.max(p.salary, p.raiseSalary)
        : p.salary) +
        p.partnerSalary) *
      Math.pow(1 + p.growth / 100, m / 12);
    inv =
      inv * (1 + p.investmentReturn / 1200) +
      p.investment +
      (gross * p.retirement) / 1200;
  }
  const equity =
    horizon >= p.months
      ? p.price *
          Math.pow(1 + p.appreciation / 100, (horizon - p.months) / 12) -
        housing(p, horizon - p.months).balance
      : 0;
  return {
    wealth: cash + inv + equity - legal,
    cash,
    investments: inv,
    equity,
  };
}
// Compare buying with renting starting at closing, with identical income and non-housing expenses.
export function breakEven(p: Profile, max = 360) {
  let buy = 0,
    equity = downAmount(p);
  let ownerCash = -closingCash(p);
  for (let m = 1; m <= max; m++) {
    const h = housing(p, m - 1);
    ownerCash =
      ownerCash * (1 + p.savingsRate / 1200) +
      p.rent * Math.pow(1 + p.inflation / 100, (p.months + m - 1) / 12) -
      h.total;
    equity =
      p.price * Math.pow(1 + p.appreciation / 100, m / 12) -
      balance(h.principal, p.rate, p.term, m);
    buy = ownerCash + equity;
    if (buy >= 0) return m;
  }
  return null;
}
export function evaluate(
  s: Scenario,
  p = s.profile,
  extended = false,
): Evaluation {
  const h = housing(p),
    cash = accumulate(p),
    remaining = cash - closingCash(p),
    after =
      p.postContribution > 0
        ? Math.min(p.postContribution, cashFlow(p, p.months, true))
        : cashFlow(p, p.months, true),
    before =
      p.preContribution > 0
        ? Math.min(p.preContribution, cashFlow(p, 0))
        : cashFlow(p, 0);
  const reserve = Math.max(
    p.reserve,
    p.emergencyMonths *
      (income(p, p.months) - cashFlow(p, p.months, true) - p.investment),
  );
  const gross =
    (p.salary + p.partnerSalary) * Math.pow(1 + p.growth / 100, p.months / 12) +
    (p.raiseMonth > 0 && p.months >= p.raiseMonth
      ? Math.max(0, p.raiseSalary - p.salary) *
        Math.pow(1 + p.growth / 100, p.months / 12)
      : 0);
  const dti =
    ((h.piti +
      p.hoa +
      Math.min(p.ownLoan, Math.max(0, p.ownBalance - p.ownLoan * p.months)) +
      (p.months >= p.loanMonth
        ? Math.min(
            p.partnerLoan,
            Math.max(
              0,
              p.partnerBalance - p.partnerLoan * (p.months - p.loanMonth),
            ),
          )
        : 0)) /
      (gross / 12)) *
    100;
  const v: string[] = [];
  if (
    p.expenses + 0.01 <
    p.rent +
      p.dining +
      p.medication +
      p.ownLoan +
      (p.includesPlus ? p.plus : 0) +
      (p.includesFutureLoan ? p.partnerLoan : 0)
  )
    v.push("The spending baseline is smaller than its included components.");
  if (p.preContribution > 0 && p.preContribution > cashFlow(p, 0) + 0.01)
    v.push("The pre-purchase contribution limit exceeds available cash flow.");
  if (
    p.postContribution > 0 &&
    p.postContribution > cashFlow(p, p.months, true) + 0.01
  )
    v.push("The post-purchase contribution limit exceeds available cash flow.");
  if (remaining + 0.01 < reserve)
    v.push("Closing cash and protected reserves are not fully funded.");
  if (after + 0.01 < p.after)
    v.push("Post-purchase savings fall below your monthly floor.");
  if (h.total > p.paymentLimit + 0.01)
    v.push("Total housing costs exceed your locked payment ceiling.");
  if (dti > p.dtiLimit + 0.001)
    v.push("Modeled legal-debt DTI exceeds your configured ceiling.");
  if (before < 0) v.push("Current cash flow is negative.");
  let w = 0,
    b: number | null = null;
  switch (s.objective) {
    case "price":
      if (Math.abs(p.price - s.target) > 1)
        v.push("Home price does not match the North Star.");
      break;
    case "payment":
      if (h.total > s.target + 0.01)
        v.push("Housing cost exceeds the North Star ceiling.");
      break;
    case "date":
      if (p.months > s.target) v.push("The purchase deadline is missed.");
      break;
    case "before":
      if (before < s.target - 0.01)
        v.push("Pre-purchase savings target is not met.");
      break;
    case "after":
      if (after < s.target - 0.01)
        v.push("Post-purchase savings target is not met.");
      break;
    case "income":
      if (income(p, p.months) < s.target - 0.01)
        v.push("Take-home income target is not met.");
      break;
    case "down":
      if ((downAmount(p) / p.price) * 100 < s.target - 0.001)
        v.push("Down payment target is not met.");
      break;
    case "remaining":
      if (remaining < s.target - 0.01)
        v.push("Cash remaining target is not met.");
      break;
    case "emergency":
      if (
        remaining <
        s.target *
          (income(p, p.months) - cashFlow(p, p.months, true) - p.investment) -
          0.01
      )
        v.push("Emergency-fund target is not met.");
      break;
    case "wealth":
      w = wealth(p).wealth;
      if (w < s.target - 0.01) v.push("Net-worth target is not met.");
      break;
    case "breakEven":
      b = breakEven(p, Math.floor(s.target));
      if (b === null)
        v.push(
          "Ownership does not break even versus renting within the target horizon.",
        );
      break;
  }
  if (extended) {
    w = wealth(p).wealth;
    b = breakEven(p);
  }
  return {
    p,
    house: h,
    cash,
    remaining,
    reserve,
    after,
    before,
    dti,
    violations: v,
    feasible: v.length === 0,
    wealth: w,
    breakEven: b,
  };
}
export interface Path {
  name: string;
  e: Evaluation;
  score: number[];
  changes: string[];
}
const money = (n: number) =>
  new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
function score(s: Scenario, e: Evaluation) {
  const p = e.p,
    b = s.profile,
    t = s.tolerances;
  const pref: Record<Priority, number> = {
    payment: e.house.total / t.payment,
    reserve: -Math.min(e.remaining, e.reserve + t.reserve) / t.reserve,
    spending: Math.max(0, b.dining - p.diningTarget) / t.spending,
    months: p.months / t.months,
    salary: Math.max(0, p.salary - b.salary) / t.salary,
  };
  let primary = 0;
  if (s.objective === "payment" || s.objective === "after")
    primary = -p.price / 100;
  if (s.objective === "salary") primary = p.salary / 100;
  if (s.objective === "rate") primary = -p.rate * 100;
  return [
    primary,
    ...s.priorities.map((k) => Math.floor(pref[k])),
    ...s.priorities.map((k) => pref[k]),
  ];
}
function cmp(a: number[], b: number[]) {
  for (let i = 0; i < a.length; i++) {
    if (Math.abs(a[i] - b[i]) > 1e-8) return a[i] - b[i];
  }
  return 0;
}
function grid(min: number, max: number, count: number) {
  return Array.from(
    { length: count },
    (_, i) => min + ((max - min) * i) / (count - 1),
  );
}
function values(s: Scenario, k: Lever, count: number, current: number) {
  const r = s.ranges[k];
  return r.locked
    ? [current]
    : [...new Set([current, ...grid(r.min, r.max, count)])].filter(
        (x) => x >= r.min && x <= r.max,
      );
}
function search(s: Scenario, restrict: Lever[] = []): Path | null {
  let best: Path | null = null;
  const fixed = (k: Lever, n: number, v: number) =>
    restrict.includes(k) ? [v] : values(s, k, n, v);
  const b = s.profile;
  const prices =
      s.objective === "price"
        ? s.ranges.price.locked
          ? [b.price]
          : s.target >= s.ranges.price.min && s.target <= s.ranges.price.max
            ? [s.target]
            : []
        : fixed("price", 13, b.price),
    rates = s.objective === "rate" ? values(s, "rate", 17, b.rate) : [b.rate];
  for (const price of prices)
    for (const rate of rates)
      for (const d of [
        ...new Set([
          ...fixed("down", 10, b.down),
          ...(s.objective === "down" &&
          !s.ranges.down.locked &&
          !restrict.includes("down") &&
          s.target >= s.ranges.down.min &&
          s.target <= s.ranges.down.max
            ? [s.target]
            : []),
        ]),
      ])
        for (const diningTarget of fixed("spending", 5, b.diningTarget)) {
          if (b.downMode === "dollars" && !s.ranges.down.locked) continue;
          let monthsList = fixed("months", 9, b.months)
            .map(Math.round)
            .filter(
              (x) =>
                s.ranges.months.locked ||
                restrict.includes("months") ||
                (x >= s.ranges.months.min && x <= s.ranges.months.max),
            );
          if (
            s.objective === "date" &&
            !s.ranges.months.locked &&
            !restrict.includes("months") &&
            s.target >= s.ranges.months.min &&
            s.target <= s.ranges.months.max
          )
            monthsList.push(Math.floor(s.target));
          if (s.objective === "date")
            monthsList = monthsList.filter((x) => x <= s.target);
          for (const months of monthsList) {
            const changes = { price, rate, down: d, diningTarget, months };
            let salary = b.salary;
            const r = s.ranges.salary;
            if (!r.locked && !restrict.includes("salary")) {
              let lo = r.min,
                hi = r.max;
              if (
                !evaluate(s, adjustedProfile(s, { ...changes, salary: hi }))
                  .feasible
              )
                continue;
              for (let i = 0; i < 22; i++) {
                const mid = (lo + hi) / 2;
                if (
                  evaluate(s, adjustedProfile(s, { ...changes, salary: mid }))
                    .feasible
                )
                  hi = mid;
                else lo = mid;
              }
              salary = Math.min(r.max, Math.ceil(hi));
            }
            const p = adjustedProfile(s, { ...changes, salary }),
              e = evaluate(s, p);
            if (!e.feasible) continue;
            const sc = score(s, e);
            if (!best || cmp(sc, best.score) < 0) {
              const diff: string[] = [];
              if (Math.abs(salary - b.salary) > 1)
                diff.push(
                  `Primary salary ${money(salary)} (${money(salary - b.salary)} change)`,
                );
              if (Math.abs(diningTarget - b.diningTarget) > 1)
                diff.push(`Dining & snacks ${money(diningTarget)}/mo`);
              if (months !== b.months)
                diff.push(`Purchase in ${months} months`);
              if (Math.abs(d - b.down) > 0.1)
                diff.push(`Down payment ${d.toFixed(1)}%`);
              if (Math.abs(price - b.price) > 1)
                diff.push(`Home price ${money(price)}`);
              if (rate !== b.rate)
                diff.push(`Mortgage rate ${rate.toFixed(2)}%`);
              best = {
                name: "Balanced path",
                e,
                score: sc,
                changes: diff.length
                  ? diff
                  : ["Your existing assumptions already meet the objective."],
              };
            }
          }
        }
  return best;
}
export function optimize(s: Scenario) {
  const configurations: { name: string; restrict: Lever[] }[] = [
    { name: "Priority-led path", restrict: [] },
    { name: "Income path", restrict: ["spending", "down", "months"] },
    { name: "Lifestyle path", restrict: ["salary", "spending", "down"] },
    { name: "Savings path", restrict: ["salary", "down"] },
    { name: "Housing path", restrict: ["spending", "months"] },
  ];
  const paths: Path[] = [];
  for (const c of configurations) {
    const p = search(s, c.restrict);
    if (
      p &&
      !paths.some((x) => JSON.stringify(x.e.p) === JSON.stringify(p.e.p))
    ) {
      p.name = c.name;
      p.e = evaluate(s, p.e.p, true);
      paths.push(p);
    }
  }
  paths.sort((a, b) => cmp(a.score, b.score));
  return {
    paths,
    baseline: evaluate(s, s.profile, true),
    method:
      "Bounded grid search with salary bisection; feasible candidates ranked lexicographically within your tolerances. Results are sampled planning paths, not proof of a global optimum.",
  };
}
export function salaryThreshold(s: Scenario, comfortable = true) {
  const p = {
    ...s.profile,
    after: comfortable ? s.profile.after : 0,
    reserve: comfortable ? s.profile.reserve : 0,
    emergencyMonths: comfortable ? s.profile.emergencyMonths : 0,
  };
  const copy = { ...s, profile: p };
  let lo = 0,
    hi = 1000000;
  const valid = (salary: number) =>
    evaluate(copy, adjustedProfile(copy, { salary })).feasible;
  if (!valid(hi)) return null;
  for (let i = 0; i < 45; i++) {
    const m = (lo + hi) / 2;
    if (valid(m)) hi = m;
    else lo = m;
  }
  return Math.ceil(hi);
}
export function maxPrice(s: Scenario) {
  let lo = 0,
    hi = s.ranges.price.max;
  const copy = { ...s, objective: "after" as const, target: s.profile.after };
  for (let i = 0; i < 40; i++) {
    const m = (lo + hi) / 2;
    if (evaluate(copy, { ...copy.profile, price: m }).feasible) lo = m;
    else hi = m;
  }
  return lo < 1 ? null : Math.floor(lo);
}
export function savingsRequired(p: Profile) {
  const n = p.months;
  if (n === 0) return null;
  const r = p.savingsRate / 1200,
    goal =
      closingCash(p) +
      Math.max(
        p.reserve,
        p.emergencyMonths *
          (income(p, p.months) - cashFlow(p, p.months, true) - p.investment),
      );
  return Math.max(
    0,
    r === 0
      ? (goal - p.savings) / n
      : ((goal - p.savings * Math.pow(1 + r, n)) * r) /
          (Math.pow(1 + r, n) - 1),
  );
}
export function projection(
  p: Profile,
  horizon = Math.max(p.months + 60, p.horizon),
) {
  let cash = p.savings,
    inv = 0;
  const points = [
    {
      month: 0,
      cash,
      balance: 0,
      equity: 0,
      flow: cashFlow(p, 0),
      closing: false,
      netWorth: cash - p.ownBalance - p.partnerBalance,
    },
  ];
  for (let m = 1; m <= horizon; m++) {
    const owned = m > p.months,
      flow = cashFlow(p, m - 1, owned);
    const cap = owned ? p.postContribution : p.preContribution;
    cash =
      cash * (1 + p.savingsRate / 1200) +
      (cap > 0 ? Math.min(flow, cap) : flow);
    if (m === p.months) cash -= closingCash(p);
    const gross =
      ((m - 1 >= p.raiseMonth && p.raiseMonth > 0
        ? Math.max(p.salary, p.raiseSalary)
        : p.salary) +
        p.partnerSalary) *
      Math.pow(1 + p.growth / 100, (m - 1) / 12);
    inv =
      inv * (1 + p.investmentReturn / 1200) +
      p.investment +
      (gross * p.retirement) / 1200;
    const legal =
      Math.max(0, p.ownBalance - p.ownLoan * m) +
      Math.max(
        0,
        p.partnerBalance - p.partnerLoan * Math.max(0, m - p.loanMonth),
      );
    const h = owned || m === p.months ? housing(p, m - p.months) : null;
    points.push({
      month: m,
      cash,
      balance: h?.balance ?? 0,
      equity: h
        ? p.price * Math.pow(1 + p.appreciation / 100, (m - p.months) / 12) -
          h.balance
        : 0,
      flow,
      closing: m === p.months,
      netWorth:
        cash +
        inv +
        (h
          ? p.price * Math.pow(1 + p.appreciation / 100, (m - p.months) / 12) -
            h.balance
          : 0) -
        legal,
    });
  }
  return points;
}
