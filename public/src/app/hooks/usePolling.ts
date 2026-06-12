import { useEffect, useRef } from "react";

/**
 * Custom hook for polling a fetch function at a fixed interval.
 * - Pauses when the browser tab is hidden (visibilityState === "hidden")
 * - Resumes and fires immediately when the tab becomes visible again
 * - Cleans up on unmount
 */
export function usePolling(fetchFn: () => void, intervalMs: number) {
  // Use a ref so that the latest fetchFn is always called without needing it
  // in the effect's dependency array (which would restart the interval).
  const fnRef = useRef(fetchFn);
  fnRef.current = fetchFn;

  useEffect(() => {
    const poll = () => {
      if (document.visibilityState !== "hidden") {
        fnRef.current();
      }
    };

    // Fire immediately on mount
    poll();

    const id = setInterval(poll, intervalMs);

    const handleVisibility = () => {
      if (document.visibilityState === "visible") {
        fnRef.current();
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);

    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [intervalMs]);
}
