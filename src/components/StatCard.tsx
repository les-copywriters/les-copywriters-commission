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
  const a = accentMap[accent] || accentMap.blue;
  const TrendIcon = trend === "up" ? TrendingUp : trend === "down" ? TrendingDown : Minus;

  return (
    <div className={cn(
      "group relative overflow-hidden rounded-3xl bg-background border border-border/50 p-6 shadow-premium transition-all duration-500",
      "hover:-translate-y-2 hover:shadow-[0_22px_44px_-12px_rgba(0,0,0,0.12)]"
    )}>
      {/* Subtle Background Glow */}
      <div className={cn("absolute -right-8 -top-8 h-24 w-24 rounded-full blur-[40px] opacity-[0.08] transition-opacity group-hover:opacity-20", a.bar)} />

      <div className="relative z-10 flex flex-col h-full justify-between gap-4">
         <div className="flex items-start justify-between">
           <div className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl shadow-sm transition-transform group-hover:scale-110", a.bg, a.text)}>
             {icon}
           </div>
           {trend && (
             <div className={cn(
               "flex items-center justify-center h-7 w-7 rounded-full",
               trend === "up" && "bg-emerald-500/10 text-emerald-500",
               trend === "down" && "bg-rose-500/10 text-rose-500",
               trend === "neutral" && "bg-muted/20 text-muted-foreground"
             )}>
               <TrendIcon className="h-3.5 w-3.5" />
             </div>
           )}
         </div>

         <div className="space-y-1">
            <p className="text-xs font-medium text-muted-foreground/70 leading-none">
              {title}
            </p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl font-bold tracking-tight tabular-nums truncate">{value}</p>
            </div>
            {subtitle && (
              <p className="text-xs text-muted-foreground/50 truncate">
                {subtitle}
              </p>
            )}
         </div>
      </div>
      
      {/* Activity Indicator Bar */}
      <div className={cn("absolute bottom-0 left-6 right-6 h-1 rounded-t-full opacity-0 translate-y-2 transition-all group-hover:opacity-100 group-hover:translate-y-0", a.bar)} />
    </div>
  );
};

export default StatCard;
