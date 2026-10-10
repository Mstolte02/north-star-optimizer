import { Icon, type IconName } from "./Icon";

const points: { icon: IconName; title: string; text: string }[] = [
  {
    icon: "target",
    title: "A straight answer",
    text: "When you can buy, how much you can afford, or what you'd need to earn — in one sentence.",
  },
  {
    icon: "compass",
    title: "Ways to get there",
    text: "See the few changes that would work, such as earning a bit more, waiting, or spending less.",
  },
  {
    icon: "shield",
    title: "Private",
    text: "Everything runs in your browser. No account, no bank login, nothing uploaded.",
  },
];
export function Landing({
  onStart,
  onSaved,
}: {
  onStart: () => void;
  onSaved?: () => void;
}) {
  return (
    <section className="landing" aria-labelledby="landing-heading">
      <div className="landing-hero">
        <span className="kicker">
          <Icon name="star" /> Free home-buying planner
        </span>
        <h1 id="landing-heading">
          Find out when you can buy a home — and what gets you there sooner.
        </h1>
        <p>Answer a few questions about your money. Takes about two minutes.</p>
        <div className="landing-actions">
          <button className="primary big" onClick={onStart}>
            Get started <Icon name="arrow" />
          </button>
          {onSaved && (
            <button className="ghost on-dark" onClick={onSaved}>
              Open saved scenarios
            </button>
          )}
        </div>
      </div>
      <div className="landing-points">
        {points.map((x) => (
          <article key={x.title} className="card">
            <span className="group-icon">
              <Icon name={x.icon} />
            </span>
            <h2>{x.title}</h2>
            <p>{x.text}</p>
          </article>
        ))}
      </div>
    </section>
  );
}
