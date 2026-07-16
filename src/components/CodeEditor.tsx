/**
 * CodeMirror 6 wrapper: yaml / markdown / python modes with external
 * (server-produced) diagnostics rendered as inline lint markers.
 * The editor performs NO validation of its own — diagnostics arrive from
 * the studio validate round-trip (docs/72 § Config-editing UX).
 */
import { useEffect, useMemo, useRef } from "react";
import { EditorState, Compartment, type Extension } from "@codemirror/state";
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  highlightActiveLineGutter,
  drawSelection,
} from "@codemirror/view";
import {
  defaultKeymap,
  history,
  historyKeymap,
  indentWithTab,
} from "@codemirror/commands";
import {
  defaultHighlightStyle,
  syntaxHighlighting,
  indentOnInput,
  bracketMatching,
} from "@codemirror/language";
import { setDiagnostics, lintGutter, type Diagnostic } from "@codemirror/lint";
import { yaml } from "@codemirror/lang-yaml";
import { markdown } from "@codemirror/lang-markdown";
import { python } from "@codemirror/lang-python";
import type { ValidationIssue } from "@/api/types";

export type EditorLanguage = "yaml" | "markdown" | "python" | "text";

interface CodeEditorProps {
  value: string;
  language: EditorLanguage;
  onChange?: (value: string) => void;
  readOnly?: boolean;
  issues?: ValidationIssue[];
  className?: string;
  "aria-label"?: string;
}

function languageExtension(language: EditorLanguage): Extension {
  switch (language) {
    case "yaml":
      return yaml();
    case "markdown":
      return markdown();
    case "python":
      return python();
    case "text":
      return [];
  }
}

/** Map a 1-based line/column ValidationIssue onto document offsets. */
export function issuesToDiagnostics(
  state: EditorState,
  issues: ValidationIssue[],
): Diagnostic[] {
  const diagnostics: Diagnostic[] = [];
  for (const issue of issues) {
    const lineNumber = Math.min(
      Math.max(issue.line ?? 1, 1),
      state.doc.lines,
    );
    const line = state.doc.line(lineNumber);
    const column = Math.max((issue.column ?? 1) - 1, 0);
    const from = Math.min(line.from + column, line.to);
    const to = line.to > from ? line.to : Math.min(from + 1, state.doc.length);
    diagnostics.push({
      from,
      to,
      severity: issue.severity === "warning" ? "warning" : "error",
      message: issue.hint ? `${issue.message}\n${issue.hint}` : issue.message,
      source: issue.pointer ?? undefined,
    });
  }
  return diagnostics;
}

export function CodeEditor({
  value,
  language,
  onChange,
  readOnly = false,
  issues = [],
  className,
  "aria-label": ariaLabel,
}: CodeEditorProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const viewRef = useRef<EditorView | null>(null);
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const compartments = useMemo(
    () => ({ language: new Compartment(), readOnly: new Compartment() }),
    [],
  );

  // Create the view once per mount.
  useEffect(() => {
    if (!containerRef.current) return;
    const state = EditorState.create({
      doc: value,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        highlightActiveLineGutter(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        syntaxHighlighting(defaultHighlightStyle, { fallback: true }),
        keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
        lintGutter(),
        compartments.language.of(languageExtension(language)),
        compartments.readOnly.of(EditorState.readOnly.of(readOnly)),
        EditorView.updateListener.of((update) => {
          if (update.docChanged) {
            onChangeRef.current?.(update.state.doc.toString());
          }
        }),
      ],
    });
    const view = new EditorView({ state, parent: containerRef.current });
    if (ariaLabel) {
      view.contentDOM.setAttribute("aria-label", ariaLabel);
    }
    viewRef.current = view;
    return () => {
      view.destroy();
      viewRef.current = null;
    };
    // Mount-only: language/readOnly/value updates are dispatched below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // External value replacement (e.g. switching files).
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    const current = view.state.doc.toString();
    if (current !== value) {
      view.dispatch({
        changes: { from: 0, to: current.length, insert: value },
      });
    }
  }, [value]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.language.reconfigure(languageExtension(language)),
    });
  }, [language, compartments]);

  useEffect(() => {
    viewRef.current?.dispatch({
      effects: compartments.readOnly.reconfigure(
        EditorState.readOnly.of(readOnly),
      ),
    });
  }, [readOnly, compartments]);

  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    view.dispatch(
      setDiagnostics(view.state, issuesToDiagnostics(view.state, issues)),
    );
  }, [issues, value]);

  return <div ref={containerRef} className={className} data-slot="code-editor" />;
}
