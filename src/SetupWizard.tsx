import { useEffect, useRef, useState } from "react";
import type { Profile, Scenario } from "./model";
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
      "Describe the home you want. You can switch to a different goal on the Plan page at any time.",
    fields: [
      ["price", "Target home price", 1, 10000000],
      ["down", "Down payment (%)", 0, 100],
      ["rate", "Mortgage rate (%)", 0, 30],
      ["months", "Months until you want to buy", 1, 360],
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
  const current = steps[step];
  const change = (key: keyof Profile, value: number) =>
    setDraft((old) => ({ ...old, profile: { ...old.profile, [key]: value } }));
  const next = (form: HTMLFormElement) => {
    if (!form.reportValidity()) return;
    const p = draft.profile;
    if (step >= 1 && p.rent + p.debtPayment + p.flexible > p.expenses) {
      setError(
        p.rent > p.expenses
          ? "Rent cannot exceed the total spending that includes it."
          : "Rent, debt payments and flexible spending cannot add up to more than your total spending.",
      );
      return;
    }
    setError("");
    if (step < steps.length - 1) {
      setStep(step + 1);
      return;
    }
    const salary = draft.profile.salary;
    onComplete({
      ...draft,
      target:
        draft.objective === "price"
          ? draft.profile.price
          : draft.objective === "date"
            ? draft.profile.months
            : draft.target,
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
          Four quick questions. Then North Star shows what it takes to reach
          your goal.
        </p>
        <ol className="setup-progress" aria-label="Setup progress">
          {steps.map((x, i) => (
            <li
              key={x.name}
              aria-current={i === step ? "step" : undefined}
              className={i < step ? "done" : ""}
            >
              <span className="step-dot">
                {i < step ? <Icon name="check" /> : i + 1}
              </span>
              {x.name}
            </li>
          ))}
        </ol>
      </div>
      <div className="setup-card">
        <span className="step-count">
          Step {step + 1} of {steps.length}
        </span>
        <h1 id="setup-heading" ref={heading} tabIndex={-1}>
          {current.title}
        </h1>
        <p className="setup-intro">{current.intro}</p>
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
            fine-tune everything else later on the Assumptions page.
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
              {step === steps.length - 1 ? "See my plan" : "Continue"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
