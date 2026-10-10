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
  filing: string;
  retirement: number;
  benefits: number;
  stateTax: number;
  localTax: number;
  expenses: number;
  rent: number;
  dining: number;
  diningTarget: number;
  medication: number;
  ownLoan: number;
  ownBalance: number;
  partnerLoan: number;
  partnerBalance: number;
  loanMonth: number;
  plus: number;
  plusBalance: number;
  includesPlus: boolean;
  includesFutureLoan: boolean;
  inflation: number;
  reductionMonth: number;
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
  version: 1;
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
    label: "Home purchase price",
    unit: "$",
    description: "Find the changes needed to purchase the home you want.",
    target: 400000,
    mode: "target",
  },
  payment: {
    label: "Monthly housing payment",
    unit: "$",
    description: "Maximize home price within your total housing cost ceiling.",
    target: 2800,
    mode: "maximize",
  },
  date: {
    label: "Home purchase date",
    unit: "months",
    description: "Make closing possible by your selected deadline.",
    target: 20,
    mode: "target",
  },
  before: {
    label: "Savings before purchasing",
    unit: "$",
    description: "Maintain this monthly saving contribution before closing.",
    target: 1000,
    mode: "target",
  },
  after: {
    label: "Savings after purchasing",
    unit: "$",
    description:
      "Maximize home price while preserving monthly savings after closing.",
    target: 1000,
    mode: "maximize",
  },
  income: {
    label: "Household take-home income",
    unit: "$",
    description:
      "Solve for gross salary using your editable incremental take-home assumptions.",
    target: 9000,
    mode: "target",
  },
  salary: {
    label: "Required annual salary",
    unit: "$",
    description:
      "Find the minimum primary salary that makes the home plan feasible.",
    target: 85000,
    mode: "minimize",
  },
  down: {
    label: "Down payment",
    unit: "%",
    description: "Build the cash required for your selected down payment.",
    target: 20,
    mode: "target",
  },
  remaining: {
    label: "Savings after closing",
    unit: "$",
    description: "Protect a minimum cash balance after paying closing costs.",
    target: 20000,
    mode: "target",
  },
  emergency: {
    label: "Minimum emergency fund",
    unit: "months",
    description: "Preserve this many months of post-purchase living expenses.",
    target: 3,
    mode: "target",
  },
  wealth: {
    label: "Long-term net worth",
    unit: "$",
    description:
      "Reach a modeled asset-minus-legal-debt target at your planning horizon.",
    target: 300000,
    mode: "target",
  },
  breakEven: {
    label: "Time to financial break-even",
    unit: "months",
    description:
      "Recover closing and moving costs versus continuing to rent by this horizon.",
    target: 120,
    mode: "target",
  },
  rate: {
    label: "Maximum mortgage interest rate",
    unit: "%",
    description:
      "Find the highest planning rate consistent with cash, housing and saving constraints.",
    target: 6.5,
    mode: "maximize",
  },
};
export const priorityLabels: Record<Priority, string> = {
  payment: "Keep housing costs low",
  reserve: "Preserve more cash at closing",
  spending: "Preserve lifestyle spending",
  months: "Purchase sooner",
  salary: "Minimize salary increases",
};
export function defaults(): Scenario {
  return {
    version: 1,
    id: "default",
    name: "Our first home",
    objective: "price",
    target: 400000,
    mode: "target",
    preferred: false,
    profile: {
      start: "2026-10",
      salary: 70000,
      partnerSalary: 45000,
      net: 7399,
      retention: 75,
      bonus: 0,
      growth: 0,
      raiseSalary: 70000,
      raiseMonth: 0,
      filing: "Married filing jointly",
      retirement: 0,
      benefits: 0,
      stateTax: 3,
      localTax: 1.7,
      expenses: 6726,
      rent: 1826,
      dining: 635,
      diningTarget: 635,
      medication: 500,
      ownLoan: 298.67,
      ownBalance: 26291,
      partnerLoan: 250,
      partnerBalance: 29171,
      loanMonth: 24,
      plus: 745.88,
      plusBalance: 96916.46,
      includesPlus: true,
      includesFutureLoan: false,
      inflation: 0,
      reductionMonth: 0,
      savings: 5700,
      savingsRate: 3,
      preContribution: 0,
      postContribution: 0,
      investment: 0,
      investmentReturn: 0,
      price: 400000,
      down: 10,
      downDollars: 40000,
      downMode: "percent",
      rate: 6.5,
      term: 30,
      tax: 1,
      insurance: 150,
      pmi: 0.5,
      hoa: 0,
      maintenance: 1,
      utilities: 0,
      closing: 3,
      moving: 2000,
      appreciation: 0,
      months: 32,
      reserve: 20000,
      emergencyMonths: 0,
      after: 750,
      paymentLimit: 2800,
      dtiLimit: 43,
      wealthTarget: 300000,
      horizon: 120,
    },
    ranges: {
      salary: { locked: false, min: 70000, max: 160000 },
      spending: { locked: false, min: 300, max: 635 },
      down: { locked: false, min: 3, max: 40 },
      months: { locked: false, min: 1, max: 120 },
      price: { locked: true, min: 150000, max: 650000 },
      rate: { locked: true, min: 0, max: 12 },
    },
    priorities: ["payment", "reserve", "spending", "months", "salary"],
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
