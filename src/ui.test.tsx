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
    const input = screen.getByLabelText(/Primary federal payment \(included\)/);
    fireEvent.change(input, { target: { value: "400" } });
    const baseline = screen.getByLabelText(
      /Current total spending baseline/,
    ) as HTMLInputElement;
    expect(Number(baseline.value)).toBeCloseTo(6726 + 101.33);
  });
});
