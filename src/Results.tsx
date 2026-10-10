import { useMemo } from "react";
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
import type { optimize, Path } from "./engine";
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
    show: (v) => `${v}%`,
  },
};
const sliderSets: Record<Question | "other", (keyof typeof sliders)[]> = {
  when: ["salary", "flexibleTarget", "price", "down"],
  afford: ["salary", "flexibleTarget", "months", "down"],
  deadline: ["salary", "flexibleTarget", "price", "down"],
  income: ["flexibleTarget", "price", "months", "down"],
  other: ["salary", "flexibleTarget", "price", "months", "down"],
};

export function Results({
  s,
  setS,
  update,
  result,
  busy,
  onApply,
  onSave,
  onAdvanced,
  onStartOver,
}: {
  s: Scenario;
  setS: (s: Scenario) => void;
  update: (key: keyof Profile, value: number) => void;
  result: ReturnType<typeof optimize> | null;
  busy: boolean;
  onApply: (path: Path) => void;
  onSave: () => void;
  onAdvanced: () => void;
  onStartOver: () => void;
}) {
  const q = questionFor(s.objective);
  const v = useMemo(() => verdict(s), [s]);
  // "Wait longer" repeats the verdict for date questions, so leave it out there.
  const paths = (result?.paths ?? []).filter(
    (p) => !((q === "when" || q === "deadline") && p.name === "Wait longer"),
  );
  return (
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
                setS({ ...s, target: t, profile: { ...s.profile, months: t } });
              }}
            />
          </label>
        )}
      </section>

      <section className="card" aria-labelledby="ways-heading">
        <div className="card-head">
          <h2 id="ways-heading">
            {q === "when" && v.tone === "good"
              ? "Ways to buy sooner"
              : v.tone === "good"
                ? "Other ways to get there"
                : "Ways to get there"}
          </h2>
          <p>
            Each option passes all your limits. Pick one to make it your plan.
          </p>
        </div>
        {busy ? (
          <p className="loading">Finding your options…</p>
        ) : paths.length ? (
          <div className="ways">
            {paths.slice(0, 4).map((path) => (
              <article className="way" key={path.name}>
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
                <button className="secondary" onClick={() => onApply(path)}>
                  Choose this path
                </button>
              </article>
            ))}
          </div>
        ) : (
          <p className="empty">
            No option fits your limits yet. Try the sliders below, or loosen a
            limit in Advanced.
          </p>
        )}
      </section>

      <section className="card" aria-labelledby="try-heading">
        <div className="card-head">
          <h2 id="try-heading">Try it yourself</h2>
          <p>Move a slider. The answer at the top updates right away.</p>
        </div>
        <div className="sliders">
          {sliderSets[q ?? "other"].map((k) => {
            const d = sliders[k];
            const value = s.profile[d.key] as number;
            const max = Math.max(d.max, value);
            return (
              <label key={k} className="slider">
                <span className="slider-top">
                  <span>{d.label}</span>
                  <strong>{d.show(value)}</strong>
                </span>
                <input
                  type="range"
                  min={d.min}
                  max={max}
                  step={d.step}
                  value={value}
                  aria-valuetext={d.show(value)}
                  onChange={(ev) => update(d.key, Number(ev.target.value))}
                />
              </label>
            );
          })}
        </div>
      </section>

      <section className="card">
        <Chart
          p={v.profile}
          objective={s.objective}
          protectedReserve={s.profile.reserve}
        />
      </section>

      <div className="results-actions">
        <button className="primary" onClick={onSave}>
          <Icon name="save" /> Save this plan
        </button>
        <button className="secondary" onClick={onAdvanced}>
          <Icon name="sliders" /> Advanced settings
        </button>
        <button className="ghost" onClick={onStartOver}>
          Start over
        </button>
      </div>
    </>
  );
}
