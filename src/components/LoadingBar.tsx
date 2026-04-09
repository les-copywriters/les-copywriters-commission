import { useIsFetching } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

/**
 * Thin top-of-screen progress bar that appears whenever any
 * TanStack Query fetch is in-flight. Zero config — just drop it in layout.
 */
const LoadingBar = () => {
  const fetching = useIsFetching();

  return (
    <div
      className={cn(
        "fixed top-0 left-0 right-0 z-[200] h-[2px] overflow-hidden transition-opacity duration-300",
        fetching > 0 ? "opacity-100" : "opacity-0 pointer-events-none",
      )}
    >
      <div className="h-full w-1/3 rounded-full bg-primary animate-loading-bar" />
    </div>
  );
};

export default LoadingBar;
