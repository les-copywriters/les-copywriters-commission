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
        <button className="group flex items-center gap-3 text-xs font-black transition-all hover:text-primary active:scale-95 uppercase tracking-tight">
          <div className={cn(
            "flex h-7 w-7 shrink-0 items-center justify-center rounded-xl text-[10px] font-black shadow-inner transition-all duration-500 group-hover:rotate-6 group-hover:scale-110",
            role === "closer" ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-600"
          )}>
            {initials}
          </div>
          <span className="underline-offset-4 group-hover:underline decoration-primary/30">{personName}</span>
        </button>
      </PopoverTrigger>

      <PopoverContent className="w-72 p-0 overflow-hidden shadow-premium border-none rounded-[2rem] animate-in fade-in zoom-in-95 duration-300" align="start" side="top" sideOffset={12}>
        <div className="bg-gradient-to-br from-background via-background to-muted/20 p-6">
          <div className="flex items-center gap-4 mb-6">
            <div className={cn(
              "flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl text-xs font-black shadow-xl",
              role === "closer" ? "bg-primary/10 text-primary" : "bg-emerald-500/10 text-emerald-600"
            )}>
              {initials}
            </div>
            <div className="min-w-0">
              <p className="text-base font-black leading-none truncate tracking-tight">{personName}</p>
              <Badge variant="outline" className={cn(
                "text-[8px] font-black px-2 py-0.5 mt-2 border-none shadow-sm uppercase h-4.5 rounded-full",
                role === "closer" ? "bg-primary text-white shadow-primary/20" : "bg-emerald-500 text-white shadow-emerald-500/20"
              )}>
                {t(`role.${role}`)}
              </Badge>
            </div>
          </div>

          {isAdmin && stats ? (
            <div className="space-y-5">
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-2xl bg-muted/30 border border-border/40">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">{t("detail.totalSales")}</p>
                  <p className="text-base font-black tabular-nums">{stats.total}</p>
                </div>
                <div className="p-3 rounded-2xl bg-muted/30 border border-border/40">
                  <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/60 mb-1">Validated</p>
                  <p className="text-base font-black tabular-nums text-emerald-500">{stats.validated}</p>
                </div>
              </div>

              <div className="px-1">
                <p className="text-[8px] font-black uppercase tracking-widest text-muted-foreground/40 mb-1.5">Estimated Performance Revenue</p>
                <p className="text-2xl font-black text-primary tabular-nums tracking-tighter">
                  {formatCurrency(stats.commission, locale)}
                </p>
              </div>

              {(stats.refunds > 0 || stats.impayes > 0) && (
                <div className="p-3 rounded-2xl bg-rose-500/5 border border-rose-500/10">
                   <p className="text-[8px] font-black uppercase tracking-widest text-rose-500/60 mb-1.5">{t("detail.refundsUnpaid")}</p>
                   <p className="text-[10px] font-black text-rose-600 tabular-nums uppercase tracking-widest">
                    {stats.refunds} Refunds / {stats.impayes} Unpaid
                  </p>
                </div>
              )}

              <Separator className="bg-border/40" />

              <Link
                to={profilePath}
                className="flex items-center justify-between text-[10px] text-primary hover:text-primary/80 font-black uppercase tracking-[0.2em] transition-all hover:translate-x-1"
              >
                {t("setter.viewProfile")}
                <ArrowUpRight className="h-4 w-4" />
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3 py-3 px-1 text-[10px] text-muted-foreground font-black uppercase tracking-widest opacity-40">
              <UserIcon className="h-4 w-4" />
              Identity Encrypted
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default ProfileTag;
