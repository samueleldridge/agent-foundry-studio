import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderRoute } from "./utils";

describe("theme", () => {
  it("toggles dark mode and persists the choice", async () => {
    const user = userEvent.setup();
    renderRoute("/projects");

    // matchMedia mock returns light, no stored preference → light.
    expect(document.documentElement.classList.contains("dark")).toBe(false);

    await user.click(
      await screen.findByRole("button", { name: "Switch to dark mode" }),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(localStorage.getItem("foundry-studio-theme")).toBe("dark");

    await user.click(
      screen.getByRole("button", { name: "Switch to light mode" }),
    );
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(localStorage.getItem("foundry-studio-theme")).toBe("light");
  });

  it("restores the persisted theme on a fresh mount (reload)", async () => {
    localStorage.setItem("foundry-studio-theme", "dark");
    renderRoute("/projects");
    await screen.findByRole("button", { name: "Switch to light mode" });
    expect(document.documentElement.classList.contains("dark")).toBe(true);
  });
});
