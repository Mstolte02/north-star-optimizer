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
describe("accessible application interactions", () => {
  it("renders valid landmarks, labeled controls and no serious automated accessibility issues", async () => {
    render(<App />);
    await waitFor(() =>
      expect(screen.getByText("Within constraints")).toBeTruthy(),
    );
    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  }, 15000);
  it("reorders priorities using accessible buttons and toggles locks", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Priorities" }));
    const up = screen.getByRole("button", {
      name: "Move Preserve lifestyle spending up",
    });
    fireEvent.click(up);
    const items = screen.getAllByRole("listitem");
    expect(items[1].textContent).toContain("Preserve lifestyle");
    const button = screen.getByRole("button", {
      name: "Home price",
      pressed: true,
    });
    fireEvent.click(button);
    expect(button.getAttribute("aria-pressed")).toBe("false");
  });
  it("supports saving, opening and duplicating a scenario", async () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Save this scenario" }));
    fireEvent.click(screen.getByRole("button", { name: /Scenarios/ }));
    expect(
      screen.getByRole("heading", { name: "Our first home" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(
      screen.getByRole("heading", { name: "Our first home copy" }),
    ).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("north-star.scenarios.v1")!).length,
    ).toBe(2);
  });
  it("switches North Stars and exposes appropriate target controls", () => {
    render(<App />);
    fireEvent.change(screen.getByLabelText(/MY NORTH STAR/), {
      target: { value: "date" },
    });
    expect(screen.getByLabelText("Target purchase date")).toBeTruthy();
    fireEvent.change(screen.getByLabelText(/MY NORTH STAR/), {
      target: { value: "salary" },
    });
    expect(screen.getByText("Solve for the minimum")).toBeTruthy();
  });
  it("updates included loan components by the difference instead of double-counting", () => {
    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: "Assumptions" }));
    const input = screen.getByLabelText(/Primary federal payment \(included\)/);
    fireEvent.change(input, { target: { value: "400" } });
    const baseline = screen.getByLabelText(
      /Current total spending baseline/,
    ) as HTMLInputElement;
    expect(Number(baseline.value)).toBeCloseTo(6726 + 101.33);
  });
});

describe("guided setup and focused pages", () => {
  it("shows only one setup step and preserves edited numbers going back", () => {
    localStorage.removeItem("north-star.starting-plan.v1");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "What comes in?" }),
    ).toBeTruthy();
    expect(screen.queryByText("Your priorities.")).toBeNull();
    fireEvent.change(screen.getByLabelText("Household monthly take-home"), {
      target: { value: "8000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    expect(
      screen.getByRole("heading", { name: "What goes out?" }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Back" }));
    expect(
      (screen.getByLabelText("Household monthly take-home") as HTMLInputElement)
        .value,
    ).toBe("8000");
  });
  it("completes setup, remembers it on reload, and separates planner pages", async () => {
    localStorage.removeItem("north-star.starting-plan.v1");
    const view = render(<App />);
    fireEvent.change(screen.getByLabelText("Household monthly take-home"), {
      target: { value: "8000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Total monthly spending"), {
      target: { value: "6000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Current savings"), {
      target: { value: "15000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Continue" }));
    fireEvent.change(screen.getByLabelText("Target home price"), {
      target: { value: "350000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "See my plan" }));
    expect(screen.getByLabelText(/MY NORTH STAR/)).toBeTruthy();
    expect(screen.queryByText("Your priorities.")).toBeNull();
    expect(screen.queryByText("What has to be true?")).toBeNull();
    const stored = JSON.parse(
      localStorage.getItem("north-star.starting-plan.v1")!,
    );
    expect(stored.profile.net).toBe(8000);
    expect(stored.profile.expenses).toBe(6000);
    expect(stored.profile.savings).toBe(15000);
    expect(stored.target).toBe(350000);
    fireEvent.click(screen.getByRole("button", { name: "Priorities" }));
    expect(screen.getByText("Your priorities.")).toBeTruthy();
    expect(screen.queryByLabelText(/MY NORTH STAR/)).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Explore" }));
    expect(screen.getByText("What has to be true?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Assumptions" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Edit starting numbers" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel setup" }));
    expect(
      screen.getByRole("heading", { name: "Your financial assumptions." }),
    ).toBeTruthy();
    view.unmount();
    render(<App />);
    expect(
      (screen.getByLabelText("North Star target") as HTMLInputElement).value,
    ).toBe("350000");
  });
  it("rejects rent above total spending without advancing", () => {
    localStorage.removeItem("north-star.starting-plan.v1");
    render(<App />);
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
  it("has accessible setup controls and progress", async () => {
    localStorage.removeItem("north-star.starting-plan.v1");
    render(<App />);
    expect(screen.getByRole("list", { name: "Setup progress" })).toBeTruthy();
    const result = await axe.run(document.body, {
      rules: { "color-contrast": { enabled: false } },
    });
    expect(result.violations).toEqual([]);
  });
});
