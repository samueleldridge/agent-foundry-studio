/**
 * Structured FoundryError envelope renderer with a copy-details affordance —
 * the UI mirror of the CLI's structured-error principle. Never a blank crash.
 */
import { AlertTriangleIcon, CopyIcon } from "lucide-react";
import { toast } from "sonner";
import { ApiError } from "@/api/client";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ErrorStateProps {
  error: unknown;
  title?: string;
  className?: string;
}

export function ErrorState({ error, title, className }: ErrorStateProps) {
  const isApi = error instanceof ApiError;
  const errorClass = isApi ? error.envelope.error_class : "UnexpectedError";
  const message =
    error instanceof Error ? error.message : String(error ?? "Unknown error");
  const context = isApi ? error.envelope.context : {};
  const hasContext = Object.keys(context).length > 0;

  const copyDetails = () => {
    const details = JSON.stringify(
      { error_class: errorClass, message, context },
      null,
      2,
    );
    void navigator.clipboard
      .writeText(details)
      .then(() => toast.success("Error details copied"));
  };

  return (
    <Alert variant="destructive" className={cn(className)} data-slot="error-state">
      <AlertTriangleIcon aria-hidden />
      <div>
        <AlertTitle className="flex items-center gap-2">
          {title ?? "Request failed"}
          <span className="rounded bg-fail/15 px-1.5 py-0.5 font-mono text-[11px]">
            {errorClass}
          </span>
        </AlertTitle>
        <AlertDescription>
          <p className="whitespace-pre-wrap break-words">{message}</p>
          {hasContext && (
            <pre className="mt-2 max-h-40 overflow-auto rounded bg-fail/5 p-2 font-mono text-[11px]">
              {JSON.stringify(context, null, 2)}
            </pre>
          )}
          <Button
            variant="outline"
            size="sm"
            className="mt-2 border-fail/40 text-fail hover:bg-fail/10 hover:text-fail"
            onClick={copyDetails}
          >
            <CopyIcon aria-hidden /> Copy details
          </Button>
        </AlertDescription>
      </div>
    </Alert>
  );
}
