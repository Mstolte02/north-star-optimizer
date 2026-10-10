import { useEffect, useRef, useState } from "react";
import type { Profile, Scenario } from "./model";

const steps = [
  {
    title: "What comes in?",
    intro:
      "Start with household income. Your take-home amount is the money you actually receive each month.",
    fields: [
      ["salary", "Your annual salary", 0, 10000000],
      ["partnerSalary", "Partner annual salary", 0, 10000000],
      ["net", "Household monthly take-home", 0, 1000000],
    ],
  },
  {
    title: "What goes out?",
    intro:
      "Enter your total monthly spending, including rent and current loan payments. We will not add included payments again.",
    fields: [
      ["expenses", "Total monthly spending", 0, 10000000],
      ["rent", "Monthly rent included in spending", 0, 10000000],
    ],
  },
  {
    title: "What do you want to keep?",
    intro:
      "Set your starting savings and the cushion you want after buying a home.",
    fields: [
      ["savings", "Current savings", 0, 10000000],
      ["reserve", "Minimum savings after closing", 0, 10000000],
      ["after", "Minimum monthly savings after buying", 0, 10000000],
    ],
  },
  {
    title: "Where are you headed?",
    intro:
      "Start with a home goal. You can choose another financial goal on the Plan page. These are planning assumptions, not forecasts.",
    fields: [
      ["price", "Target home price", 1, 10000000],
      ["down", "Down payment (%)", 0, 100],
      ["rate", "Mortgage interest rate (%)", 0, 30],
      ["months", "Months until purchase", 1, 360],
      ["paymentLimit", "Maximum total housing per month", 0, 10000000],
    ],
  },
] as const;
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
  const change = (key: keyof Profile, value: number | boolean) =>
    setDraft((old) => ({ ...old, profile: { ...old.profile, [key]: value } }));
  const next = (form: HTMLFormElement) => {
    if (!form.reportValidity()) return;
    if (step >= 1 && draft.profile.rent > draft.profile.expenses) {
      setError("Rent cannot exceed the total spending that includes it.");
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
      objective: draft.objective,
      mode: draft.mode,
      target:
        draft.objective === "price"
          ? draft.profile.price
          : draft.objective === "date"
            ? draft.profile.months
            : draft.target,
      profile: { ...draft.profile, downMode: "percent" },
      ranges: {
        ...draft.ranges,
        salary: {
          ...draft.ranges.salary,
          min: salary,
          max: Math.max(salary, draft.ranges.salary.max),
        },
        price: { ...draft.ranges.price },
        rate: { ...draft.ranges.rate },
      },
    });
  };
  return (
    <section className="setup-page" aria-labelledby="setup-heading">
      <span className="eyebrow">
        GET STARTED · {step + 1} OF {steps.length}
      </span>
      <h1 id="setup-heading" ref={heading} tabIndex={-1}>
        {current.title}
      </h1>
      <p>{current.intro}</p>
      <ol className="setup-progress" aria-label="Setup progress">
        {["Income", "Spending", "Savings", "Home goal"].map((name, i) => (
          <li key={name} aria-current={i === step ? "step" : undefined}>
            {name}
          </li>
        ))}
      </ol>
      <form
        onSubmit={(ev) => {
          ev.preventDefault();
          next(ev.currentTarget);
        }}
      >
        <div className="fields" key={step}>
          {current.fields.map(([key, label, min, max]) => (
            <label key={key}>
              {label}
              <input
                required
                type="number"
                min={min}
                max={max}
                step={key === "months" ? 1 : 0.01}
                value={draft.profile[key]}
                onChange={(ev) => change(key, Number(ev.target.value))}
              />
            </label>
          ))}
        </div>
        {step === 1 && (
          <label className="setup-inclusion">
            <input
              type="checkbox"
              checked={draft.profile.includesPlus}
              onChange={(ev) => change("includesPlus", ev.target.checked)}
            />{" "}
            Total already includes the Parent PLUS contribution ($
            {draft.profile.plus.toFixed(2)}/month)
          </label>
        )}
        {error && (
          <p role="alert" className="warning">
            {error}
          </p>
        )}
        <p className="small">
          Prefilled with the household planning profile. Change any starting
          number. Other mortgage, expense, and loan assumptions remain available
          on the Assumptions page.
        </p>
        <div className="setup-actions">
          {step > 0 && (
            <button
              type="button"
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
          {onCancel && (
            <button type="button" onClick={onCancel}>
              Cancel setup
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
