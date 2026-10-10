// @vitest-environment jsdom
import { beforeEach, afterEach, describe, it, expect, vi } from "vitest";
import {
  render,
  screen,
  fireEvent,
  waitFor,
  cleanup,
} from "@testing-library/react";
import axe from "axe-core";
import App from "./App";
import { optimize } from "./engine";
import { defaults } from "./model";
import type { Scenario } from "./model";
class TestWorker {
  onmessage: ((e: { data: ReturnType<typeof optimize> }) => void) | null = null;
  onerror: null = null;
  postMessage(s: Scenario) {
    this.onmessage?.({ data: optimize(s) });
  }
  terminate() {}
}
beforeEach(() => {
  vi.stubGlobal("Worker", TestWorker);
  vi.stubGlobal("scrollTo", () => {});
  localStorage.clear();
  localStorage.setItem(
    "north-star.starting-plan.v1",
    JSON.stringify(defaults()),
  );
  window.location.hash = "";
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});
const noAxeViolations = async () => {
  const result = await axe.run(document.body, {
    rules: { "color-contrast": { enabled: false } },
  });
  expect(result.violations).toEqual([]);
};
const verdictText = () => screen.getByRole("heading", { level: 1 }).textContent;
const advanced = () =>
  fireEvent.click(screen.getByRole("button", { name: "Advanced" }));
const begin = (card = "When can I buy a home?") => {
  fireEvent.click(screen.getByRole("button", { name: /Get started/ }));
  fireEvent.click(
    screen.getAllByRole("button").find((b) => b.textContent?.startsWith(card))!,
  );
};
const pathsReady = () =>
  waitFor(() =>
    expect(
      screen.getAllByRole("button", { name: "Choose this path" }).length,
    ).toBeGreaterThan(0),
  );
const nextFromAnswer = () =>
  fireEvent.click(screen.getByRole("button", { name: /See ways to/ }));

describe("plan journey", () => {
  it("answers the question in one sentence with no accessibility issues", async () => {
    render(<App />);
    expect(screen.getByRole("list", { name: "Plan progress" })).toBeTruthy();
    expect(verdictText()).toContain("You can buy a $300,000 home in");
    await noAxeViolations();
  }, 15000);
  it("applies a chosen path when moving on", async () => {
    render(<App />);
    nextFromAnswer();
    expect(verdictText()).toBe("Pick a way to get there");
    await pathsReady();
    const choose = screen.getAllByRole("button", {
      name: "Choose this path",
    })[0];
    fireEvent.click(choose);
    expect(choose.getAttribute("aria-pressed")).toBe("true");
    fireEvent.click(screen.getByRole("button", { name: /Next: fine-tune/ }));
    expect(screen.getByRole("status").textContent).toContain(
      "is now your plan",
    );
    expect(verdictText()).toBe("Fine-tune your plan");
  });
  it("keeps slider moves as a preview until they are applied", async () => {
    render(<App />);
    nextFromAnswer();
    await pathsReady();
    fireEvent.click(screen.getByRole("button", { name: /Next: fine-tune/ }));
    const apply = screen.getByRole("button", { name: "Apply changes" });
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    const before = screen.getByText(/^You can buy/).textContent;
    fireEvent.change(screen.getByRole("slider", { name: /Your salary/ }), {
      target: { value: "140000" },
    });
    expect(screen.getByText("With these changes")).toBeTruthy();
    expect(screen.getByText(/^You can buy/).textContent).not.toBe(before);
    expect((apply as HTMLButtonElement).disabled).toBe(false);
    fireEvent.click(apply);
    expect(screen.getByText("Right now")).toBeTruthy();
    expect((apply as HTMLButtonElement).disabled).toBe(true);
    const applied = screen.getByText(/^You can buy/).textContent;
    cleanup();
    render(<App />);
    expect(verdictText()).toBe(applied);
  });
  it("ends on a personal action plan that can be saved", async () => {
    render(<App />);
    nextFromAnswer();
    await pathsReady();
    fireEvent.click(screen.getByRole("button", { name: /Next: fine-tune/ }));
    fireEvent.click(
      screen.getByRole("button", { name: /Next: build my plan/ }),
    );
    expect(verdictText()).toContain("Buy a $300,000 home in ");
    expect(screen.getByRole("heading", { name: "Milestones" })).toBeTruthy();
    expect(
      screen.getByRole("heading", { name: "Your checklist" }),
    ).toBeTruthy();
    expect(screen.getByText(/Set up an automatic transfer of/)).toBeTruthy();
    await noAxeViolations();
    fireEvent.click(screen.getByRole("button", { name: "Save my plan" }));
    expect(
      JSON.parse(localStorage.getItem("north-star.scenarios.v1")!).length,
    ).toBe(1);
  }, 15000);
  it("switches questions in place", () => {
    render(<App />);
    fireEvent.click(
      screen.getByRole("button", { name: "What income do I need?" }),
    );
    expect(verdictText()).toMatch(/You need about|income alone/i);
    fireEvent.click(
      screen.getByRole("button", { name: "Can I buy by a certain date?" }),
    );
    expect(screen.getByLabelText("Target purchase date")).toBeTruthy();
    fireEvent.click(
      screen.getByRole("button", { name: "How much home can I afford?" }),
    );
    expect(verdictText()).toMatch(/You can afford about|No home price/);
  });
});

describe("advanced pages", () => {
  it("reorders priorities using accessible buttons and toggles locks", () => {
    render(<App />);
    advanced();
    fireEvent.click(screen.getByRole("button", { name: "Priorities" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Move Keep my flexible spending up" }),
    );
    const items = screen.getAllByRole("listitem");
    expect(items[1].textContent).toContain("Keep my flexible spending");
    const button = screen.getByRole("button", {
      name: "Home price",
      pressed: true,
    });
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
  it("supports saving, opening and duplicating a scenario", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Saved/ }));
    fireEvent.click(screen.getByRole("button", { name: /Save current plan/ }));
    expect(screen.getByRole("heading", { name: "My first home" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(
      screen.getByRole("heading", { name: "My first home copy" }),
    ).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("north-star.scenarios.v1")!).length,
    ).toBe(2);
  });
  it("offers every goal with the right target control", () => {
    render(<App />);
    advanced();
    fireEvent.change(screen.getByLabelText("Your goal"), {
      target: { value: "date" },
    });
    expect(screen.getByLabelText("Target purchase date")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Your goal"), {
      target: { value: "salary" },
    });
    expect(screen.getByText("Solve for the minimum")).toBeTruthy();
  });
  it("updates parts of total spending by the difference instead of double-counting", () => {
    render(<App />);
    advanced();
    fireEvent.click(screen.getByRole("button", { name: "Assumptions" }));
    fireEvent.change(screen.getByLabelText(/Debt payments \(part of total\)/), {
      target: { value: "400" },
    });
    const total = screen.getByLabelText(
      /^Total monthly spending/,
    ) as HTMLInputElement;
    expect(Number(total.value)).toBeCloseTo(3500 + 100);
  });
});

describe("guided setup", () => {
  it("starts on a landing page, then asks the question first", async () => {
    localStorage.removeItem("north-star.starting-plan.v1");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: /Find out when you can buy/ }),
    ).toBeTruthy();
    await noAxeViolations();
    fireEvent.click(screen.getByRole("button", { name: /Get started/ }));
    expect(
      screen.getByRole("heading", { name: "What do you want to know?" }),
    ).toBeTruthy();
    expect(screen.getByRole("list", { name: "Setup progress" })).toBeTruthy();
    await noAxeViolations();
  });
  it("shows one step at a time and keeps edited numbers going back", () => {
    localStorage.removeItem("north-star.starting-plan.v1");
    render(<App />);
    begin();
    expect(
      screen.getByRole("heading", { name: "What comes in?" }),
    ).toBeTruthy();
    fireEvent.change(
      screen.getByLabelText("Household take-home pay per month"),
      { target: { value: "8000" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "What goes out?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      (
        screen.getByLabelText(
          "Household take-home pay per month",
        ) as HTMLInputElement
      ).value,
    ).toBe("8000");
  });
  it("completes setup, remembers it on reload, and keeps advanced pages separate", () => {
    localStorage.removeItem("north-star.starting-plan.v1");
    const view = render(<App />);
    begin();
    fireEvent.change(
      screen.getByLabelText("Household take-home pay per month"),
      { target: { value: "8000" } },
    );
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Total monthly spending"), {
      target: { value: "6000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Savings today"), {
      target: { value: "15000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    // "When can I buy" finds the month itself, so it does not ask for one.
    expect(
      screen.queryByLabelText("Months from now you want to buy"),
    ).toBeNull();
    fireEvent.change(screen.getByLabelText("Target home price"), {
      target: { value: "350000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "See my answer" }));
    expect(verdictText()).toContain("$350,000");
    const stored = JSON.parse(
      localStorage.getItem("north-star.starting-plan.v1")!,
    );
    expect(stored.profile.net).toBe(8000);
    expect(stored.profile.expenses).toBe(6000);
    expect(stored.profile.savings).toBe(15000);
    expect(stored.target).toBe(350000);
    advanced();
    fireEvent.click(screen.getByRole("button", { name: "Priorities" }));
    expect(screen.getByText("What matters most")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Explore" }));
    expect(screen.getByText("What has to be true?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Assumptions" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Edit starting numbers" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel setup" }));
    expect(verdictText()).toContain("$350,000");
    view.unmount();
    render(<App />);
    advanced();
    expect(
      (screen.getByLabelText("Goal target") as HTMLInputElement).value,
    ).toBe("350000");
  });
  it("rejects rent above total spending without advancing", () => {
    localStorage.removeItem("north-star.starting-plan.v1");
    render(<App />);
    begin();
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Total monthly spending"), {
      target: { value: "500" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.getByRole("alert").textContent).toContain(
      "Rent cannot exceed",
    );
    expect(
      screen.getByRole("heading", { name: "What goes out?" }),
    ).toBeTruthy();
  });
  it("asks for a date and no price for the afford question", () => {
    localStorage.removeItem("north-star.starting-plan.v1");
    render(<App />);
    begin("How much home can I afford?");
    for (let i = 0; i < 3; i++)
      fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(screen.queryByLabelText("Target home price")).toBeNull();
    expect(
      screen.getByLabelText("Months from now you want to buy"),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "See my answer" }));
    expect(verdictText()).toMatch(/You can afford about|No home price/);
  });
});
