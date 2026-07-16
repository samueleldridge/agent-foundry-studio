import { describe, expect, it } from "vitest";
import { screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http } from "msw";
import { server } from "./msw/server";
import { errorResponse } from "./msw/handlers";
import { renderRoute } from "./utils";

describe("evals", () => {
  it("renders eval history with score and pass state", async () => {
    renderRoute("/projects/hello/evals");
    expect(await screen.findByText("hello_greeting")).toBeInTheDocument();
    expect(screen.getByText("passed")).toBeInTheDocument();
    expect(screen.getByText("01KXEPMRYRK96J6V51AHVV8W9F")).toBeInTheDocument();
  });

  it("launches an eval as a background task", async () => {
    const user = userEvent.setup();
    renderRoute("/projects/hello/evals");
    await screen.findByText("hello_greeting");

    await user.click(screen.getAllByRole("button", { name: /Run eval/ })[0]!);
    await user.click(screen.getByRole("button", { name: "Launch" }));

    // Task id + terminal status from the polled task endpoint.
    expect(await screen.findByText("task-123")).toBeInTheDocument();
    expect(await screen.findByText("completed")).toBeInTheDocument();
  });

  it("renders per-case detail for one eval run", async () => {
    renderRoute("/projects/hello/evals/01KXEPMRYRK96J6V51AHVV8W9F");
    expect(await screen.findByText("plain_name")).toBeInTheDocument();
    expect(screen.getByText("5/5 passed")).toBeInTheDocument();
    expect(screen.getByText(/"greeting": "Hello, world!"/)).toBeInTheDocument();
  });

  it("renders the error envelope on failure", async () => {
    server.use(http.get("/api/evals", () => errorResponse(500)));
    renderRoute("/projects/hello/evals");
    expect(await screen.findByText("ProjectNotFound")).toBeInTheDocument();
  });
});
