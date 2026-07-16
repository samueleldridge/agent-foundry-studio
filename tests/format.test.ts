import { describe, expect, it } from "vitest";
import {
  formatBytes,
  formatCost,
  formatDuration,
  formatRelativeTime,
  formatScore,
  formatTokens,
} from "@/lib/format";

describe("shared formatters", () => {
  it("formats USD cost with 4dp under $1 and 2dp above", () => {
    expect(formatCost(0.00017865)).toBe("$0.0002");
    expect(formatCost(0.2324)).toBe("$0.2324");
    expect(formatCost(12.5)).toBe("$12.50");
    expect(formatCost(0)).toBe("$0.00");
    expect(formatCost(null)).toBe("—");
  });

  it("formats token counts", () => {
    expect(formatTokens(1068)).toBe("1,068");
    expect(formatTokens(1_240_000)).toBe("1.2M");
    expect(formatTokens(null)).toBe("—");
  });

  it("formats durations across magnitudes", () => {
    expect(formatDuration(850)).toBe("850ms");
    expect(formatDuration(2263)).toBe("2.3s");
    expect(formatDuration(252_000)).toBe("4m 12s");
    expect(formatDuration(3_840_000)).toBe("1h 04m");
    expect(formatDuration(null)).toBe("—");
  });

  it("formats relative timestamps", () => {
    const now = new Date("2026-07-15T12:00:00Z");
    expect(formatRelativeTime("2026-07-15T11:59:50Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-07-15T11:56:00Z", now)).toBe("4m ago");
    expect(formatRelativeTime("2026-07-15T09:00:00Z", now)).toBe("3h ago");
    expect(formatRelativeTime("2026-07-13T12:00:00Z", now)).toBe("2d ago");
    expect(formatRelativeTime(null, now)).toBe("—");
    expect(formatRelativeTime("not-a-date", now)).toBe("—");
  });

  it("formats bytes and scores", () => {
    expect(formatBytes(4601088)).toBe("4.4 MB");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatScore(0.925)).toBe("0.93");
    expect(formatScore(null)).toBe("—");
  });
});
