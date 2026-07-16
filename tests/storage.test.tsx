import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { server } from "./msw/server";
import { errorResponse } from "./msw/handlers";
import { renderRoute } from "./utils";

describe("storage", () => {
  it("renders stats, pins, and the dry-run-gated gc flow", async () => {
    const user = userEvent.setup();
    renderRoute("/storage");

    expect(await screen.findByText("4.4 MB")).toBeInTheDocument();
    expect(screen.getByText("8 item(s)")).toBeInTheDocument();
    expect(
      await screen.findByText("01KXEPYAH7NH83JF9JZ6JMGRJV"),
    ).toBeInTheDocument();

    // Apply is disabled until a dry-run preview has been seen.
    const apply = screen.getByRole("button", { name: "Apply gc" });
    expect(apply).toBeDisabled();

    await user.click(screen.getByRole("button", { name: "Preview gc" }));
    expect(
      await screen.findByText(/1 item\(s\) would be deleted/),
    ).toBeInTheDocument();
    expect(screen.getByText(/1 pinned item\(s\) skipped/)).toBeInTheDocument();
    expect(apply).toBeEnabled();

    await user.click(apply);
    expect(await screen.findByText(/GC deleted 1 item\(s\)/)).toBeInTheDocument();
  });

  it("renders the error envelope on failure", async () => {
    server.use(http.get("/api/storage/stats", () => errorResponse(500)));
    renderRoute("/storage");
    expect(await screen.findByText("ProjectNotFound")).toBeInTheDocument();
  });
});
