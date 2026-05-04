import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useSales } from "@/hooks/useSales";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/formatCurrency";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";
import { ArrowUpRight, User as UserIcon } from "lucide-react";
import { cn } from "@/lib/utils";

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

  const stats = useMemo(() => {
    if (!isAdmin || !personId) return null;
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

  if (!personName || !personId) {
    return <span className="text-muted-foreground text-xs">—</span>;
  }

  const initials = personName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);

  const profilePath =
    role === "setter"
      ? `/team/setter/${encodeURIComponent(personName)}`
      : `/team/closer/${encodeURIComponent(personName)}`;

  const avatarClass = role === "closer"
    ? "bg-primary/10 text-primary"
    : "bg-emerald-500/10 text-emerald-600";

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="group flex items-center gap-2 text-xs font-medium transition-colors hover:text-primary">
          <div className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-[10px] font-semibold",
            avatarClass
          )}>
            {initials}
          </div>
          <span className="group-hover:text-primary transition-colors">{personName}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent
        className="w-64 p-0 overflow-hidden rounded-xl border border-border/40 bg-background shadow-md"
        align="start"
        side="top"
        sideOffset={8}
      >
        {/* Header */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border/40 bg-muted/30">
          <div className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold",
            avatarClass
          )}>
            {initials}
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold truncate">{personName}</p>
            <span className={cn(
              "inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-medium mt-0.5",
              role === "closer"
                ? "bg-primary/10 text-primary border-primary/20"
                : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
            )}>
              {t(`role.${role}`)}
            </span>
          </div>
        </div>

        <div className="p-4 space-y-3">
          {isAdmin && stats ? (
            <>
              {/* Stats grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{t("detail.totalSales")}</p>
                  <p className="text-base font-semibold tabular-nums mt-0.5">{stats.total}</p>
                </div>
                <div className="rounded-lg bg-muted/50 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">Validated</p>
                  <p className="text-base font-semibold tabular-nums text-emerald-600 mt-0.5">{stats.validated}</p>
                </div>
              </div>

              {/* Commission */}
              <div className="rounded-lg bg-muted/50 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Estimated revenue</p>
                <p className="text-lg font-semibold text-primary tabular-nums mt-0.5">
                  {formatCurrency(stats.commission, locale)}
                </p>
              </div>

              {/* Refunds/Unpaid — only shown when non-zero */}
              {(stats.refunds > 0 || stats.impayes > 0) && (
                <div className="rounded-lg bg-rose-500/5 border border-rose-500/15 px-3 py-2">
                  <p className="text-[11px] text-muted-foreground">{t("detail.refundsUnpaid")}</p>
                  <p className="text-sm font-medium text-rose-600 mt-0.5">
                    {stats.refunds} refunds · {stats.impayes} unpaid
                  </p>
                </div>
              )}

              <Separator className="bg-border/40" />

              <Link
                to={profilePath}
                className="flex items-center justify-between text-xs font-medium text-primary hover:text-primary/80 transition-colors"
              >
                {t("setter.viewProfile")}
                <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </>
          ) : (
            <div className="flex items-center gap-2 py-2 text-xs text-muted-foreground">
              <UserIcon className="h-3.5 w-3.5" />
              Profile details visible to admins only
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ProfileTag;
