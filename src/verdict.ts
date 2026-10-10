import { adjustedProfile, evaluate, maxPrice, salaryThreshold } from "./engine";
import { questionFor, type Profile, type Scenario } from "./model";
import { money, monthLabel } from "./Chart";

export interface Verdict {
  kicker: string;
  headline: string;
  detail: string;
  tone: "good" | "warn";
  // The plan the headline describes, for the supporting numbers and chart.
  profile: Profile;
}
// Earliest whole month at which the plan as entered passes every limit.
export function earliestMonth(s: Scenario, max = 360): number | null {
  const plain = { ...s, objective: "price" as const, target: s.profile.price };
  for (let m = 1; m <= max; m++)
    if (evaluate(plain, { ...s.profile, months: m }).feasible) return m;
  return null;
}
function costLine(s: Scenario, p: Profile) {
  const e = evaluate(s, p);
  return `Housing would cost about ${money(e.house.total)} a month, and you'd keep ${money(e.remaining)} after closing.`;
}
const away = (m: number) =>
  m === 1 ? "1 month from now" : `${m} months from now`;

export function verdict(s: Scenario): Verdict {
  const p = s.profile;
  const today = "With your numbers today";
  switch (questionFor(s.objective)) {
    case "when": {
      const m = earliestMonth(s);
      if (m === null)
        return {
          kicker: today,
          headline: `A ${money(p.price)} home is out of reach for now.`,
          detail:
            "No month in the next 30 years passes your limits. See the ways to get there below.",
          tone: "warn",
          profile: p,
        };
      const at = { ...p, months: m };
      return {
        kicker: today,
        headline: `You can buy a ${money(p.price)} home in ${monthLabel(p, m)}.`,
        detail: `That's ${away(m)}. ${costLine(s, at)}`,
        tone: "good",
        profile: at,
      };
    }
    case "afford": {
      const n = maxPrice({
        ...s,
        ranges: { ...s.ranges, price: { ...s.ranges.price, max: 5000000 } },
      });
      if (n === null)
        return {
          kicker: today,
          headline: "No home price fits your limits yet.",
          detail: `Buying in ${monthLabel(p, p.months)} leaves too little cash or monthly saving. Try the ways below.`,
          tone: "warn",
          profile: p,
        };
      const at = { ...p, price: n };
      return {
        kicker: `If you buy in ${monthLabel(p, p.months)}`,
        headline: `You can afford about ${money(Math.floor(n / 1000) * 1000)}.`,
        detail: `You'd still save ${money(p.after)} a month after buying. ${costLine(s, at)}`,
        tone: "good",
        profile: at,
      };
    }
    case "deadline": {
      const by = monthLabel(p, s.target);
      if (evaluate(s, { ...p, months: s.target }).feasible) {
        const at = { ...p, months: s.target };
        return {
          kicker: today,
          headline: `Yes — you can buy a ${money(p.price)} home by ${by}.`,
          detail: costLine(s, at),
          tone: "good",
          profile: at,
        };
      }
      const m = earliestMonth(s);
      return {
        kicker: today,
        headline: `Not by ${by}.`,
        detail:
          m === null
            ? "No month in the next 30 years works as things stand. The changes below show what would."
            : `The earliest you could buy a ${money(p.price)} home is ${monthLabel(p, m)}. The changes below could close the gap.`,
        tone: "warn",
        profile: m === null ? p : { ...p, months: m },
      };
    }
    case "income": {
      const need = salaryThreshold(s, true);
      if (need === null)
        return {
          kicker: `To buy in ${monthLabel(p, p.months)}`,
          headline: "A higher income alone won't get you there.",
          detail:
            "Another limit, such as your monthly housing cap, blocks the plan. Try a lower price or more time.",
          tone: "warn",
          profile: p,
        };
      const gap = need - p.salary;
      return {
        kicker: `To buy a ${money(p.price)} home in ${monthLabel(p, p.months)}`,
        headline: `You need about ${money(Math.ceil(need / 100) * 100)} a year.`,
        detail:
          gap > 0
            ? `That's ${money(gap)} more than you earn today.`
            : `You already earn enough, with ${money(-gap)} a year to spare.`,
        tone: "good",
        profile: gap > 0 ? adjustedProfile(s, { salary: need }) : p,
      };
    }
    default: {
      const e = evaluate(s);
      return {
        kicker: "Your plan as entered",
        headline: e.feasible
          ? "Your plan works as entered."
          : "Your plan needs changes.",
        detail: e.feasible ? costLine(s, p) : (e.violations[0] ?? ""),
        tone: e.feasible ? "good" : "warn",
        profile: p,
      };
    }
  }
}
