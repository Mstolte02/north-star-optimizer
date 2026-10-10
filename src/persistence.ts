import {
  defaults,
  objectives,
  type Scenario,
  type Lever,
  type Priority,
} from "./model";
export const STORAGE = "north-star.scenarios.v1";
export const STARTING_PLAN = "north-star.starting-plan.v1";
export const CURRENT_PLAN = "north-star.current-plan.v1";
const numericBounds: Record<string, [number, number]> = {
  salary: [0, 10000000],
  partnerSalary: [0, 10000000],
  net: [0, 1000000],
  retention: [1, 100],
  growth: [0, 30],
  retirement: [0, 60],
  raiseMonth: [0, 360],
  futureDebtMonth: [0, 360],
  reductionMonth: [0, 360],
  price: [1, 10000000],
  down: [0, 100],
  rate: [0, 30],
  term: [1, 50],
  savingsRate: [0, 30],
  investmentReturn: [0, 30],
  inflation: [0, 30],
  appreciation: [0, 30],
  closing: [0, 30],
  months: [1, 360],
  horizon: [1, 360],
  emergencyMonths: [0, 60],
  dtiLimit: [1, 100],
  pmi: [0, 10],
  tax: [0, 10],
  maintenance: [0, 10],
};
// Version 1 used named household loans. Fold them into the general debt fields.
function migrateV1(x: Record<string, unknown>) {
  const p = { ...(x.profile as Record<string, unknown>) };
  const n = (k: string) => (typeof p[k] === "number" ? (p[k] as number) : 0);
  const plus = n("plus");
  p.expenses = n("expenses") + (p.includesPlus === false ? plus : 0);
  p.debtPayment = n("ownLoan") + plus;
  p.debtBalance = n("ownBalance") + n("plusBalance");
  p.futureDebtPayment = n("partnerLoan");
  p.futureDebtBalance = n("partnerBalance");
  p.futureDebtMonth = n("loanMonth");
  if (p.includesFutureLoan === true)
    p.expenses = n("expenses") - n("partnerLoan");
  p.flexible = n("dining");
  p.flexibleTarget = n("diningTarget");
  for (const k of [
    "ownLoan",
    "ownBalance",
    "plus",
    "plusBalance",
    "partnerLoan",
    "partnerBalance",
    "loanMonth",
    "dining",
    "diningTarget",
    "medication",
    "includesPlus",
    "includesFutureLoan",
    "filing",
    "stateTax",
    "localTax",
  ])
    delete p[k];
  return { ...x, version: 2, profile: p };
}
export function validateScenario(value: unknown): Scenario {
  if (!value || typeof value !== "object" || Array.isArray(value))
    throw new Error("Scenario must be an object.");
  let x = value as Record<string, unknown>;
  const base = defaults();
  if (x.version === 1 && x.profile && typeof x.profile === "object")
    x = migrateV1(x);
  if (x.version !== 2)
    throw new Error("Unsupported schema version. Expected version 2.");
  if (typeof x.name !== "string" || x.name.length < 1 || x.name.length > 100)
    throw new Error("Provide a scenario name of 1–100 characters.");
  if (
    typeof x.objective !== "string" ||
    !Object.hasOwn(objectives, x.objective)
  )
    throw new Error("Unknown objective.");
  if (
    typeof x.target !== "number" ||
    !Number.isFinite(x.target) ||
    x.target < 0 ||
    x.target > 10000000
  )
    throw new Error("Invalid objective target.");
  if (!["target", "maximize", "minimize"].includes(String(x.mode)))
    throw new Error("Invalid objective mode.");
  const objective = objectives[x.objective as keyof typeof objectives];
  if (x.mode !== objective.mode)
    throw new Error("Objective mode does not match the supported solver.");
  const bound =
    x.objective === "rate"
      ? 30
      : objective.unit === "%"
        ? 100
        : x.objective === "emergency"
          ? 60
          : objective.unit === "months"
            ? 360
            : 10000000;
  if (
    x.target > bound ||
    ((x.objective === "date" ||
      x.objective === "breakEven" ||
      x.objective === "price") &&
      x.target < 1)
  )
    throw new Error("Objective target is out of range.");
  const p = x.profile as Record<string, unknown>;
  if (!p || typeof p !== "object")
    throw new Error("Missing financial profile.");
  for (const [k, v] of Object.entries(base.profile)) {
    const candidate = p[k];
    if (typeof candidate !== typeof v)
      throw new Error(`Invalid or missing ${k}.`);
    if (typeof v === "number") {
      const [min, max] = numericBounds[k] ?? [0, 10000000];
      if (
        !Number.isFinite(candidate) ||
        Number(candidate) < min ||
        Number(candidate) > max
      )
        throw new Error(`${k} is out of range.`);
    }
    if (
      [
        "months",
        "horizon",
        "raiseMonth",
        "futureDebtMonth",
        "reductionMonth",
      ].includes(k) &&
      !Number.isInteger(candidate)
    )
      throw new Error(`${k} must be a whole month.`);
    if (
      k === "start" &&
      (typeof candidate !== "string" ||
        !/^20\d{2}-(0[1-9]|1[0-2])$/.test(candidate))
    )
      throw new Error("Invalid start month.");
    if (k === "downMode" && !["percent", "dollars"].includes(String(candidate)))
      throw new Error("Invalid down payment mode.");
    if (typeof candidate === "string" && candidate.length > 100)
      throw new Error("Text value is too long.");
    (base.profile as unknown as Record<string, unknown>)[k] = candidate;
  }
  const ranges = x.ranges as Record<
    Lever,
    { min: number; max: number; locked: boolean }
  >;
  for (const k of Object.keys(base.ranges) as Lever[]) {
    const r = ranges?.[k];
    if (
      !r ||
      typeof r.locked !== "boolean" ||
      !Number.isFinite(r.min) ||
      !Number.isFinite(r.max) ||
      r.min < 0 ||
      r.max < r.min ||
      r.max > 10000000
    )
      throw new Error(`Invalid ${k} range.`);
    if (
      (k === "down" && r.max > 100) ||
      (k === "rate" && r.max > 30) ||
      (k === "months" && (r.min < 1 || r.max > 360)) ||
      (k === "price" && r.min < 1)
    )
      throw new Error(`Unsafe ${k} range.`);
    base.ranges[k] = { min: r.min, max: r.max, locked: r.locked };
  }
  if (
    !Array.isArray(x.priorities) ||
    x.priorities.length !== 5 ||
    new Set(x.priorities).size !== 5 ||
    !base.priorities.every(
      (k) => x.priorities instanceof Array && x.priorities.includes(k),
    )
  )
    throw new Error("All five priorities must appear exactly once.");
  const t = x.tolerances as Record<Priority, number>;
  for (const k of base.priorities) {
    if (!t || !Number.isFinite(t[k]) || t[k] <= 0 || t[k] > 1000000)
      throw new Error(`Invalid tolerance for ${k}.`);
    base.tolerances[k] = t[k];
  }
  return {
    ...base,
    id:
      typeof x.id === "string" && x.id.length < 100
        ? x.id
        : crypto.randomUUID(),
    name: x.name,
    objective: x.objective as Scenario["objective"],
    target: x.target,
    mode: x.mode as Scenario["mode"],
    priorities: x.priorities as Priority[],
    preferred: x.preferred === true,
  };
}
export function importScenarios(text: string): Scenario[] {
  if (text.length > 1000000) throw new Error("Import is limited to 1 MB.");
  const x = JSON.parse(text);
  const list = Array.isArray(x) ? x : [x];
  if (list.length > 50) throw new Error("Import at most 50 scenarios.");
  return list.map(validateScenario);
}
export function loadScenarios(
  storage: Pick<Storage, "getItem"> = localStorage,
) {
  const s = storage.getItem(STORAGE);
  return s ? importScenarios(s) : [];
}
export function saveScenarios(
  s: Scenario[],
  storage: Pick<Storage, "setItem"> = localStorage,
) {
  storage.setItem(STORAGE, JSON.stringify(s));
}
export function encodeShare(s: Scenario, includeFinancials = false) {
  const payload = includeFinancials
    ? s
    : { version: 2, objective: s.objective, target: s.target, mode: s.mode };
  return (
    "#" +
    (includeFinancials ? "scenario=" : "goal=") +
    btoa(
      String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))),
    )
  );
}
export function decodeShare(hash: string): Scenario | null {
  if (!hash) return null;
  if (hash.length > 30000) throw new Error("Share link is too large.");
  const full = hash.startsWith("#scenario="),
    goal = hash.startsWith("#goal=");
  if (!full && !goal) return null;
  const v = JSON.parse(
    new TextDecoder().decode(
      Uint8Array.from(atob(hash.split("=")[1]), (c) => c.charCodeAt(0)),
    ),
  );
  if (full) return validateScenario(v);
  const b = defaults();
  return validateScenario({ ...b, ...v, name: "Shared goal" });
}
