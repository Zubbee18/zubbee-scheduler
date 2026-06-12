import {
  createContext,
  useCallback,
  useContext,
  useState,
  ReactNode,
} from "react";
import type { Job } from "../api";

interface JobDrawerCtx {
  openJobId: number | null;
  openJob: (id: number) => void;
  closeJob: () => void;
}

const JobDrawerContext = createContext<JobDrawerCtx>({
  openJobId: null,
  openJob: () => {},
  closeJob: () => {},
});

export function useJobDrawer() {
  return useContext(JobDrawerContext);
}

export function JobDrawerProvider({ children }: { children: ReactNode }) {
  const [openJobId, setOpenJobId] = useState<number | null>(null);

  const openJob = useCallback((id: number) => setOpenJobId(id), []);
  const closeJob = useCallback(() => setOpenJobId(null), []);

  return (
    <JobDrawerContext.Provider value={{ openJobId, openJob, closeJob }}>
      {children}
    </JobDrawerContext.Provider>
  );
}
