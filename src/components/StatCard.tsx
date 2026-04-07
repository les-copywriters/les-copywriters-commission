import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  trend?: "up" | "down" | "neutral";
  accent?: "blue" | "green" | "red" | "orange";
};

const accentMap = {
  blue:   { bg: "bg-primary/10 dark:bg-primary/20",  text: "text-primary",      bar: "bg-primary"      },
  green:  { bg: "bg-success/10 dark:bg-success/20",  text: "text-success",      bar: "bg-success"      },
  red:    { bg: "bg-destructive/10 dark:bg-destructive/20", text: "text-destructive", bar: "bg-destructive" },
  orange: { bg: "bg-warning/10 dark:bg-warning/20",  text: "text-warning",      bar: "bg-warning"      },
};

/** KPI stat card used on the dashboard */
const StatCard = ({ title, value, subtitle, icon, trend, accent = "blue" }: Props) => {
  const a = accentMap[accent];
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className={cn(
      "relative overflow-hidden rounded-xl bg-card border border-border/60 p-5 shadow-card",
      "transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card-md"
    )}>
      {/* Accent bar */}
      <div className={cn("absolute left-0 top-0 h-full w-1 rounded-l-xl", a.bar)} />

      <div className="flex items-start justify-between gap-3 pl-2">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground truncate">
            {title}
          </p>
          <p className="mt-2 text-2xl font-bold tracking-tight truncate">{value}</p>
          {subtitle && (
            <div className="mt-1.5 flex items-center gap-1">
              <TrendIcon className={cn(
                "h-3 w-3 shrink-0",
                trend === "up" && "text-success",
                trend === "down" && "text-destructive",
                (!trend || trend === "neutral") && "text-muted-foreground"
              )} />
              <p className={cn(
                "text-xs truncate",
                trend === "up" && "text-success",
                trend === "down" && "text-destructive",
                (!trend || trend === "neutral") && "text-muted-foreground"
              )}>
                {subtitle}
              </p>
            </div>
          )}
        </div>
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", a.bg, a.text)}>
          {icon}
        </div>
      </div>
    </div>
  );
};

export default StatCard;
