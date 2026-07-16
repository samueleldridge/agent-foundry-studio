import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { server } from "./msw/server";
import { errorResponse } from "./msw/handlers";
import { renderRoute } from "./utils";

describe("catalog explorer", () => {
  it("browses kind → artifact → versions → files", async () => {
    const user = userEvent.setup();
    renderRoute("/catalog");

    // Artifact list for the default kind (tools).
    const artifact = await screen.findByRole("button", {
      name: /http_get_json/,
    });
    await user.click(artifact);

    // Versions with metadata (latest auto-selected loads its files).
    expect(await screen.findByText("adds retry")).toBeInTheDocument();
    expect(screen.getByText(/deprecated: superseded by v2/)).toBeInTheDocument();

    // Files of the selected (latest) version, read-only browse.
    expect(
      await screen.findByRole("button", { name: "tool.yaml" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "handler.py" }),
    ).toBeInTheDocument();

    // Promote affordance appears once an artifact is selected.
    expect(screen.getByRole("button", { name: /Promote…/ })).toBeInTheDocument();
  });

  it("renders the error envelope when the catalog fails", async () => {
    server.use(http.get("/api/catalog", () => errorResponse(500)));
    renderRoute("/catalog");
    expect(await screen.findByText("ProjectNotFound")).toBeInTheDocument();
  });
});
