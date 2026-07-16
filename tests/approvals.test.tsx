/**
 * Approvals inbox — cross-project pending list; approve / reject-with-
 * reason resolve via POST /runs/{id}/resume (the same resolution path the
 * in-chat card uses, so both surfaces stay consistent).
 */
import { describe, expect, it } from "vitest";
import { screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { http, HttpResponse } from "msw";
import { server } from "./msw/server";
import { renderRoute } from "./utils";
import { approvalItem } from "./msw/fixtures";

function withPendingApproval() {
  const resumes: { url: string; body: unknown }[] = [];
  server.use(
    http.get("/api/approvals", () => HttpResponse.json([approvalItem])),
    http.post("/api/runs/:runId/resume", async ({ request, params }) => {
      resumes.push({ url: String(params.runId), body: await request.json() });
      return HttpResponse.json({
        run_id: String(params.runId),
        status: "resumed",
        events_url: "",
      });
    }),
  );
  return resumes;
}

describe("approvals inbox", () => {
  it("shows the empty state when nothing is pending", async () => {
    renderRoute("/approvals");
    expect(await screen.findByText("No pending approvals")).toBeInTheDocument();
  });

  it("lists pending approvals with context and a run link", async () => {
    withPendingApproval();
    renderRoute("/approvals");
    expect(
      await screen.findByText("Publish the greeting to the shared channel?"),
    ).toBeInTheDocument();
    expect(screen.getByText("team_hello")).toBeInTheDocument();
    expect(screen.getByText("publisher")).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: approvalItem.run_id }),
    ).toHaveAttribute(
      "href",
      `/projects/team_hello/runs/${approvalItem.run_id}`,
    );
    // Redacted tool context renders for review before deciding.
    expect(screen.getByText(/publish_greeting@v1/)).toBeInTheDocument();
  });

  it("approve resumes the run with an approved ApprovalResponse", async () => {
    const resumes = withPendingApproval();
    const user = userEvent.setup();
    renderRoute("/approvals");
    await user.click(await screen.findByRole("button", { name: "Approve" }));
    await waitFor(() => expect(resumes).toHaveLength(1));
    expect(resumes[0]).toEqual({
      url: approvalItem.run_id,
      body: {
        approval_id: approvalItem.approval_id,
        decision: "approved",
        reason: null,
      },
    });
  });

  it("reject requires a reason before it can resume the run", async () => {
    const resumes = withPendingApproval();
    const user = userEvent.setup();
    renderRoute("/approvals");
    await user.click(await screen.findByRole("button", { name: "Reject…" }));
    const confirm = screen.getByRole("button", { name: "Confirm reject" });
    expect(confirm).toBeDisabled();
    await user.type(
      screen.getByRole("textbox", { name: /Rejection reason/ }),
      "needs a second draft",
    );
    await user.click(confirm);
    await waitFor(() => expect(resumes).toHaveLength(1));
    expect(resumes[0]!.body).toEqual({
      approval_id: approvalItem.approval_id,
      decision: "rejected",
      reason: "needs a second draft",
    });
  });
});
