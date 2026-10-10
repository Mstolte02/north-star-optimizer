import { useEffect, useRef, useState } from "react";
import {
  applyQuestion,
  priorityLabels,
  questionFor,
  questions,
  type Lever,
  type Priority,
  type Profile,
  type Question,
  type Scenario,
} from "./model";
import { Icon } from "./Icon";

type Step = {
  name: string;
  title: string;
  intro: string;
  fields: readonly (readonly [
    keyof Profile,
    string,
    number,
    number,
    string?,
  ])[];
};
const money: Step[] = [
  {
    name: "Income",
    title: "What comes in?",
    intro:
      "Start with your income. Take-home pay is the money that actually reaches your bank account each month.",
    fields: [
      ["salary", "Your annual salary (before tax)", 0, 10000000],
      [
        "partnerSalary",
        "Second income, annual (optional)",
        0,
        10000000,
        "Leave at 0 if it's just you.",
      ],
      ["net", "Household take-home pay per month", 0, 1000000],
    ],
  },
  {
    name: "Spending",
    title: "What goes out?",
    intro:
      "Enter one total for everything you spend in a month, then tell us the parts of it. Nothing is counted twice.",
    fields: [
      [
        "expenses",
        "Total monthly spending",
        0,
        10000000,
        "Include rent, bills, debt payments and everyday spending.",
      ],
      ["rent", "Rent (part of the total)", 0, 10000000],
      [
        "flexible",
        "Flexible spending (part of the total)",
        0,
        10000000,
        "Dining out, shopping, fun — the part you could cut.",
      ],
      [
        "debtPayment",
        "Debt payments (part of the total)",
        0,
        10000000,
        "Car, student loan and credit card payments.",
      ],
      ["debtBalance", "Total debt balance", 0, 10000000],
    ],
  },
  {
    name: "Savings",
    title: "What do you want to keep?",
    intro:
      "Tell us what you have saved, and the cushion you want to keep once you've bought a home.",
    fields: [
      ["savings", "Savings today", 0, 10000000],
      [
        "reserve",
        "Cash to keep after closing",
        0,
        10000000,
        "Your safety net once the keys are in hand.",
      ],
      ["after", "Least you'd save each month after buying", 0, 10000000],
    ],
  },
  {
    name: "Home",
    title: "What home are you after?",
    intro: "Rough numbers are fine. You can change them later.",
    fields: [
      ["price", "Target home price", 1, 10000000],
      ["down", "Down payment (%)", 0, 100],
      ["rate", "Mortgage rate (%)", 0, 30],
      ["months", "Months from now you want to buy", 1, 360],
      [
        "paymentLimit",
        "Most you'd pay for housing per month",
        0,
        10000000,
        "Mortgage, tax, insurance, HOA and upkeep together.",
      ],
    ],
  },
];
// Fields the home step asks for, by question. "When" finds the month itself;
// "afford" finds the price itself.
const homeFields: Record<Question, (keyof Profile)[]> = {
  when: ["price", "down", "rate", "paymentLimit"],
  afford: ["down", "rate", "months", "paymentLimit"],
  deadline: ["price", "down", "rate", "months", "paymentLimit"],
  income: ["price", "down", "rate", "months", "paymentLimit"],
};
const flexOptions: { lever: Lever; label: string; text: string }[] = [
  {
    lever: "salary",
    label: "Earn more",
    text: "A raise, a new job or a second income.",
  },
  {
    lever: "spending",
    label: "Cut back on flexible spending",
    text: "Less dining out, shopping and fun for a while.",
  },
  { lever: "months", label: "Wait longer", text: "Buy later than you hoped." },
  {
    lever: "down",
    label: "Change my down payment",
    text: "Put more or less down than planned.",
  },
  {
    lever: "price",
    label: "Look at a different price",
    text: "Consider a cheaper or more expensive home.",
  },
];
// Step order: question, four money steps, priorities, flexibility.
const names = [
  "Question",
  ...money.map((x) => x.name),
  "Priorities",
  "Options",
];
const PRIORITIES = names.length - 2;
const OPTIONS = names.length - 1;

export function SetupWizard({
  scenario,
  onComplete,
  onSkip,
}: {
  scenario: Scenario;
  onComplete: (s: Scenario) => void;
  onSkip?: () => void;
}) {
  const [draft, setDraft] = useState(scenario);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  // Tap-to-rank order; anything not tapped keeps its current order after.
  const [ranked, setRanked] = useState<Priority[]>([]);
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus({ preventScroll: true });
    window.scrollTo?.(0, 0);
  }, [step]);
  const q = questionFor(draft.objective) ?? "when";
  const base = step >= 1 && step <= money.length ? money[step - 1] : null;
  const current =
    base && step === money.length
      ? {
          ...base,
          fields: base.fields.filter(([k]) => homeFields[q].includes(k)),
        }
      : base;
  const order = [
    ...ranked,
    ...draft.priorities.filter((p) => !ranked.includes(p)),
  ];
  const go = (n: number) => {
    setError("");
    setStep(n);
  };
  const change = (key: keyof Profile, value: number) =>
    setDraft((old) => {
      const profile = { ...old.profile, [key]: value };
      if (key === "flexible") profile.flexibleTarget = value;
      return { ...old, profile };
    });
  const toggleRank = (k: Priority) =>
    setRanked((r) => (r.includes(k) ? r.filter((x) => x !== k) : [...r, k]));
  const toggleLever = (k: Lever) =>
    setDraft((old) => ({
      ...old,
      ranges: {
        ...old.ranges,
        [k]: { ...old.ranges[k], locked: !old.ranges[k].locked },
      },
    }));
  const finish = () => {
    const p = draft.profile;
    const done = applyQuestion({ ...draft, priorities: order }, q);
    onComplete({
      ...done,
      profile: {
        ...p,
        downMode: "percent",
        raiseSalary: Math.max(p.raiseSalary, p.salary),
      },
      ranges: {
        ...done.ranges,
        salary: {
          ...done.ranges.salary,
          min: p.salary,
          max: Math.max(p.salary * 1.5, p.salary + 20000),
        },
        spending: {
          ...done.ranges.spending,
          min: Math.round(p.flexible * 0.3),
          max: p.flexible,
        },
        // "How much can I afford" must be free to move the price.
        price: {
          ...done.ranges.price,
          locked: q === "afford" ? false : draft.ranges.price.locked,
        },
      },
    });
  };
  const submitMoney = (form: HTMLFormElement) => {
    if (!form.reportValidity()) return;
    const p = draft.profile;
    if (step >= 2 && p.rent + p.debtPayment + p.flexible > p.expenses) {
      setError(
        p.rent > p.expenses
          ? "Rent cannot exceed the total spending that includes it."
          : "Rent, flexible spending and debt payments cannot add up to more than your total spending.",
      );
      return;
    }
    go(step + 1);
  };
  const title =
    step === 0
      ? "What do you want to know?"
      : step === PRIORITIES
        ? "What matters most to you?"
        : step === OPTIONS
          ? "What are you willing to change?"
          : current!.title;
  const intro =
    step === 0
      ? "Answer a few short questions and North Star will tell you when you can buy a home, and what would get you there sooner. Nothing leaves your browser."
      : step === PRIORITIES
        ? "Tap them in order, most important first. We'll use this to choose between plans that work."
        : step === OPTIONS
          ? "Pick everything you'd consider. We'll only suggest changes you're open to."
          : current!.intro;
  const back = step > 0 && (
    <button type="button" className="secondary" onClick={() => go(step - 1)}>
      Back
    </button>
  );
  return (
    <section className="wizard" aria-labelledby="setup-heading">
      <div className="wizard-top">
        <span className="brand-mark" aria-hidden="true">
          <Icon name="star" />
        </span>
        <span className="step-count">
          Step {step + 1} of {names.length}
        </span>
        {onSkip && (
          <button type="button" className="link" onClick={onSkip}>
            Skip to my plan
          </button>
        )}
      </div>
      <ol className="wizard-bar" aria-label="Setup progress">
        {names.map((n, i) => (
          <li
            key={n}
            aria-current={i === step ? "step" : undefined}
            className={i < step ? "done" : ""}
          >
            <span className="sr-only">{n}</span>
          </li>
        ))}
      </ol>
      <h1 id="setup-heading" ref={heading} tabIndex={-1}>
        {title}
      </h1>
      <p className="setup-intro">{intro}</p>

      {step === 0 && (
        <div className="question-cards">
          {(Object.keys(questions) as Question[]).map((k) => (
            <button
              key={k}
              className={`question-card ${k === q ? "is-current" : ""}`}
              onClick={() => {
                setDraft((old) => applyQuestion(old, k));
                go(1);
              }}
            >
              <strong>{questions[k].title}</strong>
              <span>{questions[k].text}</span>
              <Icon name="arrow" />
            </button>
          ))}
        </div>
      )}

      {current && (
        <form
          onSubmit={(ev) => {
            ev.preventDefault();
            submitMoney(ev.currentTarget);
          }}
        >
          <div className="fields" key={step}>
            {current.fields.map(([key, label, min, max, note]) => (
              <div key={key} className="field">
                <label htmlFor={`setup-${key}`}>{label}</label>
                <input
                  id={`setup-${key}`}
                  aria-describedby={note ? `setup-${key}-note` : undefined}
                  required
                  type="number"
                  min={min}
                  max={max}
                  step={key === "months" ? 1 : 0.01}
                  value={draft.profile[key] as number}
                  onChange={(ev) => change(key, Number(ev.target.value))}
                />
                {note && <small id={`setup-${key}-note`}>{note}</small>}
              </div>
            ))}
          </div>
          {error && (
            <p role="alert" className="warning">
              {error}
            </p>
          )}
          {step === 1 && (
            <p className="fine">
              Example numbers are filled in. Replace them with yours.
            </p>
          )}
          <div className="setup-actions">
            {back}
            <span className="spacer" />
            <button className="primary" type="submit">
              Continue
            </button>
          </div>
        </form>
      )}

      {step === PRIORITIES && (
        <>
          <ol className="rank-list" aria-label="Your priorities">
            {order.map((k) => {
              const n = ranked.indexOf(k);
              return (
                <li key={k}>
                  <button
                    type="button"
                    aria-pressed={n >= 0}
                    className={n >= 0 ? "is-ranked" : ""}
                    onClick={() => toggleRank(k)}
                  >
                    <span className="rank">{n >= 0 ? n + 1 : ""}</span>
                    {priorityLabels[k]}
                  </button>
                </li>
              );
            })}
          </ol>
          <div className="setup-actions">
            {back}
            {ranked.length > 0 && (
              <button
                type="button"
                className="ghost"
                onClick={() => setRanked([])}
              >
                Clear
              </button>
            )}
            <span className="spacer" />
            <button className="primary" onClick={() => go(OPTIONS)}>
              Continue
            </button>
          </div>
        </>
      )}

      {step === OPTIONS && (
        <>
          <div className="option-list">
            {flexOptions
              .filter((o) => !(o.lever === "price" && q === "afford"))
              .map((o) => (
                <label key={o.lever} className="option">
                  <input
                    type="checkbox"
                    checked={!draft.ranges[o.lever].locked}
                    onChange={() => toggleLever(o.lever)}
                  />
                  <span>
                    <strong>{o.label}</strong>
                    <small>{o.text}</small>
                  </span>
                </label>
              ))}
          </div>
          <div className="setup-actions">
            {back}
            <span className="spacer" />
            <button className="primary" onClick={finish}>
              See my answer <Icon name="arrow" />
            </button>
          </div>
        </>
      )}
    </section>
  );
}
