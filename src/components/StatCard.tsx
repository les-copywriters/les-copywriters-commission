import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

type Props = {
  title: string;
  value: string;
  subtitle?: string;
  icon: ReactNode;
  trend?: "up" | "down" | "neutral";
};

/** KPI stat card used on the dashboard */
const StatCard = ({ title, value, subtitle, icon, trend }: Props) => (
  <Card className="border-0 shadow-sm">
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-accent/10 text-accent">
        {icon}
      </div>
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {subtitle && (
        <p className={cn(
          "mt-1 text-xs",
          trend === "up" && "text-success",
          trend === "down" && "text-destructive",
          (!trend || trend === "neutral") && "text-muted-foreground"
        )}>
          {subtitle}
        </p>
      )}
    </CardContent>
  </Card>
);

export default StatCard;
