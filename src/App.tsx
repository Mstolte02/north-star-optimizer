import { useEffect, useMemo, useRef, useState } from "react";
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
} from "./persistence";
import { SetupWizard } from "./SetupWizard";
const leverLabels: Record<Lever, string> = {
  salary: "Primary annual salary",
  spending: "Dining & snack spending",
  down: "Down payment %",
  months: "Months until purchase",
  price: "Home price",
  rate: "Mortgage interest rate %",
};
type Field = {
  key: keyof Profile;
  label: string;
  unit?: string;
  note?: string;
  step?: number;
  max?: number;
};
const groups: { title: string; intro: string; fields: Field[] }[] = [
  {
    title: "Income & take-home",
    intro:
      "The $7,399 baseline is user supplied. Raises use your marginal take-home percentage, not a tax-table prediction. State and local changes adjust take-home relative to current assumptions. Filing status is descriptive; it does not simulate a tax return.",
    fields: [
      { key: "salary", label: "Primary annual salary", unit: "$" },
      { key: "partnerSalary", label: "Partner annual salary", unit: "$" },
      { key: "net", label: "Baseline monthly take-home", unit: "$" },
      {
        key: "retention",
        label: "Incremental gross pay retained",
        unit: "%",
        max: 100,
      },
      { key: "bonus", label: "Annual net bonuses & stipends", unit: "$" },
      {
        key: "growth",
        label: "Assumed annual salary growth",
        unit: "%",
        max: 30,
      },
      { key: "raiseSalary", label: "Scheduled primary salary", unit: "$" },
      {
        key: "raiseMonth",
        label: "Raise starts in month (0 = none)",
        unit: "months",
        max: 360,
      },
      {
        key: "retirement",
        label: "Additional retirement contribution",
        unit: "%",
        max: 60,
      },
      {
        key: "benefits",
        label: "Additional monthly benefit deductions",
        unit: "$",
      },
      {
        key: "stateTax",
        label: "State tax planning assumption",
        unit: "%",
        max: 30,
      },
      {
        key: "localTax",
        label: "Local tax planning assumption",
        unit: "%",
        max: 30,
      },
    ],
  },
  {
    title: "Spending & household loans",
    intro:
      "Components below are included in the $6,726 baseline as noted. Editing an included component changes that baseline by the difference. Future loan payments are activated by month. Parent PLUS is household cash flow, excluded from modeled legal debt and DTI.",
    fields: [
      { key: "expenses", label: "Current total spending baseline", unit: "$" },
      {
        key: "rent",
        label: "Rent included in baseline",
        unit: "$",
        note: "Replaced with housing costs after purchase. $1,826 is an editable planning assumption.",
      },
      { key: "dining", label: "Current dining & snacks (included)", unit: "$" },
      { key: "diningTarget", label: "Planned dining & snacks", unit: "$" },
      {
        key: "reductionMonth",
        label: "Dining change starts in month",
        unit: "months",
        max: 360,
      },
      { key: "medication", label: "Medication (included)", unit: "$" },
      {
        key: "ownLoan",
        label: "Primary federal payment (included)",
        unit: "$",
      },
      { key: "ownBalance", label: "Primary federal balance", unit: "$" },
      { key: "partnerBalance", label: "Partner federal balance", unit: "$" },
      {
        key: "partnerLoan",
        label: "Partner future federal payment",
        unit: "$",
      },
      {
        key: "loanMonth",
        label: "Future payment begins in month",
        unit: "months",
        max: 360,
      },
      { key: "plus", label: "Parent PLUS contribution", unit: "$" },
      {
        key: "plusBalance",
        label: "Parent PLUS balance (context only)",
        unit: "$",
      },
      {
        key: "inflation",
        label: "Annual spending / rent inflation",
        unit: "%",
        max: 30,
      },
    ],
  },
  {
    title: "Home & mortgage assumptions",
    intro:
      "6.5% interest, 1% property tax, $150 insurance and 0.5% PMI are editable planning assumptions, not lender quotes or local assessments. Total housing includes maintenance, HOA and incremental utilities.",
    fields: [
      { key: "price", label: "Home price", unit: "$" },
      { key: "down", label: "Down payment", unit: "%", max: 100 },
      { key: "downDollars", label: "Fixed-dollar down payment", unit: "$" },
      {
        key: "rate",
        label: "Mortgage interest",
        unit: "%",
        step: 0.125,
        max: 30,
      },
      { key: "term", label: "Mortgage term", unit: "years", max: 50 },
      {
        key: "tax",
        label: "Annual property tax / home value",
        unit: "%",
        step: 0.1,
        max: 10,
      },
      { key: "insurance", label: "Monthly homeowners insurance", unit: "$" },
      {
        key: "pmi",
        label: "Annual PMI / original loan",
        unit: "%",
        step: 0.1,
        max: 10,
      },
      { key: "hoa", label: "Monthly HOA", unit: "$" },
      {
        key: "maintenance",
        label: "Annual maintenance / home value",
        unit: "%",
        step: 0.1,
        max: 10,
      },
      {
        key: "utilities",
        label: "Additional utilities after purchase",
        unit: "$",
      },
      { key: "closing", label: "Closing costs / price", unit: "%", max: 30 },
      { key: "moving", label: "Moving expenses", unit: "$" },
      {
        key: "appreciation",
        label: "Assumed annual appreciation",
        unit: "%",
        max: 30,
      },
    ],
  },
  {
    title: "Savings, timing & investments",
    intro:
      "A zero contribution limit directs all modeled cash flow into savings. A positive limit caps cash accumulation; unallocated surplus is excluded from projected assets. Investment contributions reduce available cash. Return assumptions are speculative.",
    fields: [
      { key: "savings", label: "Starting savings", unit: "$" },
      {
        key: "months",
        label: "Months until purchase",
        unit: "months",
        max: 360,
      },
      {
        key: "savingsRate",
        label: "Annual cash savings interest",
        unit: "%",
        max: 30,
      },
      {
        key: "preContribution",
        label: "Pre-purchase monthly saving limit",
        unit: "$",
      },
      {
        key: "postContribution",
        label: "Post-purchase monthly saving limit",
        unit: "$",
      },
      {
        key: "investment",
        label: "Monthly investment contribution",
        unit: "$",
      },
      {
        key: "investmentReturn",
        label: "Annual investment return",
        unit: "%",
        max: 30,
      },
      {
        key: "horizon",
        label: "Net-worth projection horizon",
        unit: "months",
        max: 360,
      },
    ],
  },
  {
    title: "Hard limits & comfort requirements",
    intro:
      "Every feasible path must satisfy these limits. Comfortable salary keeps your monthly savings and cash reserves; break-even relaxes those two cushions to zero and retains your payment and DTI limits.",
    fields: [
      {
        key: "paymentLimit",
        label: "Maximum TOTAL housing / month",
        unit: "$",
      },
      {
        key: "after",
        label: "Minimum savings after purchase / month",
        unit: "$",
      },
      { key: "reserve", label: "Minimum cash remaining at closing", unit: "$" },
      {
        key: "emergencyMonths",
        label: "Emergency reserve / living expenses",
        unit: "months",
        max: 60,
      },
      { key: "dtiLimit", label: "Maximum legal-debt DTI", unit: "%", max: 100 },
    ],
  },
];
function initial() {
  try {
    const shared = decodeShare(window.location.hash);
    const stored = localStorage.getItem("north-star.starting-plan.v1");
    return {
      s: shared ?? (stored ? validateScenario(JSON.parse(stored)) : defaults()),
      error: "",
      ready: Boolean(shared || stored),
    };
  } catch (e) {
    return { s: defaults(), error: (e as Error).message, ready: false };
  }
}
export default function App() {
  const [init] = useState(initial),
    [s, setS] = useState<Scenario>(init.s),
    [tab, setTab] = useState(init.ready ? "studio" : "setup"),
    [setupComplete, setSetupComplete] = useState(init.ready),
    [saved, setSaved] = useState<Scenario[]>([]),
    [message, setMessage] = useState(init.error),
    [result, setResult] = useState<ReturnType<typeof optimize> | null>(null),
    [busy, setBusy] = useState(true),
    [drag, setDrag] = useState<Priority | null>(null),
    [shareFull, setShareFull] = useState(false),
    [compare, setCompare] = useState<string[]>([]);
  const file = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (tab !== "setup") document.querySelector<HTMLElement>("main")?.focus();
  }, [tab]);
  const e = useMemo(() => evaluate(s, s.profile, true), [s]);
  useEffect(() => {
    try {
      setSaved(loadScenarios());
    } catch {
      setMessage(
        "Saved scenarios could not be read. Your current plan is still available.",
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
        "The optimizer could not finish. Check your ranges and try resetting.",
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
      if (
        [
          "months",
          "horizon",
          "raiseMonth",
          "loanMonth",
          "reductionMonth",
        ].includes(key)
      )
        value = Math.round(Number(value));
      const p = { ...old.profile, [key]: value };
      if (["salary", "partnerSalary"].includes(key))
        p.net +=
          ((Number(value) - Number(old.profile[key])) * old.profile.retention) /
          1200;
      if (["ownLoan", "medication", "rent", "dining"].includes(key))
        p.expenses += Number(value) - Number(old.profile[key]);
      if (key === "plus" && p.includesPlus)
        p.expenses += Number(value) - old.profile.plus;
      if (key === "partnerLoan" && p.includesFutureLoan)
        p.expenses += Number(value) - old.profile.partnerLoan;
      if (key === "stateTax" || key === "localTax")
        p.net -=
          ((Number(value) - Number(old.profile[key])) *
            (p.salary + p.partnerSalary)) /
          1200;
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
  const persist = (list: Scenario[]) => {
    if (list.length > 50) {
      setMessage(
        "Keep at most 50 scenarios. Export or delete an older plan first.",
      );
      return false;
    }
    try {
      saveScenarios(list);
      setSaved(list);
      return true;
    } catch {
      setMessage(
        "Browser storage is unavailable or full. Export JSON to keep your scenarios.",
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
    thresholdComfort = useMemo(() => salaryThreshold(s, true), [s]);
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
  return (
    <>
      <header className="site-header">
        <a
          className="brand"
          href="#"
          onClick={(ev) => {
            ev.preventDefault();
            setTab(setupComplete ? "studio" : "setup");
          }}
        >
          <span className="star-mark" aria-hidden="true">
            ✦
          </span>{" "}
          North Star<span className="brand-sub">FINANCIAL PLANNING STUDIO</span>
        </a>
        {tab !== "setup" && (
          <nav aria-label="Main navigation">
            {[
              ["studio", "Plan"],
              ["priorities", "Priorities"],
              ["analysis", "Explore"],
              ["assumptions", "Assumptions"],
              ["scenarios", `Scenarios ${saved.length}`],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-current={tab === key ? "page" : undefined}
                className={tab === key ? "active" : ""}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </nav>
        )}
      </header>
      <main tabIndex={-1}>
        {message && (
          <div className="notice" role="status">
            {message}
            <button aria-label="Dismiss message" onClick={() => setMessage("")}>
              ×
            </button>
          </div>
        )}
        {tab === "setup" && saved.length > 0 && (
          <button onClick={() => setTab("scenarios")}>
            Open saved scenarios
          </button>
        )}
        {tab === "setup" && (
          <SetupWizard
            scenario={s}
            onCancel={setupComplete ? () => setTab("assumptions") : undefined}
            onComplete={(plan) => {
              setS(plan);
              setSetupComplete(true);
              setTab("studio");
              try {
                localStorage.setItem(
                  "north-star.starting-plan.v1",
                  JSON.stringify(plan),
                );
              } catch {
                setMessage(
                  "Setup is ready. Browser storage is unavailable; export your scenario to keep it.",
                );
              }
            }}
          />
        )}
        {["studio", "priorities", "analysis", "assumptions"].includes(tab) && (
          <>
            {tab === "studio" && (
              <section className="hero">
                <div className="hero-copy">
                  <span className="eyebrow">
                    YOUR GOALS. YOUR PRIORITIES. YOUR PATH.
                  </span>
                  <h1>
                    Give your future <br />a fixed point.
                  </h1>
                  <p>
                    Choose what matters most. See what needs to change to make
                    it possible.
                  </p>
                </div>
                <div className="north-star-control">
                  <label className="eyebrow" htmlFor="objective">
                    <span className="copper">✦</span> MY NORTH STAR
                  </label>
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
                          ? "Find the highest tolerable rate"
                          : "Solve for the minimum"}
                      </span>
                    ) : (
                      <label>
                        <span>{star.unit === "$" ? "$" : ""}</span>
                        <input
                          aria-label="North Star target"
                          type="number"
                          min={star.unit === "months" ? 1 : 0}
                          max={
                            s.objective === "emergency"
                              ? 60
                              : star.unit === "%"
                                ? 100
                                : star.unit === "months"
                                  ? 360
                                  : 10000000
                          }
                          step={star.unit === "%" ? 0.1 : 1}
                          value={s.target}
                          onChange={(ev) =>
                            targetChange(
                              Math.min(
                                s.objective === "emergency"
                                  ? 60
                                  : star.unit === "%"
                                    ? 100
                                    : star.unit === "months"
                                      ? 360
                                      : 10000000,
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
                        <span>{star.unit !== "$" ? star.unit : ""}</span>
                      </label>
                    )}
                  </div>
                  <p>{star.description}</p>
                  <span className="objective-mode">
                    {s.mode === "maximize"
                      ? s.objective === "rate"
                        ? "Maximize rate within limits"
                        : "Maximize price within limits"
                      : s.mode === "minimize"
                        ? "Minimize required salary"
                        : "Meet a specific target"}
                  </span>
                </div>
              </section>
            )}
            {tab !== "studio" && (
              <div className="page-heading">
                <h1>
                  {tab === "priorities"
                    ? "What can change?"
                    : tab === "analysis"
                      ? "Explore your options."
                      : "Your financial assumptions."}
                </h1>
                <p>
                  {tab === "priorities"
                    ? "Rank what matters, then decide which variables can move."
                    : tab === "analysis"
                      ? "Compare possible paths and inspect the calculations behind them."
                      : "Adjust the details when you need them."}
                </p>
              </div>
            )}
            <div className={`workspace focused-workspace ${tab}`}>
              {tab === "priorities" && (
                <aside className="controls">
                  <section>
                    <div className="section-heading">
                      <span className="eyebrow">
                        01 / THE ORDER THAT MATTERS
                      </span>
                      <h2>Your priorities.</h2>
                    </div>
                    <p className="small">
                      Drag to reorder, or use the arrows. Earlier priorities win
                      within the tolerance you set.
                    </p>
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
                          <span className="rank">0{i + 1}</span>
                          <div>
                            <strong>{priorityLabels[k]}</strong>
                            <label className="tolerance">
                              Tolerance{" "}
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
                              />{" "}
                              {k === "months"
                                ? "mo"
                                : k === "salary"
                                  ? "$/yr"
                                  : "$"}
                            </label>
                          </div>
                          <div className="reorder">
                            <button
                              disabled={i === 0}
                              aria-label={`Move ${priorityLabels[k]} up`}
                              onClick={() => reorder(k, i - 1)}
                            >
                              ↑
                            </button>
                            <button
                              disabled={i === 4}
                              aria-label={`Move ${priorityLabels[k]} down`}
                              onClick={() => reorder(k, i + 1)}
                            >
                              ↓
                            </button>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                  <details className="levers">
                    <summary>
                      <span className="eyebrow">02 / ROOM TO MOVE</span>
                      <span>Locks & permitted ranges</span>
                    </summary>
                    <p className="small">
                      The engine may change only flexible levers below. All
                      other assumptions stay fixed. Payment, reserves, savings
                      and DTI floors are hard constraints.
                    </p>
                    {(Object.keys(s.ranges) as Lever[]).map((k) => (
                      <div className="lever" key={k}>
                        <div className="lever-top">
                          <label htmlFor={`lock-${k}`}>{leverLabels[k]}</label>
                          <button
                            id={`lock-${k}`}
                            aria-pressed={s.ranges[k].locked}
                            onClick={() =>
                              setS({
                                ...s,
                                ranges: {
                                  ...s.ranges,
                                  [k]: {
                                    ...s.ranges[k],
                                    locked: !s.ranges[k].locked,
                                  },
                                },
                              })
                            }
                          >
                            {s.ranges[k].locked ? "Locked" : "Flexible"}
                          </button>
                        </div>
                        {!s.ranges[k].locked && (
                          <div className="range-pair">
                            <label>
                              From{" "}
                              <input
                                type="number"
                                aria-label={`${leverLabels[k]} minimum`}
                                min={k === "months" || k === "price" ? 1 : 0}
                                value={s.ranges[k].min}
                                onChange={(ev) => {
                                  const min = Math.max(
                                    k === "months" || k === "price" ? 1 : 0,
                                    Number(ev.target.value),
                                  );
                                  setS({
                                    ...s,
                                    ranges: {
                                      ...s.ranges,
                                      [k]: {
                                        ...s.ranges[k],
                                        min,
                                        max: Math.max(min, s.ranges[k].max),
                                      },
                                    },
                                  });
                                }}
                              />
                            </label>
                            <span>—</span>
                            <label>
                              To{" "}
                              <input
                                type="number"
                                aria-label={`${leverLabels[k]} maximum`}
                                min={s.ranges[k].min}
                                max={
                                  k === "down"
                                    ? 100
                                    : k === "rate"
                                      ? 30
                                      : k === "months"
                                        ? 360
                                        : 10000000
                                }
                                value={s.ranges[k].max}
                                onChange={(ev) => {
                                  const cap =
                                    k === "down"
                                      ? 100
                                      : k === "rate"
                                        ? 30
                                        : k === "months"
                                          ? 360
                                          : 10000000;
                                  setS({
                                    ...s,
                                    ranges: {
                                      ...s.ranges,
                                      [k]: {
                                        ...s.ranges[k],
                                        max: Math.min(
                                          cap,
                                          Math.max(
                                            s.ranges[k].min,
                                            Number(ev.target.value),
                                          ),
                                        ),
                                      },
                                    },
                                  });
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </div>
                    ))}
                    {s.profile.downMode === "dollars" && (
                      <p className="warning">
                        Fixed-dollar down payments require the down-payment
                        lever to be locked.
                      </p>
                    )}
                  </details>
                </aside>
              )}
              {["studio", "analysis"].includes(tab) && (
                <div className="analysis">
                  {tab === "studio" && (
                    <section className="main-result" aria-live="polite">
                      <div className="result-heading">
                        <span className="eyebrow">
                          {busy
                            ? "CALCULATING YOUR PATHS"
                            : best
                              ? "A FEASIBLE PATH WITHIN YOUR LIMITS"
                              : "YOUR CURRENT PLAN"}
                        </span>
                        <span className={`status ${best ? "good" : ""}`}>
                          {busy
                            ? "Solving…"
                            : best
                              ? "Within constraints"
                              : e.feasible
                                ? "Feasible as entered"
                                : "Changes needed"}
                        </span>
                      </div>
                      <div className="statement">
                        <span className="big-amount">{heroValue}</span>
                        <p>
                          {s.objective === "payment" || s.objective === "after"
                            ? "Sampled affordable home price"
                            : s.objective === "salary"
                              ? "Required primary annual salary"
                              : s.objective === "rate"
                                ? "Maximum sampled mortgage rate"
                                : star.label}
                        </p>
                      </div>
                      <div className="result-metrics">
                        <div>
                          <span>Purchase</span>
                          <strong>{monthLabel(p, p.months)}</strong>
                        </div>
                        <div>
                          <span>All-in housing / mo</span>
                          <strong>
                            <AnimatedMoney value={display.house.total} />
                          </strong>
                        </div>
                        <div>
                          <span>Cash after closing</span>
                          <strong>
                            <AnimatedMoney value={display.remaining} />
                          </strong>
                        </div>
                        <div>
                          <span>Savings after / mo</span>
                          <strong
                            className={display.after < 0 ? "negative" : ""}
                          >
                            <AnimatedMoney value={display.after} />
                          </strong>
                        </div>
                      </div>
                      {!busy && !best && (
                        <div className="conflicts">
                          <strong>No feasible sampled path.</strong>
                          <p>
                            Within your current locks and ranges, the engine
                            could not find a solution. This is not proof that no
                            solution exists between grid points.
                          </p>
                          <ul>
                            {e.violations.map((v) => (
                              <li key={v}>{v}</li>
                            ))}
                          </ul>
                          <p>
                            Try extending the purchase range, raising the salary
                            ceiling, increasing the housing limit, or relaxing a
                            reserve floor.
                          </p>
                        </div>
                      )}
                      {best && (
                        <p className="explanation">
                          {best.changes.join(" · ")}. This is a hypothetical
                          path; changes take effect from the model start unless
                          a schedule is specified.
                        </p>
                      )}
                    </section>
                  )}
                  {tab === "analysis" && (
                    <details className="calculation">
                      <summary>
                        Follow the arithmetic <span>+</span>
                      </summary>
                      <div className="arithmetic">
                        <div>
                          <span>Principal &amp; interest / month</span>
                          <strong>{money(display.house.pi)}</strong>
                        </div>
                        <div>
                          <span>Tax + insurance + PMI / month</span>
                          <strong>
                            {money(display.house.piti - display.house.pi)}
                          </strong>
                        </div>
                        <div>
                          <span>
                            Maintenance + HOA + additional utilities / month
                          </span>
                          <strong>
                            {money(display.house.total - display.house.piti)}
                          </strong>
                        </div>
                        <div>
                          <span>Down payment</span>
                          <strong>
                            {money(downAmount(p))} (
                            {((downAmount(p) / p.price) * 100).toFixed(1)}%)
                          </strong>
                        </div>
                        <div>
                          <span>Closing + moving expenses</span>
                          <strong>
                            {money(closingCash(p) - downAmount(p))}
                          </strong>
                        </div>
                        <div>
                          <span>Savings immediately before closing</span>
                          <strong>{money(display.cash)}</strong>
                        </div>
                        <div>
                          <span>Required protected reserves</span>
                          <strong>{money(display.reserve)}</strong>
                        </div>
                        <div>
                          <span>Take-home income at purchase / month</span>
                          <strong>{money(income(p, p.months))}</strong>
                        </div>
                        <div>
                          <span>Modeled legal-debt DTI</span>
                          <strong>{display.dti.toFixed(1)}%</strong>
                        </div>
                        <div>
                          <span>Net worth at {monthLabel(p, p.horizon)}</span>
                          <strong>{money(display.wealth)}</strong>
                        </div>
                        <div>
                          <span>Ownership break-even after closing</span>
                          <strong>
                            {display.breakEven === null
                              ? "Beyond 30 years"
                              : `${display.breakEven} months`}
                          </strong>
                        </div>
                      </div>
                    </details>
                  )}
                  {tab === "studio" && (
                    <Chart
                      p={p}
                      objective={s.objective}
                      protectedReserve={display.reserve}
                    />
                  )}
                  {tab === "analysis" && (
                    <>
                      <section className="thresholds">
                        <span className="eyebrow">
                          THE THRESHOLD / YOUR ENTERED PURCHASE PLAN
                        </span>
                        <h2>What has to be true?</h2>
                        <div className="threshold-grid">
                          <div>
                            <span>Break-even primary salary</span>
                            <strong>
                              {thresholdBreak === null
                                ? "No salary-only solution"
                                : money(thresholdBreak)}
                            </strong>
                            <p>
                              Zero extra cash cushion; retains all other targets
                              and hard ceilings.
                            </p>
                          </div>
                          <div>
                            <span>Comfortable primary salary</span>
                            <strong>
                              {thresholdComfort === null
                                ? "No salary-only solution"
                                : money(thresholdComfort)}
                            </strong>
                            <p>
                              Preserves {money(s.profile.reserve)} at closing
                              and {money(s.profile.after)}/month after purchase,
                              plus your emergency-month floor.
                            </p>
                          </div>
                        </div>
                        <div className="threshold-inline">
                          <span>
                            Average monthly cash saving needed by{" "}
                            {monthLabel(s.profile, s.profile.months)}
                          </span>
                          <strong>
                            {money(savingsRequired(s.profile) ?? 0)}
                          </strong>
                        </div>
                        <div className="threshold-inline">
                          <span>
                            Maximum home price at entered income & purchase date
                          </span>
                          <strong>
                            {maxPrice(s) === null
                              ? "No feasible price"
                              : money(maxPrice(s) ?? 0)}
                          </strong>
                        </div>
                        <p className="small">
                          Salary thresholds change primary salary alone at your
                          entered date and down payment; they may exceed
                          permitted optimization ranges. The constant monthly
                          saving threshold includes cash interest and protected
                          reserves.
                        </p>
                      </section>
                      <section className="paths">
                        <span className="eyebrow">
                          MORE THAN ONE WAY FORWARD
                        </span>
                        <h2>Paths worth considering.</h2>
                        <p className="small">
                          Only computationally feasible, distinct paths appear.
                          Alternatives hold different levers fixed, then follow
                          your ranked priorities.
                        </p>
                        {busy ? (
                          <p className="loading">Finding your paths…</p>
                        ) : result?.paths.length ? (
                          result.paths.map((path, i) => (
                            <article className="path" key={path.name}>
                              <div className="path-title">
                                <span className="rank">0{i + 1}</span>
                                <h3>{path.name}</h3>
                                <button
                                  onClick={() => {
                                    setS({
                                      ...s,
                                      profile: path.e.p,
                                      name: path.name,
                                    });
                                    setMessage(
                                      "Path applied. Review its hypothetical changes in your assumptions.",
                                    );
                                  }}
                                >
                                  Use this path ↗
                                </button>
                              </div>
                              <p>{path.changes.join(" · ")}</p>
                              <div className="path-data">
                                <span>{money(path.e.p.salary)} salary</span>
                                <span>
                                  {monthLabel(path.e.p, path.e.p.months)}{" "}
                                  closing
                                </span>
                                <span>{money(path.e.remaining)} retained</span>
                                <span>{money(path.e.after)}/mo saved</span>
                              </div>
                            </article>
                          ))
                        ) : (
                          <p className="small">
                            Adjust your constraints to discover viable
                            alternatives.
                          </p>
                        )}
                        <p className="method-note">{result?.method}</p>
                      </section>
                      <section className="sensitivity">
                        <span className="eyebrow">
                          SMALL MOVES / REAL CONSEQUENCES
                        </span>
                        <h2>How sensitive is your plan?</h2>
                        <table>
                          <caption>
                            Each row changes one assumption in the entered plan.
                          </caption>
                          <thead>
                            <tr>
                              <th>Change</th>
                              <th>Housing / mo</th>
                              <th>After / mo</th>
                              <th>Cash at closing</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              {
                                label: "Mortgage rate +1 point",
                                p: { ...s.profile, rate: s.profile.rate + 1 },
                              },
                              {
                                label: "Home price −$25,000",
                                p: {
                                  ...s.profile,
                                  price: Math.max(1, s.profile.price - 25000),
                                },
                              },
                              {
                                label: "Dining target $300/mo",
                                p: { ...s.profile, diningTarget: 300 },
                              },
                              {
                                label: "Wait another 12 months",
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
                      </section>
                    </>
                  )}
                </div>
              )}
            </div>
            {tab === "assumptions" && (
              <section className="assumptions">
                <div className="section-heading">
                  <span className="eyebrow">03 / MAKE IT YOURS</span>
                  <h2>The assumptions behind your path.</h2>
                </div>
                <p>
                  Greenfield, Hancock County, Indiana · Summary-level planning
                  profile · Every amount is editable.
                </p>
                <div className="baseline-strip">
                  <strong>
                    {money(
                      evaluate({
                        ...s,
                        profile: {
                          ...s.profile,
                          diningTarget: s.profile.dining,
                        },
                      }).before,
                    )}{" "}
                    current available cash / month
                  </strong>
                  <span>{money(s.profile.expenses)} spending baseline</span>
                  <span>Primary loan included</span>
                  <span>
                    Parent PLUS{" "}
                    {s.profile.includesPlus ? "included" : "added separately"}
                  </span>
                  <span>
                    Future federal payment{" "}
                    {s.profile.includesFutureLoan
                      ? "included then scheduled"
                      : "added on its start date"}
                  </span>
                </div>
                <div className="profile-meta">
                  <label>
                    Model starts
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
                    Filing status (descriptive)
                    <select
                      value={s.profile.filing}
                      onChange={(ev) => update("filing", ev.target.value)}
                    >
                      <option>Married filing jointly</option>
                      <option>Single</option>
                      <option>Married filing separately</option>
                      <option>Head of household</option>
                    </select>
                  </label>
                  <label>
                    Down-payment method
                    <select
                      value={s.profile.downMode}
                      onChange={(ev) => {
                        update("downMode", ev.target.value);
                        if (ev.target.value === "dollars")
                          setS((old) => ({
                            ...old,
                            ranges: {
                              ...old.ranges,
                              down: { ...old.ranges.down, locked: true },
                            },
                          }));
                      }}
                    >
                      <option value="percent">Percentage of price</option>
                      <option value="dollars">Fixed dollar amount</option>
                    </select>
                  </label>
                </div>
                {groups.map((g) => (
                  <details key={g.title} className="input-group">
                    <summary>
                      {g.title}
                      <span>+</span>
                    </summary>
                    <p>{g.intro}</p>
                    {g.title.startsWith("Spending") && (
                      <div className="inclusion">
                        <label>
                          <input
                            type="checkbox"
                            checked={s.profile.includesPlus}
                            onChange={(ev) =>
                              update("includesPlus", ev.target.checked)
                            }
                          />{" "}
                          Baseline already contains Parent PLUS contribution
                        </label>
                        <label>
                          <input
                            type="checkbox"
                            checked={s.profile.includesFutureLoan}
                            onChange={(ev) =>
                              update("includesFutureLoan", ev.target.checked)
                            }
                          />{" "}
                          Baseline already contains future partner payment
                        </label>
                        <p>
                          Completed nose treatment: $0 future payments.
                          Other-parent loans are excluded. Parent PLUS remains
                          another person’s legal debt.
                        </p>
                      </div>
                    )}
                    <div className="fields">
                      {g.fields.map((f) => (
                        <label key={f.key}>
                          {f.label}
                          <div className="input-with-unit">
                            <span>{f.unit === "$" ? "$" : ""}</span>
                            <input
                              type="number"
                              min={
                                [
                                  "term",
                                  "months",
                                  "horizon",
                                  "price",
                                  "dtiLimit",
                                  "retention",
                                ].includes(f.key)
                                  ? 1
                                  : 0
                              }
                              max={f.max ?? 10000000}
                              step={f.step ?? (f.unit === "$" ? 0.01 : 1)}
                              value={s.profile[f.key] as number}
                              onChange={(ev) => {
                                const min = [
                                  "term",
                                  "months",
                                  "horizon",
                                  "price",
                                  "dtiLimit",
                                  "retention",
                                ].includes(f.key)
                                  ? 1
                                  : 0;
                                update(
                                  f.key,
                                  Math.min(
                                    f.max ?? 10000000,
                                    Math.max(min, Number(ev.target.value)),
                                  ),
                                );
                              }}
                            />
                            <span>{f.unit === "$" ? "" : f.unit}</span>
                          </div>
                          {f.note && <small>{f.note}</small>}
                        </label>
                      ))}
                    </div>
                  </details>
                ))}
              </section>
            )}
            {tab === "studio" && (
              <div className="plan-next">
                <button onClick={() => setTab("priorities")}>
                  Adjust priorities
                </button>
                <button onClick={() => setTab("analysis")}>
                  Explore paths & calculations
                </button>
                <button onClick={() => setTab("assumptions")}>
                  Edit assumptions
                </button>
              </div>
            )}
            {["studio", "assumptions"].includes(tab) && (
              <div className="save-bar">
                <label>
                  Scenario name
                  <input
                    value={s.name}
                    maxLength={100}
                    onChange={(ev) => setS({ ...s, name: ev.target.value })}
                  />
                </label>
                <button
                  className="primary"
                  disabled={!s.name.trim()}
                  onClick={save}
                >
                  Save this scenario
                </button>
                {tab === "assumptions" && (
                  <>
                    <button onClick={() => setTab("setup")}>
                      Edit starting numbers
                    </button>
                    <button
                      onClick={() => {
                        const b = defaults();
                        b.profile.salary = 85000;
                        b.profile.partnerSalary = 47000;
                        b.profile.net += (17000 * b.profile.retention) / 1200;
                        b.name = "Alternative salaries";
                        setS(b);
                      }}
                    >
                      Try $85k / $47k
                    </button>
                    <button onClick={() => setS(defaults())}>
                      Reset defaults
                    </button>
                  </>
                )}
              </div>
            )}
          </>
        )}
        {tab === "scenarios" && (
          <section className="scenario-page">
            <span className="eyebrow">YOUR POSSIBLE FUTURES</span>
            <h1>A plan is a starting point.</h1>
            <p>
              Saved scenarios stay in this browser. They do not sync between
              devices. Export a JSON file to transfer or back them up.
            </p>
            <div className="scenario-tools">
              <button className="primary" onClick={save}>
                Save current plan
              </button>
              <button onClick={exportJson}>Export JSON</button>
              <button onClick={() => file.current?.click()}>Import JSON</button>
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
                      throw new Error("File is limited to 1 MB.");
                    const list = importScenarios(await f.text()).map((x) => ({
                      ...x,
                      id: crypto.randomUUID(),
                    }));
                    if (saved.length + list.length > 50)
                      throw new Error(
                        "Keep at most 50 scenarios in browser storage.",
                      );
                    if (persist([...saved, ...list]))
                      setMessage(`Imported ${list.length} scenario(s).`);
                  } catch (error) {
                    setMessage((error as Error).message);
                  }
                  ev.target.value = "";
                }}
              />
            </div>
            <div className="share">
              <h2>Share the destination.</h2>
              <p>
                By default, the link contains only your objective and target.
                Household financial assumptions stay out of it.
              </p>
              <label>
                <input
                  type="checkbox"
                  checked={shareFull}
                  onChange={(ev) => setShareFull(ev.target.checked)}
                />{" "}
                Include the full financial scenario (anyone with the link can
                read it)
              </label>
              <button
                onClick={async () => {
                  const url =
                    window.location.href.split("#")[0] +
                    encodeShare(s, shareFull);
                  try {
                    await navigator.clipboard.writeText(url);
                    setMessage(
                      shareFull
                        ? "Full financial scenario link copied."
                        : "Goal-only link copied.",
                    );
                  } catch {
                    setMessage(url);
                  }
                }}
              >
                Copy share link
              </button>
            </div>
            {!saved.length && (
              <p className="empty">
                Your first saved scenario will appear here.
              </p>
            )}
            {saved.map((item) => {
              const ev = evaluate(item, item.profile, true);
              return (
                <article className="saved-scenario" key={item.id}>
                  <label>
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
                    />{" "}
                    Compare
                  </label>
                  <div>
                    <h2>
                      {item.name}{" "}
                      {item.preferred && (
                        <span className="copper">✦ Preferred</span>
                      )}
                    </h2>
                    <p>
                      {objectives[item.objective].label} ·{" "}
                      {money(item.profile.price)} home ·{" "}
                      {monthLabel(item.profile, item.profile.months)}
                    </p>
                  </div>
                  <div className="scenario-actions">
                    <button
                      onClick={() => {
                        setS(item);
                        setSetupComplete(true);
                        setTab("studio");
                      }}
                    >
                      Open
                    </button>
                    <button
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
                      onClick={() => {
                        if (window.confirm(`Delete “${item.name}”?`))
                          persist(saved.filter((x) => x.id !== item.id));
                      }}
                    >
                      Delete
                    </button>
                  </div>
                  <span className="small">
                    {ev.feasible
                      ? "Entered plan meets constraints"
                      : "Entered plan needs changes"}
                  </span>
                </article>
              );
            })}
            {compare.length > 0 && (
              <div className="comparison">
                <h2>Side by side.</h2>
                <div className="table-scroll">
                  <table>
                    <caption>
                      Comparison of entered plans (not proposed optimizer
                      paths).
                    </caption>
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
                        "Price",
                        "Housing / month",
                        "Savings after / month",
                        "Cash after closing",
                        "Primary salary",
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
              </div>
            )}
          </section>
        )}
        {tab === "method" && (
          <section className="method-page">
            <span className="eyebrow">TRANSPARENT BY DESIGN</span>
            <h1>Numbers with a reason.</h1>
            <div className="method-columns">
              <article>
                <h2>Hard constraints first.</h2>
                <p>
                  Home price targets, housing ceilings, savings floors,
                  reserves, legal-debt DTI and locked levers are tested before a
                  recommendation appears. An impossible or unsampled combination
                  produces no path.
                </p>
                <h2>Then your priorities.</h2>
                <p>
                  North Star searches bounded grids for down payment, dining
                  spending, purchase timing and, when enabled, price and rate.
                  Primary salary is solved with bisection. The primary objective
                  comes first; flexible preferences are ranked lexicographically
                  in tolerance-sized bands, followed by exact tie-breaking.
                  Rankings are preferences, not equations.
                </p>
                <p>
                  Search resolution: 13 home prices, 10 down payments, 5 dining
                  levels, 9 purchase times, and 17 rates for a rate objective,
                  plus entered values and a date deadline. This is a
                  deterministic sampled search, not a certified global
                  optimizer.
                </p>
                <h2>Mortgage mathematics.</h2>
                <p>
                  Monthly P&amp;I = principal × r / (1 − (1 + r)<sup>−n</sup>).
                  With zero interest, it is principal / n. PMI is included below
                  20% down and modeled to end at 78% of original value on the
                  scheduled amortization path, assuming a conventional mortgage
                  in good standing. Lender rules can differ.
                </p>
                <a
                  href="https://www.consumerfinance.gov/ask-cfpb/when-can-i-remove-private-mortgage-insurance-pmi-from-my-loan-en-202/"
                  target="_blank"
                  rel="noreferrer"
                >
                  CFPB: PMI termination ↗
                </a>
              </article>
              <article>
                <h2>A cash-flow model, not a ledger.</h2>
                <p>
                  Defaults are user-supplied summary estimates. The baseline
                  includes the primary student-loan payment, medication and (as
                  an explicit initial assumption) the Parent PLUS contribution.
                  Future partner federal payments activate at month 24 unless
                  changed.
                </p>
                <p>
                  Before closing, available cash is take-home minus household
                  spending and investments. After closing, rent is removed and
                  total housing costs replace it. Extra utilities are
                  incremental to the baseline. Contribution caps exclude
                  unallocated surplus from asset projections.
                </p>
                <h2>Assumptions stay visible.</h2>
                <p>
                  Interest rates, income growth, future returns, appreciation
                  and spending inflation are planning inputs. The optimizer does
                  not change them unless you explicitly enable a supported
                  lever. Taxes use a calibrated marginal take-home percentage;
                  this is not a tax return calculation.
                </p>
                <h2>Net worth & break-even.</h2>
                <p>
                  Net worth includes cash, modeled investments and home equity,
                  less your two federal-loan balances. For this initial version,
                  federal loans use zero-interest principal paydown, with
                  modeled payments stopping when principal is repaid; repayment
                  interest and forgiveness are not modeled. Parent PLUS is
                  excluded from legal debt. No home sale costs are included.
                </p>
                <p>
                  Ownership break-even compares incremental owner costs versus
                  continuing to rent from the closing date. It includes mortgage
                  equity, appreciation and forgone interest on down payment and
                  closing cash. It excludes selling costs and tax benefits. The
                  input horizon is months after purchase.
                </p>
                <h2>Private by architecture.</h2>
                <p>
                  All calculations run on your device. No bank connections,
                  analytics, database or login. Saved scenarios are
                  browser-specific. Goal-only links omit your profile; full
                  links expose included financial assumptions.
                </p>
              </article>
            </div>
          </section>
        )}
      </main>
      <footer>
        <span>
          <span className="copper">✦</span> NORTH STAR
        </span>
        <p>Your goals. Your priorities. Your path.</p>
        <span>Client-side planning · v1.0</span>
        <button onClick={() => setTab("method")}>How calculations work</button>
      </footer>
    </>
  );
}
