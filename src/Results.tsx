import { useMemo, useState } from "react";
import {
  applyQuestion,
  dateAt,
  monthDiff,
  questionFor,
  questions,
  type Profile,
  type Question,
  type Scenario,
} from "./model";
import {
  accumulate,
  adjustedProfile,
  cashFlow,
  closingCash,
  downAmount,
  evaluate,
  savingsRequired,
  type optimize,
  type Path,
} from "./engine";
import { Chart, money, monthLabel } from "./Chart";
import { verdict } from "./verdict";
import { Icon } from "./Icon";

type Slider = {
  key: keyof Profile;
  label: string;
  min: number;
  max: number;
  step: number;
  show: (v: number) => string;
};
const sliders: Record<string, Slider> = {
  salary: {
    key: "salary",
    label: "Your salary",
    min: 20000,
    max: 400000,
    step: 1000,
    show: (v) => `${money(v)} / yr`,
  },
  flexibleTarget: {
    key: "flexibleTarget",
    label: "Flexible spending",
    min: 0,
    max: 3000,
    step: 25,
    show: (v) => `${money(v)} / mo`,
  },
  price: {
    key: "price",
    label: "Home price",
    min: 50000,
    max: 2000000,
    step: 5000,
    show: money,
  },
  months: {
    key: "months",
    label: "When you buy",
    min: 1,
    max: 120,
    step: 1,
    show: (v) => `${v} months`,
  },
  down: {
    key: "down",
    label: "Down payment",
    min: 0,
    max: 50,
    step: 0.5,
    show: (v) => `${Math.round(v * 10) / 10}%`,
  },
};
const sliderSets: Record<Question | "other", (keyof typeof sliders)[]> = {
  when: ["salary", "flexibleTarget", "price", "down"],
  afford: ["salary", "flexibleTarget", "months", "down"],
  deadline: ["salary", "flexibleTarget", "price", "down"],
  income: ["flexibleTarget", "price", "months", "down"],
  other: ["salary", "flexibleTarget", "price", "months", "down"],
};
export const journeySteps = [
  "Your answer",
  "Pick a path",
  "Fine-tune",
  "Your plan",
] as const;

// The scenario with slider changes applied. Salary changes adjust take-home.
function withChanges(s: Scenario, changes: Partial<Profile>): Scenario {
  if (!Object.keys(changes).length) return s;
  const profile = adjustedProfile(s, changes);
  const target =
    s.objective === "price" && changes.price !== undefined
      ? changes.price
      : s.target;
  return { ...s, profile, target };
}

export function Results({
  s,
  setS,
  start,
  step,
  setStep,
  result,
  busy,
  onApply,
  onSave,
  onAdvanced,
  onStartOver,
}: {
  s: Scenario;
  setS: (s: Scenario) => void;
  start: Profile;
  step: number;
  setStep: (n: number) => void;
  result: ReturnType<typeof optimize> | null;
  busy: boolean;
  onApply: (path: Path) => void;
  onSave: () => void;
  onAdvanced: () => void;
  onStartOver: () => void;
}) {
  const q = questionFor(s.objective);
  const v = useMemo(() => verdict(s), [s]);
  // Slider edits are a draft until applied. A draft made against an older
  // scenario no longer applies.
  const [draft, setDraft] = useState<{
    base: Scenario;
    changes: Partial<Profile>;
  }>({ base: s, changes: {} });
  const changes = draft.base === s ? draft.changes : {};
  const dirty = Object.keys(changes).length > 0;
  const preview = useMemo(
    () => (dirty ? verdict(withChanges(s, changes)) : null),
    [dirty, s, changes],
  );
  const applyDraft = () => {
    if (dirty) setS(withChanges(s, changes));
  };
  const [picked, setPicked] = useState<string | null>(null);
  // "Wait longer" repeats the verdict for date questions, so leave it out there.
  const paths = (result?.paths ?? []).filter(
    (p) => !((q === "when" || q === "deadline") && p.name === "Wait longer"),
  );
  const next = (n: number) => {
    setStep(n);
    window.scrollTo?.(0, 0);
  };

  return (
    <div className="journey">
      <ol className="journey-progress" aria-label="Plan progress">
        {journeySteps.map((name, i) => (
          <li
            key={name}
            aria-current={i === step ? "step" : undefined}
            className={i < step ? "done" : ""}
          >
            <button onClick={() => next(i)}>
              <span className="step-dot">
                {i < step ? <Icon name="check" /> : i + 1}
              </span>
              <span>{name}</span>
            </button>
          </li>
        ))}
      </ol>

      {step === 0 && (
        <>
          <nav className="question-switch" aria-label="Question">
            {(Object.keys(questions) as Question[]).map((k) => (
              <button
                key={k}
                aria-pressed={q === k}
                onClick={() => setS(applyQuestion(s, k))}
              >
                {questions[k].title}
              </button>
            ))}
          </nav>
          <section className={`verdict verdict-${v.tone}`} aria-live="polite">
            <span className="kicker">
              <Icon name="star" /> {v.kicker}
            </span>
            <h1>{v.headline}</h1>
            <p>{v.detail}</p>
            {q === "deadline" && (
              <label className="deadline">
                <span>Buy by</span>
                <input
                  type="month"
                  aria-label="Target purchase date"
                  value={dateAt(s.profile.start, s.target)}
                  min={dateAt(s.profile.start, 1)}
                  max={dateAt(s.profile.start, 360)}
                  onChange={(ev) => {
                    const t = Math.max(
                      1,
                      monthDiff(s.profile.start, ev.target.value),
                    );
                    setS({
                      ...s,
                      target: t,
                      profile: { ...s.profile, months: t },
                    });
                  }}
                />
              </label>
            )}
          </section>
          <section className="card">
            <Chart
              p={v.profile}
              objective={s.objective}
              protectedReserve={s.profile.reserve}
            />
          </section>
          <div className="journey-nav">
            <button className="ghost" onClick={onStartOver}>
              Change my numbers
            </button>
            <span className="spacer" />
            <button className="primary" onClick={() => next(1)}>
              {v.tone === "good"
                ? "See ways to do better"
                : "See ways to get there"}{" "}
              <Icon name="arrow" />
            </button>
          </div>
        </>
      )}

      {step === 1 && (
        <>
          <div className="page-head">
            <div>
              <h1>Pick a way to get there</h1>
              <p>
                Each option passes all your limits. Pick the one that fits your
                life best, or keep your numbers as they are.
              </p>
            </div>
          </div>
          {busy ? (
            <p className="loading">Finding your options…</p>
          ) : (
            <div className="ways">
              <article className={`way ${picked === null ? "is-picked" : ""}`}>
                <h3>Keep my numbers</h3>
                <p className="way-note">{v.headline}</p>
                <span className="spacer" />
                <button
                  className="secondary"
                  aria-pressed={picked === null}
                  onClick={() => setPicked(null)}
                >
                  {picked === null ? "Selected" : "Choose this"}
                </button>
              </article>
              {paths.slice(0, 4).map((path) => (
                <article
                  className={`way ${picked === path.name ? "is-picked" : ""}`}
                  key={path.name}
                >
                  <h3>{path.name}</h3>
                  <ul>
                    {path.changes.map((c) => (
                      <li key={c}>
                        <Icon name="check" />
                        {c}
                      </li>
                    ))}
                  </ul>
                  <dl>
                    <div>
                      <dt>Buy in</dt>
                      <dd>{monthLabel(path.e.p, path.e.p.months)}</dd>
                    </div>
                    <div>
                      <dt>Housing / mo</dt>
                      <dd>{money(path.e.house.total)}</dd>
                    </div>
                    <div>
                      <dt>Saved / mo after</dt>
                      <dd>{money(path.e.after)}</dd>
                    </div>
                  </dl>
                  <button
                    className="secondary"
                    aria-pressed={picked === path.name}
                    onClick={() => setPicked(path.name)}
                  >
                    {picked === path.name ? "Selected" : "Choose this path"}
                  </button>
                </article>
              ))}
            </div>
          )}
          {!busy && !paths.length && (
            <p className="empty">
              No other option fits your limits. You can still fine-tune your
              numbers in the next step.
            </p>
          )}
          <div className="journey-nav">
            <button className="ghost" onClick={() => next(0)}>
              Back
            </button>
            <span className="spacer" />
            <button
              className="primary"
              disabled={busy}
              onClick={() => {
                const path = paths.find((p) => p.name === picked);
                if (path) onApply(path);
                setPicked(null);
                next(2);
              }}
            >
              Next: fine-tune <Icon name="arrow" />
            </button>
          </div>
        </>
      )}

      {step === 2 && (
        <>
          <div className="page-head">
            <div>
              <h1>Fine-tune your plan</h1>
              <p>
                Move the sliders, check the preview, then apply your changes to
                update the chart.
              </p>
            </div>
          </div>
          <section className="card" aria-labelledby="try-heading">
            <div className="card-head">
              <h2 id="try-heading">Adjust your numbers</h2>
            </div>
            <div className="sliders">
              {sliderSets[q ?? "other"].map((k) => {
                const d = sliders[k];
                const value = (changes[d.key] ?? s.profile[d.key]) as number;
                return (
                  <label key={k} className="slider">
                    <span className="slider-top">
                      <span>{d.label}</span>
                      <strong>{d.show(value)}</strong>
                    </span>
                    <input
                      type="range"
                      min={d.min}
                      max={Math.max(d.max, value)}
                      step={d.step}
                      value={value}
                      aria-valuetext={d.show(value)}
                      onChange={(ev) =>
                        setDraft({
                          base: s,
                          changes: {
                            ...changes,
                            [d.key]: Number(ev.target.value),
                          },
                        })
                      }
                    />
                  </label>
                );
              })}
            </div>
            <div
              className={`preview ${preview ? `preview-${preview.tone}` : ""}`}
              aria-live="polite"
            >
              <span>{preview ? "With these changes" : "Right now"}</span>
              <strong>{(preview ?? v).headline}</strong>
            </div>
            <div className="apply-row">
              <button
                className="ghost"
                disabled={!dirty}
                onClick={() => setDraft({ base: s, changes: {} })}
              >
                Reset
              </button>
              <button
                className="primary"
                disabled={!dirty}
                onClick={applyDraft}
              >
                Apply changes
              </button>
            </div>
          </section>
          <section className="card">
            <Chart
              p={v.profile}
              objective={s.objective}
              protectedReserve={s.profile.reserve}
            />
          </section>
          <div className="journey-nav">
            <button className="ghost" onClick={() => next(1)}>
              Back
            </button>
            <span className="spacer" />
            <button
              className="primary"
              onClick={() => {
                applyDraft();
                next(3);
              }}
            >
              {dirty ? "Apply and build my plan" : "Next: build my plan"}{" "}
              <Icon name="arrow" />
            </button>
          </div>
        </>
      )}

      {step === 3 && (
        <ActionPlan
          s={s}
          start={start}
          onBack={() => next(2)}
          onSave={onSave}
          onAdvanced={onAdvanced}
          onStartOver={onStartOver}
        />
      )}
    </div>
  );
}

function ActionPlan({
  s,
  start,
  onBack,
  onSave,
  onAdvanced,
  onStartOver,
}: {
  s: Scenario;
  start: Profile;
  onBack: () => void;
  onSave: () => void;
  onAdvanced: () => void;
  onStartOver: () => void;
}) {
  const v = verdict(s);
  const p = v.profile;
  const m = p.months;
  const e = evaluate(s, p);
  const closing = closingCash(p);
  const target = savingsRequired(p) ?? 0;
  const leftover = cashFlow(p, 0);
  const buy = monthLabel(p, m);
  const changes: string[] = [];
  if (p.salary - start.salary > 1)
    changes.push(
      `Grow your salary to ${money(p.salary)} (+${money(p.salary - start.salary)} a year).`,
    );
  if (start.flexibleTarget - p.flexibleTarget > 1)
    changes.push(
      `Cut flexible spending to ${money(p.flexibleTarget)} a month (−${money(start.flexibleTarget - p.flexibleTarget)}).`,
    );
  if (Math.abs(p.down - start.down) > 0.1)
    changes.push(
      `Plan on a ${Math.round(p.down * 10) / 10}% down payment (${money(downAmount(p))}).`,
    );
  if (Math.abs(p.price - start.price) > 1)
    changes.push(`Shop for homes around ${money(p.price)}.`);
  const count = Math.min(4, Math.max(1, m - 1));
  const marks = [
    ...new Set(
      Array.from({ length: count }, (_, i) =>
        Math.max(1, Math.round(((i + 1) * m) / (count + 1))),
      ),
    ),
  ].filter((k) => k < m);
  const checklist = [
    `Set up an automatic transfer of ${money(Math.ceil(target / 10) * 10)} a month into savings.`,
    ...changes,
    `Get pre-approved with a lender about three months before ${buy}.`,
    `Keep ${money(p.reserve)} untouched after closing as your safety net.`,
    "Come back every three months and update your numbers.",
  ];
  if (v.tone === "warn")
    return (
      <>
        <div className="page-head">
          <div>
            <h1>Your plan</h1>
            <p>This plan doesn't work yet.</p>
          </div>
        </div>
        <section className="card">
          <p className="warning">
            {v.headline} {v.detail}
          </p>
        </section>
        <div className="journey-nav">
          <button className="ghost" onClick={onBack}>
            Back
          </button>
          <span className="spacer" />
          <button className="secondary" onClick={onAdvanced}>
            Loosen my limits in Advanced
          </button>
        </div>
      </>
    );
  return (
    <>
      <section className="plan-hero">
        <span className="kicker">
          <Icon name="star" /> Your plan · {s.name}
        </span>
        <h1>
          Buy a {money(p.price)} home in {buy}.
        </h1>
        <p>{v.detail}</p>
      </section>
      <dl className="plan-numbers">
        <div>
          <dt>Save each month</dt>
          <dd>{money(target)}</dd>
          <dd className="plan-note">
            You have about {money(leftover)} left over today.
          </dd>
        </div>
        <div>
          <dt>Cash needed at closing</dt>
          <dd>{money(closing)}</dd>
          <dd className="plan-note">Down payment, closing and moving costs.</dd>
        </div>
        <div>
          <dt>Housing after you buy</dt>
          <dd>{money(e.house.total)} / mo</dd>
          <dd className="plan-note">Mortgage, tax, insurance and upkeep.</dd>
        </div>
        <div>
          <dt>Cushion you keep</dt>
          <dd>{money(e.remaining)}</dd>
          <dd className="plan-note">Cash left the day you get the keys.</dd>
        </div>
      </dl>
      <div className="two-col">
        <section className="card">
          <div className="card-head">
            <h2>Milestones</h2>
            <p>Where your savings should be along the way.</p>
          </div>
          <ol className="milestones">
            <li>
              <span>Today</span>
              <strong>{money(p.savings)} saved</strong>
            </li>
            {marks.map((k) => (
              <li key={k}>
                <span>{monthLabel(p, k)}</span>
                <strong>{money(accumulate(p, k))} saved</strong>
              </li>
            ))}
            <li className="milestone-end">
              <span>{buy}</span>
              <strong>
                {money(accumulate(p, m))} saved · pay {money(closing)} at
                closing
              </strong>
            </li>
          </ol>
        </section>
        <section className="card">
          <div className="card-head">
            <h2>Your checklist</h2>
            <p>The steps that make this plan real.</p>
          </div>
          <ul className="checklist">
            {checklist.map((c) => (
              <li key={c}>
                <input type="checkbox" aria-label={c} />
                <span>{c}</span>
              </li>
            ))}
          </ul>
        </section>
      </div>
      <div className="journey-nav plan-actions">
        <button className="ghost" onClick={onBack}>
          Back
        </button>
        <span className="spacer" />
        <button className="secondary" onClick={() => window.print()}>
          Print
        </button>
        <button className="secondary" onClick={onStartOver}>
          Start over
        </button>
        <button className="primary" onClick={onSave}>
          <Icon name="save" /> Save my plan
        </button>
      </div>
    </>
  );
}
