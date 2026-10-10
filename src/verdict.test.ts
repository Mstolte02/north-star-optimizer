import { describe, it, expect } from "vitest";
import { applyQuestion, defaults, questionFor } from "./model";
import { evaluate } from "./engine";
import { earliestMonth, verdict } from "./verdict";

describe("questions", () => {
  it("maps each question to one objective and back", () => {
    const s = defaults();
    expect(applyQuestion(s, "when").objective).toBe("price");
    expect(applyQuestion(s, "afford").objective).toBe("after");
    expect(applyQuestion(s, "deadline").objective).toBe("date");
    expect(applyQuestion(s, "income").objective).toBe("salary");
    for (const q of ["when", "afford", "deadline", "income"] as const)
      expect(questionFor(applyQuestion(s, q).objective)).toBe(q);
    expect(questionFor("wealth")).toBeUndefined();
  });
  it("sets targets and locks from the current profile", () => {
    const s = defaults();
    expect(applyQuestion(s, "when").target).toBe(s.profile.price);
    expect(applyQuestion(s, "deadline").target).toBe(s.profile.months);
    expect(applyQuestion(s, "afford").target).toBe(s.profile.after);
    expect(applyQuestion(s, "afford").ranges.price.locked).toBe(false);
    expect(applyQuestion(s, "when").ranges.price.locked).toBe(true);
  });
});

describe("verdict", () => {
  it("finds the earliest month that passes, and no earlier one", () => {
    const s = defaults();
    const m = earliestMonth(s)!;
    expect(m).toBeGreaterThan(1);
    const plain = { ...s, target: s.profile.price };
    expect(evaluate(plain, { ...s.profile, months: m }).feasible).toBe(true);
    expect(evaluate(plain, { ...s.profile, months: m - 1 }).feasible).toBe(
      false,
    );
    const v = verdict(s);
    expect(v.tone).toBe("good");
    expect(v.headline).toMatch(/^You can buy a \$300,000 home in /);
    expect(v.profile.months).toBe(m);
  });
  it("says plainly when a home is out of reach", () => {
    const s = defaults();
    s.profile.paymentLimit = 500;
    const v = verdict(s);
    expect(v.tone).toBe("warn");
    expect(v.headline).toContain("out of reach");
  });
  it("answers the afford question with a rounded price that fits", () => {
    const v = verdict(applyQuestion(defaults(), "afford"));
    expect(v.tone).toBe("good");
    expect(v.headline).toMatch(/^You can afford about \$\d{3},000\.$/);
  });
  it("answers a deadline with yes or the earliest date", () => {
    const s = applyQuestion(defaults(), "deadline");
    const early = { ...s, target: 1, profile: { ...s.profile, months: 1 } };
    expect(verdict(early).headline).toMatch(/^Not by /);
    expect(verdict(early).detail).toContain("The earliest");
    const late = { ...s, target: 120, profile: { ...s.profile, months: 120 } };
    expect(verdict(late).headline).toMatch(/^Yes — you can buy/);
  });
  it("answers the income question and states the gap", () => {
    const v = verdict(applyQuestion(defaults(), "income"));
    expect(v.headline).toMatch(/^You need about \$[\d,]+ a year\.$/);
    expect(v.detail).toMatch(/more than you earn today|already earn enough/);
  });
  it("falls back to a plain feasibility line for other goals", () => {
    const s = { ...defaults(), objective: "wealth" as const, target: 1 };
    expect(verdict(s).headline).toMatch(/Your plan (works|needs changes)/);
  });
});
