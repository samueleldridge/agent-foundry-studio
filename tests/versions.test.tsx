import { describe, expect, it } from "vitest";
import { screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { server } from "./msw/server";
import { errorResponse } from "./msw/handlers";
import { renderRoute } from "./utils";

describe("versions", () => {
  it("renders commits and per-artifact pins", async () => {
    renderRoute("/projects/hello/versions");
    expect(
      await screen.findByText("revert(examples): restore anthropic default"),
    ).toBeInTheDocument();
    expect(screen.getByText("04221820")).toBeInTheDocument();
    // Pinned tool at v1 with v2 available for rollback.
    expect(screen.getByText("get_time")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "Roll get_time to v2" }),
    ).toBeInTheDocument();
  });

  it("walks the dry-run-first rollback flow", async () => {
    const user = userEvent.setup();
    renderRoute("/projects/hello/versions");
    await user.click(
      await screen.findByRole("button", { name: "Roll get_time to v2" }),
    );

    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText(/Rollback get_time → v2/)).toBeInTheDocument();

    // Confirm is disabled until a dry-run plan exists.
    const confirm = within(dialog).getByRole("button", {
      name: "Confirm rollback",
    });
    expect(confirm).toBeDisabled();

    await user.click(within(dialog).getByRole("button", { name: "Dry run" }));
    expect(
      await within(dialog).findByText(/pin get_time: v1 -> v2/),
    ).toBeInTheDocument();
    expect(within(dialog).getByText("clean_tree")).toBeInTheDocument();

    await user.click(confirm);
    expect(
      await screen.findByText(/Rolled back — commit feedc0de/),
    ).toBeInTheDocument();
  });

  it("renders the error envelope on failure", async () => {
    server.use(http.get("/api/projects/hello/versions", () => errorResponse(500)));
    renderRoute("/projects/hello/versions");
    expect(await screen.findByText("ProjectNotFound")).toBeInTheDocument();
  });
});
