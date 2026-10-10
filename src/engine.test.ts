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
const easy = () => {
  const s = defaults();
  s.profile = {
    ...s.profile,
    net: 12000,
    savings: 150000,
    paymentLimit: 5000,
    dtiLimit: 70,
    after: 750,
    months: 36,
  };
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
    expect(downAmount(p)).toBe(40000);
    expect(closingCash(p)).toBe(54000);
    expect(downAmount({ ...p, downMode: "dollars", downDollars: 25000 })).toBe(
      25000,
    );
  });
  it("includes PMI below 20 percent and removes at scheduled 78 percent LTV", () => {
    const p = defaults().profile;
    expect(housing(p).pmi).toBe(150);
    expect(housing({ ...p, down: 20 }).pmi).toBe(0);
    expect(housing(p, 240).pmi).toBe(0);
  });
});
describe("cash flow, inclusion and accumulation", () => {
  it("reproduces the 673 baseline with no double-counted loans", () => {
    const p = defaults().profile;
    expect(cashFlow(p, 0)).toBeCloseTo(673);
    expect(cashFlow(p, 24)).toBeCloseTo(423);
  });
  it("adds PLUS only when not included and schedules future payments already in baseline", () => {
    const p = defaults().profile;
    expect(cashFlow({ ...p, includesPlus: false }, 0)).toBeCloseTo(
      673 - 745.88,
    );
    expect(
      cashFlow(
        { ...p, expenses: p.expenses + 250, includesFutureLoan: true },
        0,
      ),
    ).toBeCloseTo(673);
    expect(
      cashFlow(
        { ...p, expenses: p.expenses + 250, includesFutureLoan: true },
        24,
      ),
    ).toBeCloseTo(423);
  });
  it("replaces rent with all-in ownership and preserves legal debt distinction", () => {
    const s = defaults(),
      p = s.profile;
    expect(cashFlow(p, 32, true)).toBeCloseTo(
      7399 - 6726 - 250 + 1826 - housing(p).total,
    );
    const e = evaluate(s);
    const other = evaluate({ ...s, profile: { ...p, plusBalance: 999999 } });
    expect(e.dti).toBe(other.dti);
  });
  it("converts changes in annual salary to incremental MONTHLY take-home", () => {
    const s = defaults();
    const p = adjustedProfile(s, { salary: 85000 });
    expect(cashFlow(p, 0) - cashFlow(s.profile, 0)).toBeCloseTo(937.5);
  });
  it("handles scheduled raises, growth and benefit deductions transparently", () => {
    const p = defaults().profile;
    expect(
      cashFlow({ ...p, raiseMonth: 6, raiseSalary: 85000 }, 5),
    ).toBeCloseTo(673);
    expect(
      cashFlow({ ...p, raiseMonth: 6, raiseSalary: 85000 }, 6),
    ).toBeCloseTo(1610.5);
    expect(cashFlow({ ...p, benefits: 100 }, 0)).toBeCloseTo(573);
  });
  it("accumulates savings independently by a geometric series", () => {
    const p = { ...defaults().profile, loanMonth: 100, savingsRate: 0 };
    expect(accumulate(p, 12)).toBeCloseTo(5700 + 673 * 12);
    const r = 0.03 / 12;
    expect(accumulate({ ...p, savingsRate: 3 }, 12)).toBeCloseTo(
      5700 * (1 + r) ** 12 + (673 * ((1 + r) ** 12 - 1)) / r,
      5,
    );
  });
  it("caps contributions without pretending surplus is invested", () => {
    const p = { ...defaults().profile, savingsRate: 0, preContribution: 500 };
    expect(accumulate(p, 12)).toBe(11700);
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
    expect(salaryThreshold(defaults())).toBeNull();
  });
  it("finds salary to dollar precision and derives comfort from user cushions", () => {
    const s = easy();
    s.profile.savings = 5700;
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
    expect(savingsRequired(p)).toBeCloseTo((54000 + 20000 - 5700) / 32);
  });
  it("net worth excludes the PLUS balance; break-even returns no fabricated horizon", () => {
    const p = easy().profile;
    expect(wealth(p).wealth).toBe(wealth({ ...p, plusBalance: 999999 }).wealth);
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
    expect(() => validateScenario({ ...defaults(), version: 2 })).toThrow();
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
    expect(decoded).not.toContain("7399");
    expect(decodeShare(encodeShare(s, true))).toEqual(s);
  });
});

describe("additional accounting regressions", () => {
  it("holds fixed debt payments nominal while inflating lifestyle expenses", () => {
    const p = defaults().profile;
    const inflated = { ...p, inflation: 10, loanMonth: 100 };
    expect(cashFlow(inflated, 12)).toBeCloseTo(
      7399 - (6726 - 298.67 - 745.88) * 1.1 - 298.67 - 745.88,
    );
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
      "The spending baseline is smaller than its included components.",
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
  it("stops modeled federal payments when zero-interest principal is repaid", () => {
    const p = defaults().profile;
    expect(cashFlow(p, 100)).toBeCloseTo(423 + 298.67);
  });
});
