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
      expect(screen.getByText("Within your limits")).toBeTruthy(),
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
      name: "Move Keep my flexible spending up",
    });
    fireEvent.click(up);
    const items = screen.getAllByRole("listitem");
    expect(items[1].textContent).toContain("Keep my flexible spending");
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
    expect(screen.getByRole("heading", { name: "My first home" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Duplicate" }));
    expect(
      screen.getByRole("heading", { name: "My first home copy" }),
    ).toBeTruthy();
    expect(
      JSON.parse(localStorage.getItem("north-star.scenarios.v1")!).length,
    ).toBe(2);
  });
  it("switches North Stars and exposes appropriate target controls", () => {
    render(<App />);
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
    fireEvent.click(screen.getByRole("button", { name: "Assumptions" }));
    const input = screen.getByLabelText(/Debt payments \(part of total\)/);
    fireEvent.change(input, { target: { value: "400" } });
    const baseline = screen.getByLabelText(
      /^Total monthly spending/,
    ) as HTMLInputElement;
    expect(Number(baseline.value)).toBeCloseTo(3500 + 100);
  });
});

describe("guided setup and focused pages", () => {
  it("shows only one setup step and preserves edited numbers going back", () => {
    localStorage.removeItem("north-star.starting-plan.v1");
    render(<App />);
    expect(
      screen.getByRole("heading", { name: "What comes in?" }),
    ).toBeTruthy();
    expect(screen.queryByText("What matters most")).toBeNull();
    fireEvent.change(
      screen.getByLabelText("Household take-home pay per month"),
      {
        target: { value: "8000" },
      },
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
  it("completes setup, remembers it on reload, and separates planner pages", async () => {
    localStorage.removeItem("north-star.starting-plan.v1");
    const view = render(<App />);
    fireEvent.change(
      screen.getByLabelText("Household take-home pay per month"),
      {
        target: { value: "8000" },
      },
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
    fireEvent.change(screen.getByLabelText("Target home price"), {
      target: { value: "350000" },
    });
    fireEvent.click(screen.getByRole("button", { name: "See my plan" }));
    expect(screen.getByLabelText("Your goal")).toBeTruthy();
    expect(screen.queryByText("What matters most")).toBeNull();
    expect(screen.queryByText("What has to be true?")).toBeNull();
    const stored = JSON.parse(
      localStorage.getItem("north-star.starting-plan.v1")!,
    );
    expect(stored.profile.net).toBe(8000);
    expect(stored.profile.expenses).toBe(6000);
    expect(stored.profile.savings).toBe(15000);
    expect(stored.target).toBe(350000);
    fireEvent.click(screen.getByRole("button", { name: "Priorities" }));
    expect(screen.getByText("What matters most")).toBeTruthy();
    expect(screen.queryByLabelText("Your goal")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: "Explore" }));
    expect(screen.getByText("What has to be true?")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Assumptions" }));
    fireEvent.click(
      screen.getByRole("button", { name: "Edit starting numbers" }),
    );
    fireEvent.click(screen.getByRole("button", { name: "Cancel setup" }));
    expect(
      screen.getByRole("heading", { name: "Your assumptions" }),
    ).toBeTruthy();
    view.unmount();
    render(<App />);
    expect(
      (screen.getByLabelText("Goal target") as HTMLInputElement).value,
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
