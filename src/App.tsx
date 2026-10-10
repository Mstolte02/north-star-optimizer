import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  defaults,
  dateAt,
  monthDiff,
  objectives,
  priorityLabels,
  type Scenario,
  type Profile,
  type Lever,
  type Objective,
  type Priority,
} from "./model";
import {
  evaluate,
  salaryThreshold,
  savingsRequired,
  maxPrice,
  income,
  downAmount,
  closingCash,
  type optimize,
} from "./engine";
import { Chart, money, monthLabel } from "./Chart";
import { AnimatedMoney } from "./AnimatedMoney";
import {
  validateScenario,
  decodeShare,
  encodeShare,
  importScenarios,
  loadScenarios,
  saveScenarios,
  STARTING_PLAN,
  CURRENT_PLAN,
} from "./persistence";
import { SetupWizard } from "./SetupWizard";
import { Icon, type IconName } from "./Icon";
import { Results } from "./Results";
import type { Path } from "./engine";

const leverLabels: Record<Lever, string> = {
  salary: "Salary",
  spending: "Flexible spending",
  down: "Down payment %",
  months: "Months until you buy",
  price: "Home price",
  rate: "Mortgage rate %",
};
const leverHints: Record<Lever, string> = {
  salary: "How much your yearly pay could rise.",
  spending: "How far you could cut dining, shopping and fun.",
  down: "The share of the price you pay up front.",
  months: "How long you are willing to wait.",
  price: "Let the planner pick a different home price.",
  rate: "Test a range of mortgage rates.",
};
type Field = {
  key: keyof Profile;
  label: string;
  unit?: string;
  note?: string;
  step?: number;
  max?: number;
};
const groups: {
  title: string;
  icon: IconName;
  intro: string;
  fields: Field[];
}[] = [
  {
    title: "Income",
    icon: "wallet",
    intro:
      "Take-home pay is what reaches your bank account each month. When salary changes, the planner keeps the share of the raise you set below. This is an estimate, not a tax calculation.",
    fields: [
      { key: "salary", label: "Your annual salary (before tax)", unit: "$" },
      {
        key: "partnerSalary",
        label: "Second income, annual (optional)",
        unit: "$",
      },
      { key: "net", label: "Household take-home pay / month", unit: "$" },
      {
        key: "retention",
        label: "Share of a raise you keep after tax",
        unit: "%",
        max: 100,
      },
      { key: "bonus", label: "Yearly bonus after tax", unit: "$" },
      { key: "growth", label: "Yearly salary growth", unit: "%", max: 30 },
      { key: "raiseSalary", label: "Salary after a planned raise", unit: "$" },
      {
        key: "raiseMonth",
        label: "Raise starts in month (0 = none)",
        unit: "mo",
        max: 360,
      },
      {
        key: "retirement",
        label: "Extra retirement saving",
        unit: "%",
        max: 60,
        note: "Percent of gross pay, beyond what is already taken out.",
      },
      { key: "benefits", label: "Extra payroll deductions / month", unit: "$" },
    ],
  },
  {
    title: "Spending & debt",
    icon: "receipt",
    intro:
      "Enter one total for everything you spend each month. Rent, flexible spending and debt payments are parts of that total, so the planner never counts them twice.",
    fields: [
      { key: "expenses", label: "Total monthly spending", unit: "$" },
      {
        key: "rent",
        label: "Rent (part of total)",
        unit: "$",
        note: "Replaced by your home costs after you buy.",
      },
      {
        key: "flexible",
        label: "Flexible spending (part of total)",
        unit: "$",
        note: "Dining out, shopping, fun — the part you could cut.",
      },
      {
        key: "flexibleTarget",
        label: "Planned flexible spending",
        unit: "$",
      },
      {
        key: "reductionMonth",
        label: "Spending change starts in month",
        unit: "mo",
        max: 360,
      },
      {
        key: "debtPayment",
        label: "Debt payments (part of total)",
        unit: "$",
        note: "Car, student and card payments. They stop when the balance is paid.",
      },
      { key: "debtBalance", label: "Total debt balance", unit: "$" },
      {
        key: "futureDebtPayment",
        label: "New debt payment / month",
        unit: "$",
        note: "A payment that starts later, such as a loan leaving deferment.",
      },
      { key: "futureDebtBalance", label: "New debt balance", unit: "$" },
      {
        key: "futureDebtMonth",
        label: "New payment starts in month",
        unit: "mo",
        max: 360,
      },
      {
        key: "inflation",
        label: "Yearly spending and rent growth",
        unit: "%",
        max: 30,
      },
    ],
  },
  {
    title: "Home & mortgage",
    icon: "home",
    intro:
      "These are planning estimates, not lender quotes. Total housing cost includes the mortgage, tax, insurance, PMI, HOA, upkeep and any extra utilities.",
    fields: [
      { key: "price", label: "Home price", unit: "$" },
      { key: "down", label: "Down payment", unit: "%", max: 100 },
      { key: "downDollars", label: "Fixed-dollar down payment", unit: "$" },
      {
        key: "rate",
        label: "Mortgage rate",
        unit: "%",
        step: 0.125,
        max: 30,
      },
      { key: "term", label: "Mortgage term", unit: "yrs", max: 50 },
      {
        key: "tax",
        label: "Property tax / year",
        unit: "%",
        step: 0.1,
        max: 10,
        note: "Percent of the home's value.",
      },
      { key: "insurance", label: "Home insurance / month", unit: "$" },
      {
        key: "pmi",
        label: "PMI / year",
        unit: "%",
        step: 0.1,
        max: 10,
        note: "Percent of the loan. Applies below 20% down.",
      },
      { key: "hoa", label: "HOA / month", unit: "$" },
      {
        key: "maintenance",
        label: "Upkeep / year",
        unit: "%",
        step: 0.1,
        max: 10,
        note: "Percent of the home's value. 1% is a common rule of thumb.",
      },
      { key: "utilities", label: "Extra utilities / month", unit: "$" },
      { key: "closing", label: "Closing costs", unit: "%", max: 30 },
      { key: "moving", label: "Moving costs", unit: "$" },
      {
        key: "appreciation",
        label: "Home value growth / year",
        unit: "%",
        max: 30,
      },
    ],
  },
  {
    title: "Savings & investing",
    icon: "piggy",
    intro:
      "With no limit set, all money left over each month goes into savings. A limit caps what you save; the rest is treated as spent. Investment returns are guesses.",
    fields: [
      { key: "savings", label: "Savings today", unit: "$" },
      { key: "months", label: "Months until you buy", unit: "mo", max: 360 },
      {
        key: "savingsRate",
        label: "Savings interest / year",
        unit: "%",
        max: 30,
      },
      {
        key: "preContribution",
        label: "Saving limit before buying / month",
        unit: "$",
      },
      {
        key: "postContribution",
        label: "Saving limit after buying / month",
        unit: "$",
      },
      { key: "investment", label: "Investing / month", unit: "$" },
      {
        key: "investmentReturn",
        label: "Investment return / year",
        unit: "%",
        max: 30,
      },
      {
        key: "horizon",
        label: "Net-worth horizon",
        unit: "mo",
        max: 360,
      },
    ],
  },
  {
    title: "Your limits",
    icon: "shield",
    intro:
      "Every plan the planner suggests must stay inside these limits. Set them to what would let you sleep at night.",
    fields: [
      {
        key: "paymentLimit",
        label: "Most you'd pay for housing / month",
        unit: "$",
      },
      {
        key: "after",
        label: "Least you'd save after buying / month",
        unit: "$",
      },
      { key: "reserve", label: "Cash to keep after closing", unit: "$" },
      {
        key: "emergencyMonths",
        label: "Emergency fund",
        unit: "mo",
        max: 60,
        note: "Months of living costs to keep after you buy.",
      },
      {
        key: "dtiLimit",
        label: "Highest debt-to-income ratio",
        unit: "%",
        max: 100,
        note: "Lenders often cap this near 43%.",
      },
    ],
  },
];
const minOne = ["term", "months", "horizon", "price", "dtiLimit", "retention"];
const wholeMonths = [
  "months",
  "horizon",
  "raiseMonth",
  "futureDebtMonth",
  "reductionMonth",
];
type Tab =
  | "setup"
  | "results"
  | "plan"
  | "priorities"
  | "explore"
  | "assumptions"
  | "scenarios"
  | "method";
const advanced: { key: Tab; label: string; icon: IconName }[] = [
  { key: "plan", label: "Goal", icon: "target" },
  { key: "priorities", label: "Priorities", icon: "sliders" },
  { key: "explore", label: "Explore", icon: "compass" },
  { key: "assumptions", label: "Assumptions", icon: "list" },
];
const isAdvanced = (t: Tab) => advanced.some((a) => a.key === t);
const nav: { key: Tab; label: string; icon: IconName }[] = [
  { key: "results", label: "Plan", icon: "star" },
  { key: "plan", label: "Advanced", icon: "sliders" },
  { key: "scenarios", label: "Saved", icon: "layers" },
];
function initial() {
  try {
    const shared = decodeShare(window.location.hash);
    const stored = localStorage.getItem(STARTING_PLAN);
    const current = localStorage.getItem(CURRENT_PLAN);
    const starting = stored ? validateScenario(JSON.parse(stored)) : null;
    const working = current ? validateScenario(JSON.parse(current)) : null;
    const s = shared ?? working ?? starting ?? defaults();
    return {
      s,
      start: (starting ?? s).profile,
      error: "",
      ready: Boolean(shared || stored),
    };
  } catch (e) {
    const s = defaults();
    return { s, start: s.profile, error: (e as Error).message, ready: false };
  }
}
function PageHead({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children?: ReactNode;
}) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        <p>{intro}</p>
      </div>
      {children}
    </div>
  );
}
export default function App() {
  const [init] = useState(initial),
    [s, setS] = useState<Scenario>(init.s),
    [tab, setTab] = useState<Tab>("setup"),
    [setupComplete, setSetupComplete] = useState(init.ready),
    [saved, setSaved] = useState<Scenario[]>([]),
    [message, setMessage] = useState(init.error),
    [result, setResult] = useState<ReturnType<typeof optimize> | null>(null),
    [busy, setBusy] = useState(true),
    [drag, setDrag] = useState<Priority | null>(null),
    [shareFull, setShareFull] = useState(false),
    [compare, setCompare] = useState<string[]>([]),
    [journey, setJourney] = useState(0),
    [wizardKey, setWizardKey] = useState(0),
    [start, setStart] = useState(init.start);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(() => setMessage(""), 4000);
    return () => clearTimeout(t);
  }, [message]);
  useEffect(() => {
    if (tab !== "setup") document.querySelector<HTMLElement>("main")?.focus();
  }, [tab]);
  const e = useMemo(() => evaluate(s, s.profile, true), [s]);
  // Keep the working plan across reloads once setup is done.
  useEffect(() => {
    if (!setupComplete) return;
    try {
      localStorage.setItem(CURRENT_PLAN, JSON.stringify(s));
    } catch {
      // Storage blocked; the plan still works for this visit.
    }
  }, [s, setupComplete]);
  useEffect(() => {
    try {
      setSaved(loadScenarios());
    } catch {
      setMessage(
        "Saved scenarios could not be read. Your current plan is still here.",
      );
    }
  }, []);
  useEffect(() => {
    setBusy(true);
    setResult(null);
    const worker = new Worker(
      new URL("./optimizer.worker.ts", import.meta.url),
      { type: "module" },
    );
    const timer = setTimeout(() => worker.postMessage(s), 180);
    worker.onmessage = (ev) => {
      setResult(ev.data);
      setBusy(false);
    };
    worker.onerror = () => {
      setMessage(
        "The planner could not finish. Check your ranges or reset to the example.",
      );
      setBusy(false);
    };
    return () => {
      clearTimeout(timer);
      worker.terminate();
    };
  }, [s]);
  const best = result?.paths[0],
    display = best?.e ?? e,
    p = display.p,
    star = objectives[s.objective];
  const update = (key: keyof Profile, value: number | string | boolean) =>
    setS((old) => {
      if (wholeMonths.includes(key)) value = Math.round(Number(value));
      const p = { ...old.profile, [key]: value };
      if (key === "salary" || key === "partnerSalary")
        p.net +=
          ((Number(value) - Number(old.profile[key])) * old.profile.retention) /
          1200;
      // Parts of the spending total move the total by the same amount.
      if (key === "rent" || key === "flexible" || key === "debtPayment")
        p.expenses += Number(value) - Number(old.profile[key]);
      if (
        key === "flexible" &&
        old.profile.flexibleTarget === old.profile.flexible
      )
        p.flexibleTarget = Number(value);
      const target =
        old.objective === "price" && key === "price"
          ? Number(value)
          : old.target;
      return { ...old, profile: p, target };
    });
  const targetChange = (value: number) =>
    setS((old) => ({
      ...old,
      target: value,
      profile: {
        ...old.profile,
        ...(old.objective === "price" ? { price: value } : {}),
        ...(old.objective === "date" ? { months: Math.max(1, value) } : {}),
      },
    }));
  const choose = (objective: Objective) =>
    setS((old) => {
      const st = objectives[objective];
      const ranges = {
        ...old.ranges,
        price: {
          ...old.ranges.price,
          locked: !(objective === "payment" || objective === "after"),
        },
        rate: { ...old.ranges.rate, locked: objective !== "rate" },
      };
      return {
        ...old,
        objective,
        target: objective === "price" ? old.profile.price : st.target,
        mode: st.mode,
        ranges,
      };
    });
  const reorder = (key: Priority, to: number) =>
    setS((old) => {
      const arr = old.priorities.filter((x) => x !== key);
      arr.splice(Math.max(0, Math.min(4, to)), 0, key);
      return { ...old, priorities: arr };
    });
  const setRange = (k: Lever, r: Partial<Scenario["ranges"][Lever]>) =>
    setS((old) => ({
      ...old,
      ranges: { ...old.ranges, [k]: { ...old.ranges[k], ...r } },
    }));
  const persist = (list: Scenario[]) => {
    if (list.length > 50) {
      setMessage(
        "You can keep up to 50 scenarios. Export or delete one first.",
      );
      return false;
    }
    try {
      saveScenarios(list);
      setSaved(list);
      return true;
    } catch {
      setMessage(
        "Browser storage is full or blocked. Export JSON to keep your scenarios.",
      );
      return false;
    }
  };
  const save = () => {
    const item = { ...s, id: crypto.randomUUID() };
    if (persist([...saved, item]))
      setMessage(`Saved “${s.name}” in this browser.`);
  };
  const exportJson = () => {
    const blob = new Blob(
      [JSON.stringify(saved.length ? saved : [s], null, 2)],
      { type: "application/json" },
    );
    const url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = "north-star-scenarios.json";
    a.click();
    URL.revokeObjectURL(url);
  };
  const thresholdBreak = useMemo(() => salaryThreshold(s, false), [s]),
    thresholdComfort = useMemo(() => salaryThreshold(s, true), [s]),
    priceCeiling = useMemo(() => maxPrice(s), [s]);
  const heroValue =
    s.objective === "price"
      ? money(s.target)
      : s.objective === "date"
        ? monthLabel(s.profile, s.target)
        : s.objective === "salary"
          ? money(best?.e.p.salary ?? s.profile.salary)
          : s.objective === "rate"
            ? `${p.rate.toFixed(2)}%`
            : s.objective === "payment" || s.objective === "after"
              ? money(p.price)
              : star.unit === "$"
                ? money(s.target)
                : `${s.target} ${star.unit}`;
  const heroLabel =
    s.objective === "payment" || s.objective === "after"
      ? "Home price you can reach"
      : s.objective === "salary"
        ? "Salary you need"
        : s.objective === "rate"
          ? "Highest rate that works"
          : star.label;
  const targetMax =
    s.objective === "emergency"
      ? 60
      : star.unit === "%"
        ? 100
        : star.unit === "months"
          ? 360
          : 10000000;
  const status = busy
    ? { text: "Working…", tone: "busy" }
    : best
      ? { text: "Within your limits", tone: "good" }
      : { text: "Changes needed", tone: "warn" };
  const go = (t: Tab) => {
    // Each visit to setup starts the wizard again from the first question.
    if (t === "setup") setWizardKey((k) => k + 1);
    setTab(t);
    window.scrollTo?.(0, 0);
  };
  const applyPath = (path: Path) => {
    setS({ ...s, profile: path.e.p, name: path.name });
    setMessage(`“${path.name}” is now your plan.`);
  };
  const saveBar = (
    <div className="save-bar">
      <label>
        <span>Scenario name</span>
        <input
          value={s.name}
          maxLength={100}
          onChange={(ev) => setS({ ...s, name: ev.target.value })}
        />
      </label>
      <button className="primary" disabled={!s.name.trim()} onClick={save}>
        <Icon name="save" /> Save this scenario
      </button>
    </div>
  );
  return (
    <div className="app">
      {tab !== "setup" && (
        <header className="topbar">
          <a
            className="brand"
            href="#"
            onClick={(ev) => {
              ev.preventDefault();
              go(setupComplete ? "results" : "setup");
            }}
          >
            <span className="brand-mark" aria-hidden="true">
              <Icon name="star" />
            </span>
            <span className="brand-name">North Star</span>
          </a>
          {
            <nav aria-label="Main navigation" className="tabs">
              {nav.map((n) => {
                const on = n.key === "plan" ? isAdvanced(tab) : tab === n.key;
                return (
                  <button
                    key={n.key}
                    aria-current={on ? "page" : undefined}
                    className={on ? "active" : ""}
                    onClick={() => go(n.key)}
                  >
                    <Icon name={n.icon} />
                    <span>{n.label}</span>
                    {n.key === "scenarios" && saved.length > 0 && (
                      <span className="count">{saved.length}</span>
                    )}
                  </button>
                );
              })}
            </nav>
          }
          <span className="topbar-note">
            Runs in your browser · nothing is uploaded
          </span>
        </header>
      )}
      <main tabIndex={-1} className={`page page-${tab}`}>
        {message && (
          <div className="toast" role="status">
            <span>{message}</span>
            <button
              className="icon-button"
              aria-label="Dismiss message"
              onClick={() => setMessage("")}
            >
              <Icon name="x" />
            </button>
          </div>
        )}
        {isAdvanced(tab) && (
          <nav className="subtabs" aria-label="Advanced settings">
            {advanced.map((a) => (
              <button
                key={a.key}
                aria-current={tab === a.key ? "page" : undefined}
                className={tab === a.key ? "active" : ""}
                onClick={() => go(a.key)}
              >
                <Icon name={a.icon} />
                {a.label}
              </button>
            ))}
          </nav>
        )}
        {tab === "results" && (
          <Results
            s={s}
            setS={setS}
            start={start}
            step={journey}
            setStep={setJourney}
            result={result}
            busy={busy}
            onApply={applyPath}
            onSave={save}
            onAdvanced={() => go("plan")}
            onStartOver={() => go("setup")}
          />
        )}
        {tab === "setup" && (
          <>
            <SetupWizard
              key={wizardKey}
              scenario={s}
              onSkip={setupComplete ? () => go("results") : undefined}
              onComplete={(plan) => {
                setS(plan);
                setStart(plan.profile);
                setJourney(0);
                setSetupComplete(true);
                go("results");
                try {
                  localStorage.setItem(STARTING_PLAN, JSON.stringify(plan));
                } catch {
                  setMessage(
                    "Your plan is ready. Browser storage is blocked, so export it to keep it.",
                  );
                }
              }}
            />
          </>
        )}

        {tab === "plan" && (
          <>
            <section className="goal-panel" aria-labelledby="goal-heading">
              <div className="goal-intro">
                <span className="kicker">
                  <Icon name="star" /> Advanced
                </span>
                <h1 id="goal-heading">Choose from every goal.</h1>
                <p>
                  Your answer page covers the four common questions. Here you
                  can pick any of thirteen goals and see the full result, then
                  fine-tune priorities and assumptions.
                </p>
              </div>
              <div className="goal-control">
                <label htmlFor="objective">Your goal</label>
                <select
                  id="objective"
                  value={s.objective}
                  onChange={(ev) => choose(ev.target.value as Objective)}
                >
                  {Object.entries(objectives).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v.label}
                    </option>
                  ))}
                </select>
                <div className="target-control">
                  {s.objective === "date" ? (
                    <input
                      aria-label="Target purchase date"
                      type="month"
                      value={dateAt(s.profile.start, s.target)}
                      min={dateAt(s.profile.start, 1)}
                      max={dateAt(s.profile.start, 360)}
                      onChange={(ev) =>
                        targetChange(
                          Math.max(
                            1,
                            monthDiff(s.profile.start, ev.target.value),
                          ),
                        )
                      }
                    />
                  ) : s.objective === "salary" || s.objective === "rate" ? (
                    <span className="target-auto">
                      {s.objective === "rate"
                        ? "Find the highest rate that works"
                        : "Solve for the minimum"}
                    </span>
                  ) : (
                    <div className="affix">
                      {star.unit === "$" && <span>$</span>}
                      <input
                        aria-label="Goal target"
                        type="number"
                        min={star.unit === "months" ? 1 : 0}
                        max={targetMax}
                        step={star.unit === "%" ? 0.1 : 1}
                        value={s.target}
                        onChange={(ev) =>
                          targetChange(
                            Math.min(
                              targetMax,
                              Math.max(
                                star.unit === "months" ||
                                  s.objective === "price"
                                  ? 1
                                  : 0,
                                Number(ev.target.value),
                              ),
                            ),
                          )
                        }
                      />
                      {star.unit !== "$" && <span>{star.unit}</span>}
                    </div>
                  )}
                </div>
                <p className="hint">{star.description}</p>
              </div>
            </section>

            <section className="result" aria-live="polite">
              <div className="result-main">
                <div className="result-top">
                  <span className={`chip chip-${status.tone}`}>
                    <span className="dot" aria-hidden="true" />
                    {status.text}
                  </span>
                  <span className="result-caption">
                    {busy
                      ? "Testing combinations"
                      : best
                        ? "Best match for your priorities"
                        : "Your plan as entered"}
                  </span>
                </div>
                <div className="hero-number">{heroValue}</div>
                <p className="hero-label">{heroLabel}</p>
                {best && (
                  <div className="changes">
                    <h2>What changes</h2>
                    <ul>
                      {best.changes.map((c) => (
                        <li key={c}>
                          <Icon name="check" />
                          {c}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {!busy && !best && (
                  <div className="conflicts">
                    <h2>No plan fits your limits yet</h2>
                    <ul>
                      {e.violations.map((v) => (
                        <li key={v}>
                          <Icon name="alert" />
                          {v}
                        </li>
                      ))}
                    </ul>
                    <p>
                      Try allowing more time, a higher salary ceiling, a higher
                      housing limit or a smaller cash cushion on the{" "}
                      <button className="link" onClick={() => go("priorities")}>
                        Priorities
                      </button>{" "}
                      page.
                    </p>
                  </div>
                )}
              </div>
              <dl className="kpis">
                <div>
                  <dt>You buy in</dt>
                  <dd>{monthLabel(p, p.months)}</dd>
                </div>
                <div>
                  <dt>Housing / month</dt>
                  <dd>
                    <AnimatedMoney value={display.house.total} />
                  </dd>
                </div>
                <div>
                  <dt>Cash after closing</dt>
                  <dd>
                    <AnimatedMoney value={display.remaining} />
                  </dd>
                </div>
                <div>
                  <dt>Saved / month after</dt>
                  <dd className={display.after < 0 ? "negative" : ""}>
                    <AnimatedMoney value={display.after} />
                  </dd>
                </div>
              </dl>
            </section>

            <section className="card">
              <Chart
                p={p}
                objective={s.objective}
                protectedReserve={display.reserve}
              />
            </section>

            <div className="next-steps">
              {(
                [
                  [
                    "priorities",
                    "sliders",
                    "Set priorities",
                    "Rank what matters and choose what can change.",
                  ],
                  [
                    "explore",
                    "compass",
                    "Explore paths",
                    "Compare other routes and see the math.",
                  ],
                  [
                    "assumptions",
                    "list",
                    "Edit assumptions",
                    "Fine-tune income, spending and the home.",
                  ],
                ] as const
              ).map(([t, icon, title, text]) => (
                <button key={t} className="next" onClick={() => go(t)}>
                  <Icon name={icon} />
                  <span>
                    <strong>{title}</strong>
                    <small>{text}</small>
                  </span>
                  <Icon name="arrow" />
                </button>
              ))}
            </div>
            {saveBar}
          </>
        )}

        {tab === "priorities" && (
          <>
            <PageHead
              title="Your priorities"
              intro="Rank what matters, then decide which numbers the planner is allowed to change."
            />
            <div className="two-col">
              <section className="card">
                <div className="card-head">
                  <h2>What matters most</h2>
                  <p>
                    Drag to reorder, or use the arrows. Higher items win when
                    two plans differ by more than the tolerance.
                  </p>
                </div>
                <ol className="priorities">
                  {s.priorities.map((k, i) => (
                    <li
                      key={k}
                      draggable
                      onDragStart={() => setDrag(k)}
                      onDragOver={(ev) => ev.preventDefault()}
                      onDrop={() => {
                        if (drag) reorder(drag, i);
                        setDrag(null);
                      }}
                    >
                      <span className="rank">{i + 1}</span>
                      <div className="priority-body">
                        <strong>{priorityLabels[k]}</strong>
                        <label className="tolerance">
                          <span>Tolerance</span>
                          <input
                            type="number"
                            aria-label={`${priorityLabels[k]} tolerance`}
                            min="1"
                            max="1000000"
                            value={s.tolerances[k]}
                            onChange={(ev) =>
                              setS({
                                ...s,
                                tolerances: {
                                  ...s.tolerances,
                                  [k]: Math.max(1, Number(ev.target.value)),
                                },
                              })
                            }
                          />
                          <span>
                            {k === "months"
                              ? "months"
                              : k === "salary"
                                ? "$ / yr"
                                : "$"}
                          </span>
                        </label>
                      </div>
                      <div className="reorder">
                        <button
                          className="icon-button"
                          disabled={i === 0}
                          aria-label={`Move ${priorityLabels[k]} up`}
                          onClick={() => reorder(k, i - 1)}
                        >
                          <Icon name="up" />
                        </button>
                        <button
                          className="icon-button"
                          disabled={i === 4}
                          aria-label={`Move ${priorityLabels[k]} down`}
                          onClick={() => reorder(k, i + 1)}
                        >
                          <Icon name="down" />
                        </button>
                      </div>
                    </li>
                  ))}
                </ol>
              </section>
              <section className="card">
                <div className="card-head">
                  <h2>What can change</h2>
                  <p>
                    Locked numbers stay as entered. Flexible numbers may move
                    inside the range you set. Your limits always apply.
                  </p>
                </div>
                <div className="levers">
                  {(Object.keys(s.ranges) as Lever[]).map((k) => {
                    const r = s.ranges[k];
                    const cap =
                      k === "down"
                        ? 100
                        : k === "rate"
                          ? 30
                          : k === "months"
                            ? 360
                            : 10000000;
                    const floor = k === "months" || k === "price" ? 1 : 0;
                    return (
                      <div
                        className={`lever ${r.locked ? "is-locked" : ""}`}
                        key={k}
                      >
                        <div className="lever-top">
                          <div>
                            <strong id={`lever-${k}`}>{leverLabels[k]}</strong>
                            <small>{leverHints[k]}</small>
                          </div>
                          <button
                            className="switch"
                            aria-labelledby={`lever-${k}`}
                            aria-pressed={r.locked}
                            onClick={() => setRange(k, { locked: !r.locked })}
                          >
                            <Icon name={r.locked ? "lock" : "unlock"} />
                            {r.locked ? "Locked" : "Flexible"}
                          </button>
                        </div>
                        {!r.locked && (
                          <div className="range-pair">
                            <label>
                              <span>From</span>
                              <input
                                type="number"
                                aria-label={`${leverLabels[k]} minimum`}
                                min={floor}
                                value={r.min}
                                onChange={(ev) => {
                                  const min = Math.max(
                                    floor,
                                    Number(ev.target.value),
                                  );
                                  setRange(k, {
                                    min,
                                    max: Math.max(min, r.max),
                                  });
                                }}
                              />
                            </label>
                            <label>
                              <span>To</span>
                              <input
                                type="number"
                                aria-label={`${leverLabels[k]} maximum`}
                                min={r.min}
                                max={cap}
                                value={r.max}
                                onChange={(ev) =>
                                  setRange(k, {
                                    max: Math.min(
                                      cap,
                                      Math.max(r.min, Number(ev.target.value)),
                                    ),
                                  })
                                }
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                {s.profile.downMode === "dollars" && (
                  <p className="warning">
                    A fixed-dollar down payment needs the down payment lever
                    locked.
                  </p>
                )}
              </section>
            </div>
          </>
        )}

        {tab === "explore" && (
          <>
            <PageHead
              title="Explore your options"
              intro="Compare other routes to your goal and check the math behind them."
            />
            <section className="card">
              <div className="card-head">
                <h2>What has to be true?</h2>
                <p>
                  Based on the plan as entered: your purchase date, price and
                  down payment.
                </p>
              </div>
              <div className="stat-grid">
                <div className="stat">
                  <span>Lowest salary that works</span>
                  <strong>
                    {thresholdBreak === null
                      ? "Salary alone can't fix it"
                      : money(thresholdBreak)}
                  </strong>
                  <small>
                    With no extra cash cushion. All other limits stay.
                  </small>
                </div>
                <div className="stat">
                  <span>Comfortable salary</span>
                  <strong>
                    {thresholdComfort === null
                      ? "Salary alone can't fix it"
                      : money(thresholdComfort)}
                  </strong>
                  <small>
                    Keeps {money(s.profile.reserve)} at closing and{" "}
                    {money(s.profile.after)}/month saving after.
                  </small>
                </div>
                <div className="stat">
                  <span>Monthly saving needed</span>
                  <strong>{money(savingsRequired(s.profile) ?? 0)}</strong>
                  <small>
                    Average to have closing cash and reserves by{" "}
                    {monthLabel(s.profile, s.profile.months)}.
                  </small>
                </div>
                <div className="stat">
                  <span>Most home you can afford</span>
                  <strong>
                    {priceCeiling === null
                      ? "No price fits"
                      : money(priceCeiling)}
                  </strong>
                  <small>At your current income and purchase date.</small>
                </div>
              </div>
            </section>
            <section className="card">
              <div className="card-head">
                <h2>Paths worth considering</h2>
                <p>
                  Each path holds different numbers fixed, then follows your
                  priorities. Only paths that pass every limit appear.
                </p>
              </div>
              {busy ? (
                <p className="loading">Finding your paths…</p>
              ) : result?.paths.length ? (
                <div className="paths">
                  {result.paths.map((path, i) => (
                    <article className="path" key={path.name}>
                      <div className="path-head">
                        <span className="rank">{i + 1}</span>
                        <h3>{path.name}</h3>
                        <button
                          className="secondary"
                          onClick={() => {
                            setS({ ...s, profile: path.e.p, name: path.name });
                            setMessage(
                              "Path applied. Check the changes on the Assumptions page.",
                            );
                          }}
                        >
                          Use this path
                        </button>
                      </div>
                      <p>{path.changes.join(" · ")}</p>
                      <dl className="path-data">
                        <div>
                          <dt>Salary</dt>
                          <dd>{money(path.e.p.salary)}</dd>
                        </div>
                        <div>
                          <dt>Buy in</dt>
                          <dd>{monthLabel(path.e.p, path.e.p.months)}</dd>
                        </div>
                        <div>
                          <dt>Cash left</dt>
                          <dd>{money(path.e.remaining)}</dd>
                        </div>
                        <div>
                          <dt>Saved / mo</dt>
                          <dd>{money(path.e.after)}</dd>
                        </div>
                      </dl>
                    </article>
                  ))}
                </div>
              ) : (
                <p className="empty">
                  No path fits yet. Loosen a limit or allow more numbers to
                  change.
                </p>
              )}
              <p className="fine">{result?.method}</p>
            </section>
            <div className="two-col">
              <section className="card">
                <div className="card-head">
                  <h2>How sensitive is your plan?</h2>
                  <p>Each row changes one number in the plan as entered.</p>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Change</th>
                        <th>Housing / mo</th>
                        <th>Saved / mo</th>
                        <th>Cash left</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        {
                          label: "Rate +1 point",
                          p: { ...s.profile, rate: s.profile.rate + 1 },
                        },
                        {
                          label: "Price −$25,000",
                          p: {
                            ...s.profile,
                            price: Math.max(1, s.profile.price - 25000),
                          },
                        },
                        {
                          label: "Flexible spending −$150",
                          p: {
                            ...s.profile,
                            flexibleTarget: Math.max(
                              0,
                              s.profile.flexibleTarget - 150,
                            ),
                          },
                        },
                        {
                          label: "Wait 12 more months",
                          p: {
                            ...s.profile,
                            months: Math.min(360, s.profile.months + 12),
                          },
                        },
                      ].map((x) => {
                        const d = evaluate(s, x.p);
                        return (
                          <tr key={x.label}>
                            <th>{x.label}</th>
                            <td>{money(d.house.total)}</td>
                            <td>{money(d.after)}</td>
                            <td>{money(d.remaining)}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
              <section className="card">
                <div className="card-head">
                  <h2>The arithmetic</h2>
                  <p>For the plan shown on the Plan page.</p>
                </div>
                <dl className="ledger">
                  <div>
                    <dt>Principal &amp; interest / mo</dt>
                    <dd>{money(display.house.pi)}</dd>
                  </div>
                  <div>
                    <dt>Tax, insurance &amp; PMI / mo</dt>
                    <dd>{money(display.house.piti - display.house.pi)}</dd>
                  </div>
                  <div>
                    <dt>Upkeep, HOA &amp; utilities / mo</dt>
                    <dd>{money(display.house.total - display.house.piti)}</dd>
                  </div>
                  <div>
                    <dt>Down payment</dt>
                    <dd>
                      {money(downAmount(p))} (
                      {((downAmount(p) / p.price) * 100).toFixed(1)}%)
                    </dd>
                  </div>
                  <div>
                    <dt>Closing &amp; moving</dt>
                    <dd>{money(closingCash(p) - downAmount(p))}</dd>
                  </div>
                  <div>
                    <dt>Savings just before closing</dt>
                    <dd>{money(display.cash)}</dd>
                  </div>
                  <div>
                    <dt>Cash you must keep</dt>
                    <dd>{money(display.reserve)}</dd>
                  </div>
                  <div>
                    <dt>Take-home at purchase / mo</dt>
                    <dd>{money(income(p, p.months))}</dd>
                  </div>
                  <div>
                    <dt>Debt-to-income</dt>
                    <dd>{display.dti.toFixed(1)}%</dd>
                  </div>
                  <div>
                    <dt>Net worth in {monthLabel(p, p.horizon)}</dt>
                    <dd>{money(display.wealth)}</dd>
                  </div>
                  <div>
                    <dt>Beats renting after</dt>
                    <dd>
                      {display.breakEven === null
                        ? "More than 30 years"
                        : `${display.breakEven} months`}
                    </dd>
                  </div>
                </dl>
              </section>
            </div>
          </>
        )}

        {tab === "assumptions" && (
          <>
            <PageHead
              title="Your assumptions"
              intro="Every number behind the plan. Change any of them; the plan updates as you type."
            >
              <div className="head-actions">
                <button className="secondary" onClick={() => go("setup")}>
                  Edit starting numbers
                </button>
                <button className="ghost" onClick={() => setS(defaults())}>
                  Reset to example
                </button>
              </div>
            </PageHead>
            <div className="summary-strip">
              <div>
                <span>Left over today / month</span>
                <strong className={e.before < 0 ? "negative" : ""}>
                  {money(
                    evaluate({
                      ...s,
                      profile: {
                        ...s.profile,
                        flexibleTarget: s.profile.flexible,
                      },
                    }).before,
                  )}
                </strong>
              </div>
              <div>
                <span>Take-home / month</span>
                <strong>{money(s.profile.net)}</strong>
              </div>
              <div>
                <span>Spending / month</span>
                <strong>{money(s.profile.expenses)}</strong>
              </div>
              <div>
                <span>Savings today</span>
                <strong>{money(s.profile.savings)}</strong>
              </div>
            </div>
            <section className="card meta-card">
              <label>
                <span>Plan starts</span>
                <input
                  type="month"
                  min="2020-01"
                  max="2099-12"
                  value={s.profile.start}
                  onChange={(ev) => {
                    if (ev.target.value) update("start", ev.target.value);
                  }}
                />
              </label>
              <label>
                <span>Down payment set as</span>
                <select
                  value={s.profile.downMode}
                  onChange={(ev) => {
                    update("downMode", ev.target.value);
                    if (ev.target.value === "dollars")
                      setRange("down", { locked: true });
                  }}
                >
                  <option value="percent">Percent of price</option>
                  <option value="dollars">Fixed dollar amount</option>
                </select>
              </label>
            </section>
            <div className="groups">
              {groups.map((g, gi) => (
                <details key={g.title} className="group card" open={gi < 2}>
                  <summary>
                    <span className="group-icon">
                      <Icon name={g.icon} />
                    </span>
                    <span className="group-title">{g.title}</span>
                    <Icon name="chevron" />
                  </summary>
                  <p className="group-intro">{g.intro}</p>
                  <div className="fields">
                    {g.fields.map((f) => (
                      <div key={f.key} className="field">
                        <label htmlFor={`f-${f.key}`}>{f.label}</label>
                        <div className="affix">
                          {f.unit === "$" && <span aria-hidden="true">$</span>}
                          <input
                            id={`f-${f.key}`}
                            aria-describedby={
                              f.note ? `f-${f.key}-note` : undefined
                            }
                            type="number"
                            min={minOne.includes(f.key) ? 1 : 0}
                            max={f.max ?? 10000000}
                            step={f.step ?? (f.unit === "$" ? 0.01 : 1)}
                            value={s.profile[f.key] as number}
                            onChange={(ev) =>
                              update(
                                f.key,
                                Math.min(
                                  f.max ?? 10000000,
                                  Math.max(
                                    minOne.includes(f.key) ? 1 : 0,
                                    Number(ev.target.value),
                                  ),
                                ),
                              )
                            }
                          />
                          {f.unit && f.unit !== "$" && (
                            <span aria-hidden="true">{f.unit}</span>
                          )}
                        </div>
                        {f.note && (
                          <small id={`f-${f.key}-note`}>{f.note}</small>
                        )}
                      </div>
                    ))}
                  </div>
                </details>
              ))}
            </div>
            {saveBar}
          </>
        )}

        {tab === "scenarios" && (
          <>
            <PageHead
              title="Scenarios"
              intro="Save versions of your plan and compare them side by side. Scenarios stay in this browser only."
            >
              <div className="head-actions">
                <button className="primary" onClick={save}>
                  <Icon name="save" /> Save current plan
                </button>
                <button className="secondary" onClick={exportJson}>
                  Export JSON
                </button>
                <button
                  className="secondary"
                  onClick={() => file.current?.click()}
                >
                  Import JSON
                </button>
                <input
                  ref={file}
                  type="file"
                  accept="application/json,.json"
                  hidden
                  onChange={async (ev) => {
                    const f = ev.target.files?.[0];
                    if (!f) return;
                    try {
                      if (f.size > 1000000)
                        throw new Error("Files are limited to 1 MB.");
                      const list = importScenarios(await f.text()).map((x) => ({
                        ...x,
                        id: crypto.randomUUID(),
                      }));
                      if (saved.length + list.length > 50)
                        throw new Error("You can keep up to 50 scenarios.");
                      if (persist([...saved, ...list]))
                        setMessage(`Imported ${list.length} scenario(s).`);
                    } catch (error) {
                      setMessage((error as Error).message);
                    }
                    ev.target.value = "";
                  }}
                />
              </div>
            </PageHead>
            {!saved.length && (
              <div className="card empty-state">
                <Icon name="layers" />
                <p>Your saved scenarios will appear here.</p>
              </div>
            )}
            <div className="scenario-list">
              {saved.map((item) => {
                const ev = evaluate(item, item.profile, true);
                return (
                  <article className="scenario card" key={item.id}>
                    <label className="compare-check">
                      <input
                        type="checkbox"
                        checked={compare.includes(item.id)}
                        onChange={(event) =>
                          setCompare(
                            event.target.checked
                              ? [...compare, item.id].slice(-4)
                              : compare.filter((x) => x !== item.id),
                          )
                        }
                      />
                      <span>Compare</span>
                    </label>
                    <div className="scenario-body">
                      <h2>
                        {item.name}
                        {item.preferred && (
                          <span className="chip chip-star">
                            <Icon name="star" /> Preferred
                          </span>
                        )}
                      </h2>
                      <p>
                        {objectives[item.objective].label} ·{" "}
                        {money(item.profile.price)} home ·{" "}
                        {monthLabel(item.profile, item.profile.months)}
                      </p>
                      <span
                        className={`chip chip-${ev.feasible ? "good" : "warn"}`}
                      >
                        <span className="dot" aria-hidden="true" />
                        {ev.feasible ? "Works as entered" : "Needs changes"}
                      </span>
                    </div>
                    <div className="scenario-actions">
                      <button
                        className="secondary"
                        onClick={() => {
                          setS(item);
                          setJourney(0);
                          setSetupComplete(true);
                          go("results");
                        }}
                      >
                        Open
                      </button>
                      <button
                        className="ghost"
                        onClick={() =>
                          persist([
                            ...saved,
                            {
                              ...item,
                              id: crypto.randomUUID(),
                              name: `${item.name} copy`.slice(0, 100),
                              preferred: false,
                            },
                          ])
                        }
                      >
                        Duplicate
                      </button>
                      <button
                        className="ghost"
                        onClick={() => {
                          const name = window.prompt(
                            "Rename scenario",
                            item.name,
                          );
                          if (name?.trim())
                            persist(
                              saved.map((x) =>
                                x.id === item.id
                                  ? { ...x, name: name.slice(0, 100) }
                                  : x,
                              ),
                            );
                        }}
                      >
                        Rename
                      </button>
                      <button
                        className="ghost"
                        onClick={() =>
                          persist(
                            saved.map((x) => ({
                              ...x,
                              preferred: x.id === item.id,
                            })),
                          )
                        }
                      >
                        Prefer
                      </button>
                      <button
                        className="ghost danger"
                        onClick={() => {
                          if (window.confirm(`Delete “${item.name}”?`))
                            persist(saved.filter((x) => x.id !== item.id));
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
            {compare.length > 0 && (
              <section className="card">
                <div className="card-head">
                  <h2>Side by side</h2>
                  <p>Plans as entered, not the planner's suggested paths.</p>
                </div>
                <div className="table-scroll">
                  <table>
                    <thead>
                      <tr>
                        <th>Measure</th>
                        {saved
                          .filter((x) => compare.includes(x.id))
                          .map((x) => (
                            <th key={x.id}>{x.name}</th>
                          ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[
                        "Home price",
                        "Housing / month",
                        "Saved / month after",
                        "Cash after closing",
                        "Salary",
                        "Net worth at horizon",
                      ].map((label, i) => (
                        <tr key={label}>
                          <th>{label}</th>
                          {saved
                            .filter((x) => compare.includes(x.id))
                            .map((x) => {
                              const v = evaluate(x, x.profile, true);
                              return (
                                <td key={x.id}>
                                  {money(
                                    [
                                      x.profile.price,
                                      v.house.total,
                                      v.after,
                                      v.remaining,
                                      x.profile.salary,
                                      v.wealth,
                                    ][i],
                                  )}
                                </td>
                              );
                            })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            <section className="card share">
              <div className="card-head">
                <h2>Share your goal</h2>
                <p>
                  By default the link holds only your goal and target. Your
                  financial numbers stay out of it.
                </p>
              </div>
              <label className="check">
                <input
                  type="checkbox"
                  checked={shareFull}
                  onChange={(ev) => setShareFull(ev.target.checked)}
                />
                <span>
                  Include all my numbers (anyone with the link can read them)
                </span>
              </label>
              <button
                className="secondary"
                onClick={async () => {
                  const url =
                    window.location.href.split("#")[0] +
                    encodeShare(s, shareFull);
                  try {
                    await navigator.clipboard.writeText(url);
                    setMessage(
                      shareFull
                        ? "Full scenario link copied."
                        : "Goal-only link copied.",
                    );
                  } catch {
                    setMessage(url);
                  }
                }}
              >
                <Icon name="link" /> Copy share link
              </button>
            </section>
          </>
        )}

        {tab === "method" && (
          <>
            <PageHead
              title="How the math works"
              intro="North Star is a planning tool, not financial advice. Here is exactly what it does."
            />
            <div className="method-grid">
              {[
                [
                  "Limits come first",
                  "Every suggested plan must meet your goal, your housing limit, your cash cushion, your monthly saving floor and your debt-to-income limit. If nothing passes, North Star says so instead of inventing an answer.",
                ],
                [
                  "Then your priorities",
                  "The planner searches a grid of prices, down payments, flexible-spending levels, purchase dates and (when allowed) rates, and solves for salary. Plans that pass are ranked by your priority order, in steps the size of each tolerance. It is a sampled search, so it can miss a plan that falls between grid points.",
                ],
                [
                  "Mortgage math",
                  "Monthly principal and interest = loan × r ÷ (1 − (1 + r)^−n), where r is the monthly rate and n the number of payments. PMI applies below 20% down and ends when the scheduled balance reaches 78% of the original price, as on a typical conventional loan.",
                ],
                [
                  "Cash flow, not a budget app",
                  "Before you buy, money left over = take-home pay − spending − investing. After you buy, rent drops out and the full cost of owning replaces it. Debt payments stop once their balances are paid. Debts are modeled as interest-free paydown.",
                ],
                [
                  "Your assumptions stay yours",
                  "Interest rates, raises, investment returns, home value growth and inflation are inputs you control. The planner never changes them unless you make them flexible. Taxes use a simple 'share of a raise you keep' estimate.",
                ],
                [
                  "Private by design",
                  "Everything runs in your browser. No accounts, bank connections, analytics or servers. Saved scenarios live only in this browser. Goal-only share links leave your numbers out.",
                ],
              ].map(([h, t]) => (
                <article className="card" key={h}>
                  <h2>{h}</h2>
                  <p>{t}</p>
                </article>
              ))}
            </div>
            <p className="fine">
              PMI rules:{" "}
              <a
                href="https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/"
                target="_blank"
                rel="noreferrer"
              >
                Consumer Financial Protection Bureau
              </a>
              .
            </p>
          </>
        )}
      </main>
      {tab !== "setup" && (
        <footer className="footer">
          <span>
            <Icon name="star" /> North Star
          </span>
          <span>A planning tool, not financial advice.</span>
          <button className="link" onClick={() => go("method")}>
            How the math works
          </button>
        </footer>
      )}
    </div>
  );
}
