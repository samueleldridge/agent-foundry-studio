/**
 * Schema-aware chat composer (docs/72 § Chat UX). The project input model
 * rides on ChatSessionInfo.input_fields:
 *
 * - one required field → the plain message box (placeholder names the
 *   field; the backend auto-wraps the text);
 * - two-plus required fields → a compact per-field form (text inputs for
 *   strings, JSON-ish inputs for other types) assembling the input object
 *   client-side, with an "edit as JSON" toggle for power users.
 *
 * Nobody is told to hand-write JSON.
 */
import { useState } from "react";
import { BracesIcon, ListIcon, LoaderIcon, SendIcon } from "lucide-react";
import { ApiError } from "@/api/client";
import type { ChatInputField, ChatSessionInfo } from "@/api/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

function jsonPlaceholder(type: string): unknown {
  switch (type) {
    case "boolean":
      return false;
    case "integer":
    case "number":
      return 0;
    case "array":
      return [];
    case "object":
      return {};
    default:
      return "";
  }
}

function templateFor(fields: ChatInputField[]): string {
  return JSON.stringify(
    Object.fromEntries(
      fields
        .filter((f) => f.required)
        .map((f) => [f.name, jsonPlaceholder(f.type)]),
    ),
    null,
    2,
  );
}

/** Form values → the input object; returns a per-field error message for
 * non-string fields whose value isn't valid JSON. */
function assemble(
  fields: ChatInputField[],
  values: Record<string, string>,
): { input?: Record<string, unknown>; error?: string } {
  const input: Record<string, unknown> = {};
  for (const field of fields) {
    const raw = values[field.name] ?? "";
    if (raw.trim() === "") {
      if (field.required) return { error: `${field.name} is required` };
      continue;
    }
    if (field.type === "string") {
      input[field.name] = raw;
    } else {
      try {
        input[field.name] = JSON.parse(raw) as unknown;
      } catch {
        return {
          error: `${field.name}: enter valid JSON for a ${field.type} field`,
        };
      }
    }
  }
  return { input };
}

export interface ChatComposerProps {
  session: ChatSessionInfo;
  pending: boolean;
  disabled?: boolean;
  compact?: boolean;
  error?: unknown;
  onSend: (text: string) => void;
}

export function ChatComposer({
  session,
  pending,
  disabled = false,
  compact = false,
  error,
  onSend,
}: ChatComposerProps) {
  const fields = session.input_fields ?? [];
  const required = fields.filter((f) => f.required);
  const formShaped = required.length >= 2;

  const [jsonMode, setJsonMode] = useState(false);
  const [draft, setDraft] = useState("");
  const [values, setValues] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);

  const useForm = formShaped && !jsonMode;
  const canSend =
    !disabled &&
    !pending &&
    (useForm
      ? required.every((f) => (values[f.name] ?? "").trim() !== "")
      : draft.trim() !== "");

  const submit = () => {
    if (disabled || pending) return;
    if (useForm) {
      const { input, error: assembleError } = assemble(fields, values);
      if (assembleError || !input) {
        setFormError(assembleError ?? "invalid input");
        return;
      }
      setFormError(null);
      onSend(JSON.stringify(input));
      setValues({});
      return;
    }
    if (draft.trim() === "") return;
    onSend(draft);
    setDraft("");
  };

  const toggleJson = () => {
    if (!jsonMode) {
      const { input } = assemble(fields, values);
      const filled = input && Object.keys(input).length > 0;
      setDraft(
        filled ? JSON.stringify(input, null, 2) : templateFor(fields),
      );
      setFormError(null);
      setJsonMode(true);
      return;
    }
    // JSON → form: carry the edits back into the per-field values. An
    // unparsable draft keeps you in JSON mode with an inline error —
    // "Back to form" must never silently discard edits.
    if (draft.trim() !== "") {
      let parsed: unknown;
      try {
        parsed = JSON.parse(draft);
      } catch {
        setFormError(
          "The JSON is invalid — fix it (or clear the box) before going back to the form.",
        );
        return;
      }
      if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
        setFormError(
          "The JSON must be an object with the input fields — fix it before going back to the form.",
        );
        return;
      }
      const rec = parsed as Record<string, unknown>;
      const next: Record<string, string> = {};
      for (const field of fields) {
        const v = rec[field.name];
        if (v === undefined) continue;
        next[field.name] =
          field.type === "string" && typeof v === "string"
            ? v
            : JSON.stringify(v);
      }
      setValues(next);
    }
    setFormError(null);
    setJsonMode(false);
  };

  // Send failure (e.g. raw-API-shaped validation): show the structured
  // message; the backend's ready-to-fill template is one click away.
  const sendError = error;
  const templateFromError =
    sendError instanceof ApiError && sendError.envelope.context.template
      ? JSON.stringify(sendError.envelope.context.template, null, 2)
      : null;

  const placeholder =
    required.length === 1
      ? `${required[0]!.name}… (Enter to send)`
      : session.multi_turn
        ? "Message… (Enter to send)"
        : "Message… (single-turn: each message is an independent run)";

  return (
    <div data-slot="chat-composer">
      {sendError != null && (
        <div className="mb-2 rounded-md border border-fail/40 bg-fail/5 px-2.5 py-1.5 text-xs text-fail">
          {sendError instanceof ApiError
            ? sendError.envelope.message
            : String(sendError)}
          {templateFromError && (
            <Button
              size="sm"
              variant="outline"
              className="ml-2 h-6"
              onClick={() => {
                setJsonMode(true);
                setDraft(templateFromError);
              }}
            >
              Insert input template
            </Button>
          )}
        </div>
      )}
      {formError && (
        <p className="mb-2 text-xs text-fail" data-slot="composer-form-error">
          {formError}
        </p>
      )}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        className={useForm ? "space-y-1.5" : "flex items-end gap-2"}
      >
        {useForm ? (
          <>
            {fields.map((field) => (
              <div key={field.name} className="flex items-center gap-2">
                <label
                  htmlFor={`chat-field-${field.name}`}
                  className="w-24 shrink-0 truncate text-right font-mono text-xs text-muted-foreground"
                >
                  {field.name}
                </label>
                <Input
                  id={`chat-field-${field.name}`}
                  value={values[field.name] ?? ""}
                  onChange={(e) =>
                    setValues((prev) => ({
                      ...prev,
                      [field.name]: e.target.value,
                    }))
                  }
                  placeholder={
                    field.type === "string"
                      ? field.required
                        ? field.name
                        : `${field.name} (optional)`
                      : `${field.type} as JSON${field.required ? "" : " (optional)"}`
                  }
                  disabled={disabled}
                  className="h-8 flex-1 text-sm"
                  aria-label={field.name}
                />
              </div>
            ))}
          </>
        ) : jsonMode ? (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            placeholder="Input object as JSON"
            rows={compact ? 3 : 5}
            disabled={disabled}
            className="min-h-9 flex-1 resize-none font-mono text-xs"
            aria-label="Chat message JSON"
          />
        ) : (
          <Textarea
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                submit();
              }
            }}
            placeholder={placeholder}
            rows={compact ? 1 : 2}
            disabled={disabled}
            className="min-h-9 flex-1 resize-none"
            aria-label="Chat message"
          />
        )}
        <div
          className={
            useForm || jsonMode
              ? "flex items-center justify-end gap-2"
              : "flex items-end gap-2"
          }
        >
          {formShaped && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={toggleJson}
              disabled={disabled}
              aria-label={jsonMode ? "Back to form" : "Edit as JSON"}
            >
              {jsonMode ? (
                <>
                  <ListIcon aria-hidden /> Back to form
                </>
              ) : (
                <>
                  <BracesIcon aria-hidden /> Edit as JSON
                </>
              )}
            </Button>
          )}
          <Button
            type="submit"
            size={useForm || jsonMode ? "sm" : "icon"}
            disabled={!canSend}
            aria-label="Send message"
          >
            {pending ? (
              <LoaderIcon className="animate-spin" aria-hidden />
            ) : (
              <>
                <SendIcon aria-hidden />
                {(useForm || jsonMode) && "Send"}
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
}
