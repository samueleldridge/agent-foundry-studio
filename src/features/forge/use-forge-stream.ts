/**
 * useForgeStream — live forge SSE subscription. Terminal frames
 * (`forge.terminated` / `forge.failed`) close the stream and invalidate
 * the forge queries so history tables catch up.
 */
import { useQueryClient } from "@tanstack/react-query";
import { useSSE, type SSEEvent } from "@/api/sse";

export const FORGE_TERMINAL = ["forge.terminated", "forge.failed"] as const;

export function useForgeStream(forgeRunId: string, live: boolean) {
  const queryClient = useQueryClient();
  return useSSE(live ? `/api/forge/${forgeRunId}/events` : null, {
    terminalEvents: FORGE_TERMINAL,
    onEvent: (event: SSEEvent) => {
      if ((FORGE_TERMINAL as readonly string[]).includes(event.event)) {
        void queryClient.invalidateQueries({ queryKey: ["forge"] });
      }
    },
  });
}
