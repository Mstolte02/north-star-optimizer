import { describe, it, expect } from "vitest";
import { defaults, type Scenario } from "./model";
import {
  mortgage,
  balance,
  housing,
  downAmount,
  closingCash,
  cashFlow,
  accumulate,
  adjustedProfile,
  evaluate,
  optimize,
  salaryThreshold,
  maxPrice,
  savingsRequired,
  projection,
  wealth,
  breakEven,
} from "./engine";
import {
  validateScenario,
  importScenarios,
  saveScenarios,
  loadScenarios,
  encodeShare,
  decodeShare,
} from "./persistence";
// A comfortable two-income household with a larger home goal.
const easy = () => {
  const s = defaults();
  s.target = 400000;
  s.profile = {
    ...s.profile,
    salary: 70000,
    raiseSalary: 70000,
    partnerSalary: 45000,
    retention: 75,
    net: 12000,
    expenses: 6726,
    rent: 1826,
    flexible: 635,
    flexibleTarget: 635,
    debtPayment: 298.67,
    debtBalance: 26291,
    savings: 150000,
    price: 400000,
    tax: 1,
    insurance: 150,
    reserve: 20000,
    paymentLimit: 5000,
    dtiLimit: 70,
    after: 750,
    months: 36,
  };
  s.ranges.salary = { locked: false, min: 70000, max: 160000 };
  s.ranges.spending = { locked: false, min: 300, max: 635 };
  s.ranges.price = { locked: true, min: 150000, max: 650000 };
  return s;
};
describe("independently verified mortgage mathematics", () => {
  it("matches a published-style amortization case independently calculated with Decimal", () => {
    expect(mortgage(360000, 6.5, 30)).toBeCloseTo(2275.444884574669, 6);
  });
  it("handles zero interest and final payoff", () => {
    expect(mortgage(120000, 0, 10)).toBe(1000);
    expect(balance(120000, 0, 10, 36)).toBe(84000);
    expect(balance(120000, 0, 10, 120)).toBe(0);
  });
  it("matches iterative amortization, independently of the closed-form balance", () => {
    let b = 360000;
    const pay = mortgage(b, 6.5, 30);
    for (let i = 0; i < 120; i++) b = b * (1 + 6.5 / 1200) - pay;
    expect(balance(360000, 6.5, 30, 120)).toBeCloseTo(b, 5);
  });
  it("calculates percentages, fixed dollar down payments and closing costs", () => {
    const p = defaults().profile;
    expect(downAmount(p)).toBe(30000);
    expect(closingCash(p)).toBe(41000);
    expect(downAmount({ ...p, downMode: "dollars", downDollars: 25000 })).toBe(
      25000,
    );
  });
  it("includes PMI below 20 percent and removes at scheduled 78 percent LTV", () => {
    const p = defaults().profile;
    expect(housing(p).pmi).toBe(112.5);
    expect(housing({ ...p, down: 20 }).pmi).toBe(0);
    expect(housing(p, 240).pmi).toBe(0);
  });
});
describe("cash flow, inclusion and accumulation", () => {
  it("counts debt payments inside total spending exactly once", () => {
    const p = defaults().profile;
    expect(cashFlow(p, 0)).toBeCloseTo(1200);
    expect(cashFlow({ ...p, debtPayment: 0, expenses: 3200 }, 0)).toBeCloseTo(
      1500,
    );
  });
  it("adds a future debt payment only from its start month", () => {
    const p = {
      ...defaults().profile,
      futureDebtPayment: 250,
      futureDebtBalance: 10000,
      futureDebtMonth: 12,
    };
    expect(cashFlow(p, 11)).toBeCloseTo(1200);
    expect(cashFlow(p, 12)).toBeCloseTo(950);
  });
  it("replaces rent with all-in ownership and counts debt in DTI", () => {
    const s = defaults(),
      p = s.profile;
    expect(cashFlow(p, 24, true)).toBeCloseTo(
      4700 - 3500 + 1500 - housing(p).total,
    );
    const e = evaluate(s);
    const more = evaluate({
      ...s,
      profile: { ...p, debtPayment: 600, expenses: 3800 },
    });
    expect(more.dti).toBeGreaterThan(e.dti);
  });
  it("converts changes in annual salary to incremental MONTHLY take-home", () => {
    const s = defaults();
    const p = adjustedProfile(s, { salary: 85000 });
    expect(cashFlow(p, 0) - cashFlow(s.profile, 0)).toBeCloseTo(780);
  });
  it("handles scheduled raises, growth and benefit deductions transparently", () => {
    const p = defaults().profile;
    expect(
      cashFlow({ ...p, raiseMonth: 6, raiseSalary: 85000 }, 5),
    ).toBeCloseTo(1200);
    expect(
      cashFlow({ ...p, raiseMonth: 6, raiseSalary: 85000 }, 6),
    ).toBeCloseTo(1980);
    expect(cashFlow({ ...p, benefits: 100 }, 0)).toBeCloseTo(1100);
  });
  it("accumulates savings independently by a geometric series", () => {
    const p = { ...defaults().profile, savingsRate: 0 };
    expect(accumulate(p, 12)).toBeCloseTo(20000 + 1200 * 12);
    const r = 0.03 / 12;
    expect(accumulate({ ...p, savingsRate: 3 }, 12)).toBeCloseTo(
      20000 * (1 + r) ** 12 + (1200 * ((1 + r) ** 12 - 1)) / r,
      5,
    );
  });
  it("caps contributions without pretending surplus is invested", () => {
    const p = { ...defaults().profile, savingsRate: 0, preContribution: 500 };
    expect(accumulate(p, 12)).toBe(26000);
  });
  it("withdraws exactly the closing cash on the chart and handles mortgage payoff", () => {
    const p = easy().profile,
      pr = projection(p);
    expect(pr[p.months].cash).toBeCloseTo(accumulate(p) - closingCash(p));
    expect(pr[p.months].balance).toBe(housing(p).principal);
    expect(housing(p, p.term * 12).pi).toBe(0);
  });
  it("preserves scheduled negative cashflow rather than fabricating saving", () => {
    const p = { ...defaults().profile, net: 1000, savingsRate: 0 };
    expect(accumulate(p, 1)).toBeLessThan(p.savings);
  });
});
describe("inverse thresholds and objectives", () => {
  it("returns null when salary cannot fix a payment ceiling", () => {
    const s = defaults();
    s.profile.paymentLimit = 2000;
    expect(salaryThreshold(s)).toBeNull();
  });
  it("finds salary to dollar precision and derives comfort from user cushions", () => {
    const s = easy();
    s.profile.savings = 5000;
    const comfortable = salaryThreshold(s, true)!,
      bare = salaryThreshold(s, false)!;
    expect(comfortable).toBeGreaterThan(bare);
    expect(
      evaluate(s, adjustedProfile(s, { salary: comfortable })).feasible,
    ).toBe(true);
    expect(
      evaluate(s, adjustedProfile(s, { salary: comfortable - 2 })).feasible,
    ).toBe(false);
  });
  it("maximum price satisfies constraints and crosses the bound just above", () => {
    const s = easy(),
      n = maxPrice(s)!;
    const copy = { ...s, objective: "after" as const, target: s.profile.after };
    expect(evaluate(copy, { ...s.profile, price: n }).feasible).toBe(true);
    expect(evaluate(copy, { ...s.profile, price: n + 2 }).feasible).toBe(false);
  });
  it("solves monthly accumulation required for closing and reserves", () => {
    const p = { ...defaults().profile, savingsRate: 0 };
    expect(savingsRequired(p)).toBeCloseTo((41000 + 10000 - 20000) / 24);
  });
  it("net worth subtracts unpaid debt; break-even returns no fabricated horizon", () => {
    const p = easy().profile;
    expect(
      wealth(p, 12).wealth -
        wealth({ ...p, debtBalance: p.debtBalance + 10000 }, 12).wealth,
    ).toBeCloseTo(10000);
    expect(breakEven({ ...p, appreciation: 0, rent: 0 }, 12)).toBeNull();
  });
  it("recognizes all target constraints", () => {
    const s = defaults();
    for (const objective of [
      "before",
      "after",
      "income",
      "down",
      "remaining",
      "emergency",
      "wealth",
      "breakEven",
    ] as const) {
      const target =
        objective === "down"
          ? 95
          : objective === "emergency"
            ? 100
            : objective === "breakEven"
              ? 1
              : 10000000;
      expect(evaluate({ ...s, objective, target }).feasible).toBe(false);
    }
  });
});
describe("bounded optimization and priority ranking", () => {
  it("finds independently valid paths without changing locked values", () => {
    const s = defaults();
    const result = optimize(s);
    expect(result.paths.length).toBeGreaterThan(0);
    for (const path of result.paths) {
      expect(evaluate(s, path.e.p).violations).toEqual([]);
      expect(path.e.p.price).toBe(s.profile.price);
      expect(path.e.p.rate).toBe(s.profile.rate);
      expect(path.e.p.salary).toBeLessThanOrEqual(s.ranges.salary.max);
      expect(path.e.p.down).toBeLessThanOrEqual(s.ranges.down.max);
    }
  });
  it("does not fabricate paths for conflicting locked constraints or a mismatched locked price", () => {
    const s = defaults();
    for (const k of Object.keys(s.ranges) as (keyof Scenario["ranges"])[])
      s.ranges[k].locked = true;
    expect(optimize(s).paths).toHaveLength(0);
    s.profile = easy().profile;
    s.target = 500000;
    expect(optimize(s).paths).toHaveLength(0);
  });
  it("honors purchase deadlines and locked salary", () => {
    const s = easy();
    s.objective = "date";
    s.target = 20;
    s.ranges.salary.locked = true;
    const r = optimize(s);
    expect(r.paths.length).toBeGreaterThan(0);
    for (const p of r.paths) {
      expect(p.e.p.months).toBeLessThanOrEqual(20);
      expect(p.e.p.salary).toBe(s.profile.salary);
    }
  });
  it("changes preferred behavior when priority order changes", () => {
    const s = easy();
    s.profile.savings = 50000;
    s.profile.net = 8500;
    s.profile.paymentLimit = 5000;
    s.ranges.months = { locked: false, min: 12, max: 96 };
    s.priorities = ["months", "salary", "spending", "reserve", "payment"];
    const soon = optimize(s).paths[0];
    s.priorities = ["salary", "spending", "months", "reserve", "payment"];
    const incomeFirst = optimize(s).paths[0];
    expect(soon).toBeDefined();
    expect(incomeFirst).toBeDefined();
    expect(soon.e.p.months).toBeLessThanOrEqual(incomeFirst.e.p.months);
    expect(incomeFirst.e.p.salary).toBeLessThanOrEqual(soon.e.p.salary);
    expect(JSON.stringify(soon.e.p)).not.toBe(JSON.stringify(incomeFirst.e.p));
  });
});
describe("safe versioned scenarios", () => {
  it("round-trips scenarios through browser-style storage", () => {
    let value = "";
    const storage = {
      setItem: (_k: string, v: string) => {
        value = v;
      },
      getItem: () => value,
    };
    saveScenarios([defaults()], storage);
    expect(loadScenarios(storage)).toEqual([defaults()]);
  });
  it("validates every field and rejects unknown schemas, malformed ranges and excessive imports", () => {
    expect(validateScenario(defaults())).toEqual(defaults());
    expect(() => validateScenario({ ...defaults(), version: 3 })).toThrow();
    expect(() =>
      validateScenario({
        ...defaults(),
        profile: { ...defaults().profile, price: -1 },
      }),
    ).toThrow();
    expect(() =>
      importScenarios(
        JSON.stringify({ ...defaults(), priorities: ["salary"] }),
      ),
    ).toThrow();
    expect(() => importScenarios("x".repeat(1000001))).toThrow();
    expect(() => importScenarios("{")).toThrow();
  });
  it("goal-only links omit profile, while full links safely round-trip", () => {
    const s = defaults();
    const goal = encodeShare(s);
    expect(goal).toContain("#goal=");
    expect(decodeShare(goal)?.objective).toBe("price");
    const decoded = atob(goal.split("=")[1]);
    expect(decoded).not.toContain("salary");
    expect(decoded).not.toContain("4700");
    expect(decodeShare(encodeShare(s, true))).toEqual(s);
  });
});

describe("additional accounting regressions", () => {
  it("holds fixed debt payments nominal while inflating lifestyle expenses", () => {
    const p = defaults().profile;
    const inflated = { ...p, inflation: 10 };
    expect(cashFlow(inflated, 12)).toBeCloseTo(4700 - (3500 - 300) * 1.1 - 300);
  });
  it("includes retirement deductions in long-term investment assets", () => {
    const p = easy().profile;
    expect(wealth({ ...p, retirement: 5 }, 12).investments).toBeCloseTo(
      115000 * 0.05,
    );
  });
  it("uses equity AFTER the payment in ownership break-even", () => {
    const p = {
      ...easy().profile,
      price: 120000,
      down: 0,
      rate: 0,
      term: 10,
      rent: 1000,
      insurance: 0,
      pmi: 0,
      tax: 0,
      maintenance: 0,
      moving: 1000,
      closing: 0,
      savingsRate: 0,
    };
    expect(breakEven(p, 1)).toBe(1);
  });
  it("rejects inconsistent baseline components and overfunded caps", () => {
    const s = easy();
    expect(
      evaluate({ ...s, profile: { ...s.profile, expenses: 500 } }).violations,
    ).toContain(
      "Total spending is smaller than the rent, flexible spending and debt payments inside it.",
    );
    expect(
      evaluate({ ...s, profile: { ...s.profile, preContribution: 100000 } })
        .feasible,
    ).toBe(false);
  });
});

describe("projection reconciliation", () => {
  it("reconciles wealth cash with the trajectory at closing and afterward", () => {
    const p = easy().profile;
    const chart = projection(p);
    for (const h of [p.months, p.months + 1, 120]) {
      expect(wealth(p, h).cash).toBeCloseTo(chart[h].cash, 5);
      expect(wealth(p, h).wealth).toBeCloseTo(chart[h].netWorth, 5);
    }
  });
  it("stops debt payments when zero-interest principal is repaid", () => {
    const p = defaults().profile;
    expect(cashFlow(p, 49)).toBeCloseTo(1200);
    expect(cashFlow(p, 50)).toBeCloseTo(1500);
  });
  it("migrates version 1 household-loan scenarios to general debt", () => {
    const v2 = defaults();
    const p: Record<string, unknown> = { ...v2.profile };
    for (const k of [
      "flexible",
      "flexibleTarget",
      "debtPayment",
      "debtBalance",
      "futureDebtPayment",
      "futureDebtBalance",
      "futureDebtMonth",
    ])
      delete p[k];
    Object.assign(p, {
      dining: 400,
      diningTarget: 300,
      medication: 50,
      ownLoan: 200,
      ownBalance: 9000,
      plus: 100,
      plusBalance: 5000,
      includesPlus: true,
      partnerLoan: 150,
      partnerBalance: 6000,
      loanMonth: 12,
      includesFutureLoan: false,
      filing: "Single",
      stateTax: 3,
      localTax: 1,
    });
    const m = validateScenario({ ...v2, version: 1, profile: p });
    expect(m.version).toBe(2);
    expect(m.profile.debtPayment).toBe(300);
    expect(m.profile.debtBalance).toBe(14000);
    expect(m.profile.futureDebtPayment).toBe(150);
    expect(m.profile.futureDebtMonth).toBe(12);
    expect(m.profile.flexibleTarget).toBe(300);
    expect(m.profile.expenses).toBe(v2.profile.expenses);
  });
});
