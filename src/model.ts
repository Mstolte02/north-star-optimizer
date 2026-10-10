export type Objective =
  | "price"
  | "payment"
  | "date"
  | "before"
  | "after"
  | "income"
  | "salary"
  | "down"
  | "remaining"
  | "emergency"
  | "wealth"
  | "breakEven"
  | "rate";
export type Lever =
  "salary" | "spending" | "down" | "months" | "price" | "rate";
export type Priority = "payment" | "reserve" | "spending" | "months" | "salary";
export interface Range {
  locked: boolean;
  min: number;
  max: number;
}
export interface Profile {
  start: string;
  salary: number;
  partnerSalary: number;
  net: number;
  retention: number;
  bonus: number;
  growth: number;
  raiseSalary: number;
  raiseMonth: number;
  retirement: number;
  benefits: number;
  expenses: number;
  rent: number;
  flexible: number;
  flexibleTarget: number;
  reductionMonth: number;
  debtPayment: number;
  debtBalance: number;
  futureDebtPayment: number;
  futureDebtBalance: number;
  futureDebtMonth: number;
  inflation: number;
  savings: number;
  savingsRate: number;
  preContribution: number;
  postContribution: number;
  investment: number;
  investmentReturn: number;
  price: number;
  down: number;
  downDollars: number;
  downMode: "percent" | "dollars";
  rate: number;
  term: number;
  tax: number;
  insurance: number;
  pmi: number;
  hoa: number;
  maintenance: number;
  utilities: number;
  closing: number;
  moving: number;
  appreciation: number;
  months: number;
  reserve: number;
  emergencyMonths: number;
  after: number;
  paymentLimit: number;
  dtiLimit: number;
  wealthTarget: number;
  horizon: number;
}
export interface Scenario {
  version: 2;
  id: string;
  name: string;
  objective: Objective;
  target: number;
  mode: "target" | "maximize" | "minimize";
  profile: Profile;
  ranges: Record<Lever, Range>;
  priorities: Priority[];
  tolerances: Record<Priority, number>;
  preferred: boolean;
}
// The plain question a person starts from. Each maps to one objective.
export type Question = "when" | "afford" | "deadline" | "income";
export const questions: Record<
  Question,
  { title: string; text: string; objective: Objective }
> = {
  when: {
    title: "When can I buy a home?",
    text: "Find the earliest month you could buy the home you want.",
    objective: "price",
  },
  afford: {
    title: "How much home can I afford?",
    text: "Find the highest price that still fits your budget and savings.",
    objective: "after",
  },
  deadline: {
    title: "Can I buy by a certain date?",
    text: "Check a deadline and see what it would take to meet it.",
    objective: "date",
  },
  income: {
    title: "What income do I need?",
    text: "Find the salary that makes your home plan work.",
    objective: "salary",
  },
};
export function questionFor(objective: Objective): Question | undefined {
  return (
    (Object.keys(questions) as Question[]).find(
      (q) => questions[q].objective === objective,
    ) ?? (objective === "payment" ? "afford" : undefined)
  );
}
export function applyQuestion(s: Scenario, q: Question): Scenario {
  const objective = questions[q].objective;
  return {
    ...s,

    objective,
    mode: objectives[objective].mode,
    target:
      objective === "price"
        ? s.profile.price
        : objective === "date"
          ? s.profile.months
          : objective === "after"
            ? s.profile.after
            : objectives[objective].target,
    ranges: {
      ...s.ranges,
      price: { ...s.ranges.price, locked: objective !== "after" },
      rate: { ...s.ranges.rate, locked: true },
    },
  };
}
export const objectives: Record<
  Objective,
  {
    label: string;
    unit: string;
    description: string;
    target: number;
    mode: Scenario["mode"];
  }
> = {
  price: {
    label: "Buy a home at a set price",
    unit: "$",
    description: "Find the changes you need to buy a home at this price.",
    target: 300000,
    mode: "target",
  },
  payment: {
    label: "Keep housing under a monthly cost",
    unit: "$",
    description:
      "Find the most home you can buy while total housing stays under this amount.",
    target: 2400,
    mode: "maximize",
  },
  date: {
    label: "Buy a home by a date",
    unit: "months",
    description: "Make the purchase possible by this deadline.",
    target: 18,
    mode: "target",
  },
  before: {
    label: "Save a set amount each month now",
    unit: "$",
    description: "Keep this monthly saving amount before you buy.",
    target: 800,
    mode: "target",
  },
  after: {
    label: "Keep saving after I buy",
    unit: "$",
    description:
      "Find the most home you can buy and still save this much each month.",
    target: 500,
    mode: "maximize",
  },
  income: {
    label: "Reach a take-home income",
    unit: "$",
    description: "Solve for the salary that gives this monthly take-home pay.",
    target: 5500,
    mode: "target",
  },
  salary: {
    label: "Find the salary I need",
    unit: "$",
    description: "Find the lowest salary that makes the home plan work.",
    target: 85000,
    mode: "minimize",
  },
  down: {
    label: "Make a set down payment",
    unit: "%",
    description: "Save enough for this down payment.",
    target: 20,
    mode: "target",
  },
  remaining: {
    label: "Keep cash after closing",
    unit: "$",
    description: "Keep at least this much cash after you pay closing costs.",
    target: 15000,
    mode: "target",
  },
  emergency: {
    label: "Keep an emergency fund",
    unit: "months",
    description: "Keep this many months of living costs after you buy.",
    target: 3,
    mode: "target",
  },
  wealth: {
    label: "Reach a net worth",
    unit: "$",
    description:
      "Reach this net worth (assets minus debts) by your planning horizon.",
    target: 250000,
    mode: "target",
  },
  breakEven: {
    label: "Beat renting within a time",
    unit: "months",
    description:
      "Recover closing and moving costs, compared with renting, within this time.",
    target: 120,
    mode: "target",
  },
  rate: {
    label: "Find the highest rate I can handle",
    unit: "%",
    description:
      "Find the highest mortgage rate that still fits your cash and saving limits.",
    target: 6.5,
    mode: "maximize",
  },
};
export const priorityLabels: Record<Priority, string> = {
  payment: "Keep housing costs low",
  reserve: "Keep more cash at closing",
  spending: "Keep my flexible spending",
  months: "Buy sooner",
  salary: "Need less extra income",
};
// Example numbers for a typical renter saving for a first home. Every value is editable.
export function defaults(): Scenario {
  return {
    version: 2,
    id: "default",
    name: "My first home",
    objective: "price",
    target: 300000,
    mode: "target",
    preferred: false,
    profile: {
      start: new Date().toISOString().slice(0, 7),
      salary: 72000,
      partnerSalary: 0,
      net: 4700,
      retention: 72,
      bonus: 0,
      growth: 0,
      raiseSalary: 72000,
      raiseMonth: 0,
      retirement: 0,
      benefits: 0,
      expenses: 3500,
      rent: 1500,
      flexible: 450,
      flexibleTarget: 450,
      reductionMonth: 0,
      debtPayment: 300,
      debtBalance: 15000,
      futureDebtPayment: 0,
      futureDebtBalance: 0,
      futureDebtMonth: 0,
      inflation: 0,
      savings: 20000,
      savingsRate: 3,
      preContribution: 0,
      postContribution: 0,
      investment: 0,
      investmentReturn: 0,
      price: 300000,
      down: 10,
      downDollars: 30000,
      downMode: "percent",
      rate: 6.5,
      term: 30,
      tax: 1.1,
      insurance: 125,
      pmi: 0.5,
      hoa: 0,
      maintenance: 1,
      utilities: 0,
      closing: 3,
      moving: 2000,
      appreciation: 0,
      months: 24,
      reserve: 10000,
      emergencyMonths: 0,
      after: 300,
      paymentLimit: 2600,
      dtiLimit: 43,
      wealthTarget: 250000,
      horizon: 120,
    },
    ranges: {
      salary: { locked: false, min: 72000, max: 150000 },
      spending: { locked: false, min: 150, max: 450 },
      down: { locked: false, min: 3, max: 40 },
      months: { locked: false, min: 1, max: 120 },
      price: { locked: true, min: 150000, max: 600000 },
      rate: { locked: true, min: 0, max: 12 },
    },
    priorities: ["salary", "months", "spending", "reserve", "payment"],
    tolerances: {
      payment: 100,
      reserve: 5000,
      spending: 50,
      months: 3,
      salary: 5000,
    },
  };
}
export function dateAt(start: string, m: number) {
  const [y, mo] = start.split("-").map(Number);
  return new Date(Date.UTC(y, mo - 1 + m, 1)).toISOString().slice(0, 7);
}
export function monthDiff(start: string, end: string) {
  const [y, m] = start.split("-").map(Number),
    [yy, mm] = end.split("-").map(Number);
  return (yy - y) * 12 + mm - m;
}
