import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useSales } from "@/hooks/useSales";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/formatCurrency";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight } from "lucide-react";

interface Props {
  personId?: string | null;
  personName?: string | null;
  role: "closer" | "setter";
}

const ProfileTag = ({ personId, personName, role }: Props) => {
  const { t, locale } = useLanguage();
  const { user } = useAuth();
  const isAdmin = user?.role === "admin";
  const { data: allSales = [] } = useSales();

  if (!personName || !personId) {
    return <span className="text-muted-foreground text-sm">—</span>;
  }

  const initials = personName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  // eslint-disable-next-line react-hooks/rules-of-hooks
  const stats = useMemo(() => {
    if (!isAdmin) return null;
    const mine = allSales.filter((s) =>
      role === "setter" ? s.setterId === personId : s.closerId === personId
    );
    const validated = mine.filter((s) => !s.refunded && !s.impaye);
    return {
      total:      mine.length,
      validated:  validated.length,
      commission: validated.reduce(
        (a, s) => a + (role === "setter" ? s.setterCommission : s.closerCommission),
        0
      ),
      refunds: mine.filter((s) => s.refunded).length,
      impayes: mine.filter((s) => s.impaye).length,
    };
  }, [allSales, personId, role, isAdmin]);

  const profilePath =
    role === "setter"
      ? `/team/setter/${encodeURIComponent(personName)}`
      : `/team/closer/${encodeURIComponent(personName)}`;

  const avatarClass =
    role === "setter"
      ? "bg-warning/20 text-warning"
      : "bg-primary/20 text-primary";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="text-sm font-medium hover:text-primary underline-offset-2 hover:underline transition-colors cursor-pointer">
          {personName}
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-56 p-0 overflow-hidden shadow-md" align="start" side="top">
        {/* Header — visible to everyone */}
        <div className="flex items-center gap-2.5 px-3 py-3 bg-muted/50">
          <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-bold ${avatarClass}`}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold leading-tight truncate">{personName}</p>
            <Badge variant="outline" className="text-[10px] px-1.5 py-0 mt-0.5">
              {t(`role.${role}`)}
            </Badge>
          </div>
        </div>

        {/* Stats + link — admin only */}
        {isAdmin && stats && (
          <>
            <Separator />

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

            <div className="px-3 py-2">
              <Link
                to={profilePath}
                className="flex items-center justify-between text-xs text-primary hover:underline font-medium"
              >
                {t("setter.viewProfile")}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          </>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default ProfileTag;
