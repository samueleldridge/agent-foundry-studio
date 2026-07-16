/**
 * Run detail — the event timeline attaches to `GET /runs/{id}/events`
 * (SSE replay of persisted events; live runs keep streaming) and closes
 * on the terminal frame.
 */
import { describe, expect, it } from "vitest";
import { act, screen, waitFor } from "@testing-library/react";
import { renderRoute } from "./utils";
import { MockEventSource } from "./mock-event-source";
import { runs } from "./msw/fixtures";

const RUN_ID = runs[0]!.run_id;

describe("run detail events", () => {
  it("replays the persisted event stream into the timeline", async () => {
    renderRoute(`/projects/hello/runs/${RUN_ID}`);
    await screen.findByText("Run detail");

    const stream = await waitFor(() => {
      const s = MockEventSource.latestFor(`/api/runs/${RUN_ID}/events`);
      expect(s).toBeDefined();
      return s!;
    });

    act(() => {
      stream.emit("run.started", { run_id: RUN_ID, sequence: 0 }, "0");
      stream.emit(
        "tool.completed",
        { run_id: RUN_ID, tool_ref: "get_time", success: true },
        "1",
      );
      stream.emit("run.completed", { run_id: RUN_ID, status: "success" }, "2");
    });

    expect(screen.getByText("run.started")).toBeInTheDocument();
    expect(screen.getByText("tool.completed")).toBeInTheDocument();
    expect(screen.getByText("run.completed")).toBeInTheDocument();
    // Terminal frame closes the client stream (no endless replay loop).
    expect(stream.closed).toBe(true);
  });
});
