import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useSales } from "@/hooks/useSales";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { formatCurrency } from "@/lib/formatCurrency";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Badge } from "@/components/ui/badge";
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
    return <span className="text-muted-foreground text-[10px] font-medium italic">—</span>;
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

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button className="group flex items-center gap-2 text-xs font-bold transition-all hover:text-primary active:scale-95">
          <div className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-lg text-[9px] font-black shadow-inner transition-transform group-hover:rotate-6",
            role === "closer" ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-600"
          )}>
            {initials}
          </div>
          <span className="underline-offset-4 group-hover:underline">{personName}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-64 p-0 overflow-hidden shadow-2xl border-none rounded-2xl animate-in fade-in zoom-in-95 duration-200" align="start" side="top" sideOffset={8}>
        <div className="bg-gradient-to-br from-background via-background to-muted/30 p-4">
          <div className="flex items-center gap-3 mb-4">
            <div className={cn(
              "flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-xs font-black shadow-inner",
              role === "closer" ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-600"
            )}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-sm font-black leading-none truncate">{personName}</p>
              <Badge variant="outline" className={cn(
                "text-[8px] font-black px-1.5 py-0 mt-1 border-none shadow-sm uppercase h-4",
                role === "closer" ? "bg-primary text-white" : "bg-emerald-500 text-white"
              )}>
                {t(`role.${role}`)}
              </Badge>
            </div>
          </div>

          {isAdmin && stats ? (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2 rounded-xl bg-muted/50 border border-border/40">
                  <p className="text-[8px] font-black uppercase text-muted-foreground">{t("detail.totalSales")}</p>
                  <p className="text-sm font-black tabular-nums">{stats.total}</p>
                </div>
                <div className="p-2 rounded-xl bg-muted/50 border border-border/40">
                  <p className="text-[8px] font-black uppercase text-muted-foreground">Validated</p>
                  <p className="text-sm font-black tabular-nums">{stats.validated}</p>
                </div>
              </div>

              <div>
                <p className="text-[8px] font-black uppercase text-muted-foreground mb-1">Estimated Commission</p>
                <p className="text-xl font-black text-primary tabular-nums tracking-tight">
                  {formatCurrency(stats.commission, locale)}
                </p>
              </div>

              {(stats.refunds > 0 || stats.impayes > 0) && (
                <div className="p-2 rounded-xl bg-destructive/5 border border-destructive/10">
                   <p className="text-[8px] font-black uppercase text-destructive mb-1">{t("detail.refundsUnpaid")}</p>
                   <p className="text-xs font-bold text-destructive tabular-nums">
                    {stats.refunds} Refunds / {stats.impayes} Unpaid
                  </p>
                </div>
              )}

              <Separator className="bg-border/40" />

              <Link
                to={profilePath}
                className="flex items-center justify-between text-[10px] text-primary hover:text-primary/80 font-black uppercase tracking-widest transition-colors"
              >
                {t("setter.viewProfile")}
                <ArrowUpRight className="h-3 w-3" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-2 py-2 text-[10px] text-muted-foreground font-medium italic">
              <UserIcon className="h-3 w-3" />
              Viewing limited profile info
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ProfileTag;
