/**
 * Diagnostic mapping: 1-based server line/column → CodeMirror offsets.
 */
import { describe, expect, it } from "vitest";
import { EditorState } from "@codemirror/state";
import { issuesToDiagnostics } from "@/components/CodeEditor";

const doc = "name: hello_agent\nmodel_binding:\n  provider: anthropc\n";

describe("issuesToDiagnostics", () => {
  it("maps line/column onto document offsets", () => {
    const state = EditorState.create({ doc });
    const [diag] = issuesToDiagnostics(state, [
      {
        severity: "error",
        message: "unknown provider 'anthropc'",
        pointer: "/model_binding/provider",
        line: 3,
        column: 13,
        hint: "did you mean 'anthropic'?",
      },
    ]);
    expect(diag).toBeDefined();
    // Line 3 starts after "name: hello_agent\nmodel_binding:\n" (33 chars).
    expect(diag!.from).toBe(33 + 12);
    expect(diag!.to).toBeGreaterThan(diag!.from);
    expect(diag!.severity).toBe("error");
    expect(diag!.message).toContain("unknown provider");
    expect(diag!.message).toContain("did you mean 'anthropic'?");
    expect(diag!.source).toBe("/model_binding/provider");
  });

  it("clamps out-of-range lines instead of throwing", () => {
    const state = EditorState.create({ doc: "one line" });
    const [diag] = issuesToDiagnostics(state, [
      { severity: "warning", message: "m", pointer: null, line: 99, column: 5, hint: null },
    ]);
    expect(diag!.from).toBeLessThanOrEqual(state.doc.length);
    expect(diag!.severity).toBe("warning");
  });

  it("defaults missing line/column to the document start", () => {
    const state = EditorState.create({ doc });
    const [diag] = issuesToDiagnostics(state, [
      { severity: "error", message: "m", pointer: null, line: null, column: null, hint: null },
    ]);
    expect(diag!.from).toBe(0);
  });
});
