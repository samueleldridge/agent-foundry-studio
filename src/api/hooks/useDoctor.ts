import { useQuery } from "@tanstack/react-query";
import { apiGet } from "../client";
import type { DoctorReport } from "../types";

export function useDoctor() {
  return useQuery({
    queryKey: ["doctor"],
    queryFn: () => apiGet<DoctorReport>("/api/doctor"),
    // Doctor runs the whole check suite — fetch on demand, not on a poll.
    staleTime: Infinity,
  });
}
