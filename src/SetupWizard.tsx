import { useEffect, useRef, useState } from "react";
import {
  applyQuestion,
  questionFor,
  questions,
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
const steps: Step[] = [
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
    name: "Home goal",
    title: "Where are you headed?",
    intro:
      "Describe the home you want. These are estimates; you can change them on the results page.",
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
const names = ["Question", ...steps.map((x) => x.name)];
export function SetupWizard({
  scenario,
  onComplete,
  onCancel,
}: {
  scenario: Scenario;
  onComplete: (s: Scenario) => void;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState(scenario);
  const [step, setStep] = useState(0);
  const [error, setError] = useState("");
  const heading = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    heading.current?.focus();
  }, [step]);
  const q = questionFor(draft.objective) ?? "when";
  const base = steps[step - 1];
  const current =
    base && step === steps.length
      ? {
          ...base,
          fields: base.fields.filter(([k]) => homeFields[q].includes(k)),
        }
      : base;
  const choose = (k: Question) => {
    setDraft((old) => applyQuestion(old, k));
    setStep(1);
  };
  const change = (key: keyof Profile, value: number) =>
    setDraft((old) => ({ ...old, profile: { ...old.profile, [key]: value } }));
  const next = (form: HTMLFormElement) => {
    if (!form.reportValidity()) return;
    const p = draft.profile;
    if (step >= 2 && p.rent + p.debtPayment + p.flexible > p.expenses) {
      setError(
        p.rent > p.expenses
          ? "Rent cannot exceed the total spending that includes it."
          : "Rent, debt payments and flexible spending cannot add up to more than your total spending.",
      );
      return;
    }
    setError("");
    if (step < steps.length) {
      setStep(step + 1);
      return;
    }
    const salary = draft.profile.salary;
    const done = applyQuestion(draft, q);
    onComplete({
      ...done,
      profile: {
        ...draft.profile,
        downMode: "percent",
        raiseSalary: Math.max(draft.profile.raiseSalary, salary),
      },
      ranges: {
        ...draft.ranges,
        salary: {
          ...draft.ranges.salary,
          min: salary,
          max: Math.max(salary * 1.5, draft.ranges.salary.max),
        },
        spending: {
          ...draft.ranges.spending,
          min: Math.min(draft.ranges.spending.min, draft.profile.flexible),
          max: draft.profile.flexible,
        },
      },
    });
  };
  return (
    <section className="setup" aria-labelledby="setup-heading">
      <div className="setup-side">
        <span className="kicker">
          <Icon name="star" /> Get started
        </span>
        <p className="setup-pitch">
          Pick your question, answer four short steps, and get a straight
          answer.
        </p>
        <ol className="setup-progress" aria-label="Setup progress">
          {names.map((x, i) => (
            <li
              key={x}
              aria-current={i === step ? "step" : undefined}
              className={i < step ? "done" : ""}
            >
              <span className="step-dot">
                {i < step ? <Icon name="check" /> : i + 1}
              </span>
              {x}
            </li>
          ))}
        </ol>
      </div>
      <div className="setup-card">
        <span className="step-count">
          Step {step + 1} of {names.length}
        </span>
        <h1 id="setup-heading" ref={heading} tabIndex={-1}>
          {current ? current.title : "What do you want to know?"}
        </h1>
        <p className="setup-intro">
          {current
            ? current.intro
            : "Pick the question that matters most to you. You can switch later."}
        </p>
        {!current && (
          <div className="question-cards">
            {(Object.keys(questions) as Question[]).map((k) => (
              <button
                key={k}
                className={`question-card ${k === q ? "is-current" : ""}`}
                onClick={() => choose(k)}
              >
                <strong>{questions[k].title}</strong>
                <span>{questions[k].text}</span>
                <Icon name="arrow" />
              </button>
            ))}
          </div>
        )}
        {!current && onCancel && (
          <div className="setup-actions">
            <button type="button" className="ghost" onClick={onCancel}>
              Cancel setup
            </button>
          </div>
        )}
        {current && (
          <form
            onSubmit={(ev) => {
              ev.preventDefault();
              next(ev.currentTarget);
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
            <p className="fine">
              Example numbers are filled in. Replace them with yours. You can
              fine-tune everything else later in Advanced settings.
            </p>
            <div className="setup-actions">
              {onCancel && (
                <button type="button" className="ghost" onClick={onCancel}>
                  Cancel setup
                </button>
              )}
              <span className="spacer" />
              {step > 0 && (
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setStep(step - 1);
                    setError("");
                  }}
                >
                  Back
                </button>
              )}
              <button className="primary" type="submit">
                {step === steps.length ? "See my answer" : "Continue"}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  );
}
