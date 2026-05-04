import { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { TrendingUp, TrendingDown } from "lucide-react";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  icon?: ReactNode;
  trend?: "up" | "down" | "neutral";
  accent?: "blue" | "green" | "red" | "orange";
};

const accentMap = {
  blue:   { icon: "bg-primary/10 text-primary",          trend: "text-primary"      },
  green:  { icon: "bg-emerald-500/10 text-emerald-600",  trend: "text-emerald-600"  },
  red:    { icon: "bg-rose-500/10 text-rose-600",        trend: "text-rose-600"     },
  orange: { icon: "bg-amber-500/10 text-amber-600",      trend: "text-amber-600"    },
};

const StatCard = ({ title, value, subtitle, icon, trend, accent = "blue" }: Props) => {
  const a = accentMap[accent] ?? accentMap.blue;
  const TrendIcon = trend === "up" ? TrendingUp : TrendingDown;

  return (
    <div className="rounded-lg border border-border/40 bg-background p-3 space-y-2">
      <div className="flex items-center justify-between gap-2">
        {icon && (
          <div className={cn("h-7 w-7 rounded-md flex items-center justify-center shrink-0", a.icon)}>
            {icon}
          </div>
        )}
        {trend && trend !== "neutral" && (
          <TrendIcon className={cn("h-3.5 w-3.5 ml-auto", a.trend)} />
        )}
      </div>
      <div>
        <p className="text-[11px] text-muted-foreground">{title}</p>
        <p className="text-xl font-semibold tabular-nums leading-tight">{value}</p>
        {subtitle && <p className="text-[11px] text-muted-foreground/60 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
};

export default StatCard;
