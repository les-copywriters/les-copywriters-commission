import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useSales } from "@/hooks/useSales";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { ArrowUpRight } from "lucide-react";

interface Props {
  setterId?: string | null;
  setterName?: string | null;
}

/**
 * Renders the setter's name as a clickable chip.
 * On click, a popover appears with all-time stats pulled from the cached sales list.
 */
const SetterTag = ({ setterId, setterName }: Props) => {
  const { t, locale } = useLanguage();
  const { data: allSales = [] } = useSales(); // always cached — zero extra fetches

  // ── No setter ─────────────────────────────────────────────────────────────
  if (!setterName || !setterId) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const initials = setterName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // ── All-time stats from cache ─────────────────────────────────────────────
  // eslint-disable-next-line react-hooks/rules-of-hooks
  const stats = useMemo(() => {
    const mine      = allSales.filter((s) => s.setterId === setterId);
    const validated = mine.filter((s) => !s.refunded && !s.impaye);
    return {
      total:      mine.length,
      validated:  validated.length,
      commission: validated.reduce((a, s) => a + s.setterCommission, 0),
      refunds:    mine.filter((s) => s.refunded).length,
      impayes:    mine.filter((s) => s.impaye).length,
    };
  }, [allSales, setterId]);

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-sm font-medium hover:text-primary underline-offset-2 hover:underline transition-colors cursor-pointer">
          {setterName}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0 overflow-hidden shadow-md" align="start" side="top">
        {/* Header */}
        <div className="flex items-center gap-2.5 px-3 py-3 bg-muted/50">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-warning/20 text-warning text-xs font-bold">
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{setterName}</p>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5">
              {t("role.setter")}
            </Badge>
          </div>
        </div>

        <Separator />

        {/* Stats */}
        <div className="px-3 py-2.5 space-y-1.5 text-xs">
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t("detail.totalSales")}</span>
            <span className="font-semibold tabular-nums">{stats.total}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t("analytics.kpi.salesCount")}</span>
            <span className="font-semibold tabular-nums">{stats.validated}</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-muted-foreground">{t("detail.totalComm")}</span>
            <span className="font-semibold text-success tabular-nums">
              {formatCurrency(stats.commission, locale)}
            </span>
          </div>
          {(stats.refunds > 0 || stats.impayes > 0) && (
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">{t("detail.refundsUnpaid")}</span>
              <span className="font-medium text-destructive tabular-nums">
                {stats.refunds} / {stats.impayes}
              </span>
            </div>
          )}
        </div>

        <Separator />

        {/* Link to detail page */}
        <div className="px-3 py-2">
          <Link
            to={`/team/setter/${encodeURIComponent(setterName)}`}
            className="flex items-center justify-between text-xs text-primary hover:underline font-medium"
          >
            {t("setter.viewProfile")}
            <ArrowUpRight className="h-3 w-3" />
          </Link>
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default SetterTag;
