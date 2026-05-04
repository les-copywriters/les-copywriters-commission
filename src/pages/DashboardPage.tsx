import { useMemo, useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSales } from "@/hooks/useSales";
import { useRefunds } from "@/hooks/useRefunds";
import { useImpayes } from "@/hooks/useImpayes";
import { useBonusTiers } from "@/hooks/useBonusTiers";
import { useSetterDashboardMetrics } from "@/hooks/useSetterDashboard";
import { computeSetterDateRange, SetterDatePreset } from "@/lib/setterDashboard";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { monthlyBonusBreakdown, calculateMonthBonus, formatMonth } from "@/lib/bonusCalculation";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import ProfileTag from "@/components/ProfileTag";
import { useSyncSetterDashboard } from "@/hooks/useSetterDashboard";
import { Button } from "@/components/ui/button";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, AlertTriangle, Wallet, DollarSign, ShoppingCart, Gift, RefreshCw, Eye, ArrowRight, Activity, Calendar, Trophy } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn, ls, parseSyncResult } from "@/lib/utils";
import { useSyncJotform } from "@/hooks/useSyncJotform";
import { toast } from "sonner";
import SaleDetailsDialog from "@/components/SaleDetailsDialog";
import { Sale } from "@/types";
import BonusTransactionsDialog, { BonusDrilldownKind } from "@/components/BonusTransactionsDialog";

const CHART_COLORS = { primary: "hsl(var(--primary))", border: "rgba(128,128,128,0.10)" };

// ── Shared section card ───────────────────────────────────────────────────────
const SectionCard = ({ title, icon: Icon, badge, children }: {
  title: string; icon?: React.ElementType; badge?: string; children: React.ReactNode;
}) => (
  <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
    <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <p className="text-sm font-medium">{title}</p>
      </div>
      {badge && <span className="text-[11px] text-muted-foreground">{badge}</span>}
    </div>
    {children}
  </div>
);

const DashboardPage = () => {
  const { t, locale } = useAuth() as never;
  const { t: translate, locale: loc } = useLanguage();
  const { user } = useAuth();
  const { data: allSales   = [], isLoading: loadingSales,   isError: salesFailed,   error: salesError   } = useSales();
  const { data: allRefunds = [], isLoading: loadingRefunds, isError: refundsFailed, error: refundsError } = useRefunds();
  const { data: allImpayes = [], isLoading: loadingImpayes, isError: impayesFailed, error: impayesError } = useImpayes();
  const { data: tiers = [],                                 isError: tiersFailed,  error: tiersError  } = useBonusTiers();
  const sync = useSyncJotform();
  void t; void locale;

  useEffect(() => { if (salesFailed)   toast.error(`${translate("sync.error")}: ${salesError?.message}`);   }, [salesFailed]);   // eslint-disable-line
  useEffect(() => { if (refundsFailed) toast.error(`${translate("sync.error")}: ${refundsError?.message}`); }, [refundsFailed]); // eslint-disable-line
  useEffect(() => { if (impayesFailed) toast.error(`${translate("sync.error")}: ${impayesError?.message}`); }, [impayesFailed]); // eslint-disable-line
  useEffect(() => { if (tiersFailed)   toast.error(`${translate("sync.error")}: ${tiersError?.message}`);   }, [tiersFailed]);   // eslint-disable-line

  const funnelSync = useSyncSetterDashboard();
  const isAdmin  = user?.role === "admin";
  const isCloser = user?.role === "closer";
  const isSetter = user?.role === "setter";

  const PAGE_SIZE = 10;
  const [adminVisible,  setAdminVisible]  = useState(PAGE_SIZE);
  const [memberVisible, setMemberVisible] = useState(PAGE_SIZE);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [bonusDialog, setBonusDialog] = useState<{ month: string; kind: BonusDrilldownKind } | null>(null);
  const [datePreset, setDatePreset] = useState<SetterDatePreset>(
    () => (ls.get("dashboard.datePreset", "thisMonth") as SetterDatePreset)
  );
  useEffect(() => { ls.set("dashboard.datePreset", datePreset); }, [datePreset]);

  const dateRange = useMemo(() => computeSetterDateRange(datePreset, "", ""), [datePreset]);
  const { data: metrics } = useSetterDashboardMetrics({
    profileId: user?.id, startDate: dateRange.start, endDate: dateRange.end, enabled: isSetter,
  });

  const sales = useMemo(() => {
    const scoped = isAdmin ? allSales : allSales.filter(s =>
      isCloser ? s.closerId === user?.id : s.setterId === user?.id
    );
    return scoped.filter(s => s.date >= dateRange.start && s.date <= dateRange.end);
  }, [allSales, isAdmin, isCloser, user?.id, dateRange]);

  const visibleIds = useMemo(() => new Set(sales.map(s => s.id)), [sales]);
  const refunds = isAdmin ? allRefunds : allRefunds.filter(r => visibleIds.has(r.saleId));
  const impayes = isAdmin ? allImpayes : allImpayes.filter(i => visibleIds.has(i.saleId));
  const loading = loadingSales || loadingRefunds || loadingImpayes;
  const fmt = (n: number) => formatCurrency(n, loc);

  const computed = useMemo(() => {
    const monthLabels: Record<number, string> = loc === "fr"
      ? { 1:"Jan",2:"Fév",3:"Mar",4:"Avr",5:"Mai",6:"Jun",7:"Jul",8:"Aoû",9:"Sep",10:"Oct",11:"Nov",12:"Déc" }
      : { 1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec" };
    let totalCloserComm = 0, totalSetterComm = 0, totalVolume = 0, paidCount = 0;
    const closerCommMap = new Map<string, number>();
    const productMap    = new Map<string, number>();
    const monthlyMap    = new Map<string, number>();
    for (const s of sales) {
      totalVolume += s.amount;
      if (!s.refunded && !s.impaye) {
        totalCloserComm += s.closerCommission;
        totalSetterComm += s.setterCommission;
        paidCount++;
        closerCommMap.set(s.closer, (closerCommMap.get(s.closer) ?? 0) + s.closerCommission);
        const myComm = isCloser ? s.closerCommission : isSetter ? s.setterCommission : s.closerCommission + s.setterCommission;
        productMap.set(s.product, (productMap.get(s.product) ?? 0) + myComm);
        const d = new Date(s.date);
        const k = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
        monthlyMap.set(k, (monthlyMap.get(k) ?? 0) + myComm);
      }
    }
    const totalRefunds = refunds.reduce((a, r) => a + r.amount, 0);
    const totalImpayes = impayes.reduce((a, i) => a + i.amount, 0);
    const myComm  = isCloser ? totalCloserComm : isSetter ? totalSetterComm : totalCloserComm + totalSetterComm;
    const avgComm = paidCount > 0 ? myComm / paidCount : 0;
    const now = new Date();
    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const m = d.getMonth() + 1;
      const k = `${d.getFullYear()}-${String(m).padStart(2,"0")}`;
      return { month: monthLabels[m], commission: monthlyMap.get(k) ?? 0 };
    });
    return { totalCloserComm, totalSetterComm, totalVolume, totalRefunds, totalImpayes, myComm, avgComm,
      closerCommData: Array.from(closerCommMap, ([name, commission]) => ({ name, commission })),
      productData:    Array.from(productMap,    ([name, commission]) => ({ name, commission })),
      monthlyData };
  }, [sales, refunds, impayes, isCloser, isSetter, loc]);

  const bonusHistory    = useMemo(() => isCloser ? monthlyBonusBreakdown(sales, tiers) : [], [sales, tiers, isCloser]);
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthBonus = useMemo(() => {
    if (!isCloser) return null;
    const thisMonth = allSales.filter(s => s.closerId === user?.id && s.date.startsWith(currentMonthKey));
    if (!thisMonth.length) return null;
    return { month: currentMonthKey, ...calculateMonthBonus(thisMonth, tiers) };
  }, [allSales, isCloser, user?.id, currentMonthKey, tiers]);

  const openBonusDialog = (month: string, kind: BonusDrilldownKind) => setBonusDialog({ month, kind });

  const presetLabels: { key: SetterDatePreset; label: string }[] = [
    { key: "thisMonth", label: translate("analytics.preset.thisMonth") },
    { key: "lastMonth", label: translate("analytics.preset.lastMonth") },
    { key: "last3m",    label: translate("analytics.preset.last3m") },
    { key: "last6m",    label: translate("analytics.preset.last6m") },
    { key: "thisYear",  label: translate("analytics.preset.thisYear") },
    { key: "lastYear",  label: translate("analytics.preset.lastYear") },
    { key: "allTime",   label: translate("analytics.preset.allTime") },
  ];

  const tooltipStyle = {
    borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12,
    background: "hsl(var(--background))", color: "hsl(var(--foreground))", padding: "10px 14px",
  };

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {isAdmin ? translate("dashboard.salesSource") : `${translate(`role.${user?.role}`)} · ${translate("dashboard.salesSource")}`}
            </p>
            <div className="flex items-center gap-3">
              <h1 className="text-xl font-semibold">{isAdmin ? translate("dashboard.title") : user?.name}</h1>
              {isCloser && user?.name && (
                <Link
                  to={`/team/closer/${encodeURIComponent(user.name)}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-border/50 bg-muted/30 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                >
                  <Eye className="h-3 w-3" />
                  View my profile
                </Link>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {!isAdmin && (isCloser || isSetter) && (
              <button
                disabled={sync.isPending}
                onClick={() => sync.mutate(undefined, {
                  onSuccess: (res) => {
                    const checked = res.total ? `Checked ${res.total} submissions.` : undefined;
                    if (res.imported > 0 || (res.updated ?? 0) > 0) {
                      toast.success([res.imported > 0 ? `${res.imported} ${translate("sync.imported")}` : null, (res.updated ?? 0) > 0 ? `${res.updated} ${translate("sync.updated")}` : null].filter(Boolean).join(" · "), { description: checked });
                    } else if ((res.errors?.length ?? 0) > 0) {
                      toast.warning(translate("sync.completedWithIssues"), { description: res.errors?.slice(0,2).join(" | ") });
                    } else {
                      toast.info(translate("sync.upToDate"), { description: checked });
                    }
                  },
                  onError: (e) => toast.error(`${translate("sync.error")}: ${e.message}`),
                })}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <RefreshCw className={cn("h-3.5 w-3.5", sync.isPending && "animate-spin")} />
                {sync.isPending ? translate("sync.syncing") : translate("sync.button")}
              </button>
            )}
            {isSetter && (
              <button
                disabled={funnelSync.isPending}
                onClick={() => {
                  const today = new Date();
                  const d90 = new Date(today); d90.setDate(today.getDate() - 90);
                  const fmt = (d: Date) => d.toISOString().split("T")[0];
                  // Only sync iClosed for the setter — Aircall is handled by the
                  // admin's scheduled sync and re-fetching 3000+ calls causes a timeout.
                  funnelSync.mutate({ source: "iclosed", profileId: user?.id }, {
                    onSuccess: (data) => {
                      const { message, hasErrors } = parseSyncResult(data);
                      if (hasErrors) toast.warning(message);
                      else toast.success(message);
                    },
                    onError: (e) => toast.error(e.message),
                  });
                }}
                className="flex items-center gap-1.5 rounded-lg border border-border/60 bg-background px-3 py-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
              >
                <Activity className={cn("h-3.5 w-3.5", funnelSync.isPending && "animate-spin")} />
                {funnelSync.isPending ? "Syncing…" : "Sync Performance"}
              </button>
            )}
          </div>
        </div>

        {/* Date presets */}
        <div className="flex flex-wrap items-center gap-1.5">
          {presetLabels.map(({ key, label }) => (
            <button key={key}
              onClick={() => { setDatePreset(key); setAdminVisible(PAGE_SIZE); setMemberVisible(PAGE_SIZE); }}
              className={cn("rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                datePreset === key ? "bg-primary text-white shadow-sm" : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >{label}</button>
          ))}
          <span className="ml-auto text-xs text-muted-foreground/40 hidden md:block">{dateRange.start} → {dateRange.end}</span>
        </div>

        {/* KPI cards */}
        {loading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title={isAdmin ? translate("dashboard.totalCommissions") : translate("detail.totalComm")}
              value={fmt(computed.myComm)} trend="up" accent="blue" icon={<Wallet className="h-4 w-4" />} />
            <StatCard title={isAdmin ? translate("dashboard.closerCommTotal") : translate("detail.totalSales")}
              value={isAdmin ? fmt(computed.totalCloserComm) : String(sales.length)}
              subtitle={isAdmin ? translate("dashboard.closersSetters") : fmt(computed.totalVolume)}
              accent="green" icon={isAdmin ? <TrendingUp className="h-4 w-4" /> : <ShoppingCart className="h-4 w-4" />} />
            <StatCard
              title={isAdmin ? translate("dashboard.refunds") : isSetter ? "Show-ups" : translate("detail.avgComm")}
              value={isAdmin ? fmt(computed.totalRefunds) : isSetter ? String(metrics?.summary?.showUps ?? 0) : fmt(computed.avgComm)}
              subtitle={isAdmin ? `${refunds.length} ${translate("dashboard.requests")}` : isSetter ? `${(metrics?.summary?.showRate ?? 0).toFixed(1)}% show rate` : undefined}
              trend={isAdmin ? "down" : "up"} accent={isAdmin ? "red" : isSetter ? "orange" : "blue"}
              icon={isAdmin ? <AlertTriangle className="h-4 w-4" /> : isSetter ? <Calendar className="h-4 w-4" /> : <TrendingUp className="h-4 w-4" />} />
            <StatCard title={translate("detail.refundsUnpaid")} value={`${refunds.length} / ${impayes.length}`}
              subtitle={translate("detail.refundsUnpaidSub")} trend="down" accent="red" icon={<AlertTriangle className="h-4 w-4" />} />
          </div>
        )}

        {/* Bonus section (closers only) */}
        {!isAdmin && isCloser && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Current month bonus */}
            <div className="rounded-xl border border-primary/20 bg-primary text-white overflow-hidden relative">
              <div className="absolute top-0 right-0 p-8 opacity-[0.07]"><Trophy className="h-32 w-32" /></div>
              <div className="p-5 relative space-y-4">
                <div className="flex items-center gap-2">
                  <span className="text-[10px] text-white/60 uppercase tracking-wide">{translate("bonus.currentMonth")}</span>
                  <span className="text-[11px] bg-white/15 px-2 py-0.5 rounded-md">{formatMonth(currentMonthKey, loc)}</span>
                </div>
                {!currentMonthBonus || currentMonthBonus.total === 0 ? (
                  <p className="text-lg font-semibold opacity-80">{translate("bonus.noBonus")}</p>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <button onClick={() => openBonusDialog(currentMonthBonus.month, "total")}
                        className="text-4xl font-bold tabular-nums hover:opacity-80 transition-opacity">
                        {fmt(currentMonthBonus.total)}
                      </button>
                      <p className="text-[11px] text-white/50 mt-1">Estimated monthly reward</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-4">
                      <div>
                        <p className="text-[11px] text-white/40 mb-1">PIF Bonus</p>
                        <button onClick={() => openBonusDialog(currentMonthBonus.month, "pifBonus")}
                          className="text-xl font-semibold hover:opacity-80 transition-opacity">{fmt(currentMonthBonus.pifBonus)}</button>
                      </div>
                      <div>
                        <p className="text-[11px] text-white/40 mb-1">Volume Bonus</p>
                        <button onClick={() => openBonusDialog(currentMonthBonus.month, "volumeBonus")}
                          className="text-xl font-semibold hover:opacity-80 transition-opacity">{fmt(currentMonthBonus.volumeBonus)}</button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Bonus history */}
            <SectionCard title={translate("bonus.history")} icon={Calendar} badge={`${bonusHistory.length} cycles`}>
              <div className="overflow-auto max-h-[240px]">
                <table className="w-full text-sm">
                  <tbody>
                    {bonusHistory.map(row => (
                      <tr key={row.month} onClick={() => openBonusDialog(row.month, "total")}
                        className="border-b border-border/20 hover:bg-muted/30 cursor-pointer transition-colors">
                        <td className="py-3 px-4 font-medium">{formatMonth(row.month, loc)}</td>
                        <td className="py-3 px-4 text-[11px] text-muted-foreground">Gross payout</td>
                        <td className="py-3 px-4 text-right">
                          <span className={cn("font-semibold tabular-nums", row.total > 0 ? "text-emerald-600" : "text-muted-foreground/30")}>
                            {fmt(row.total)}
                          </span>
                        </td>
                        <td className="py-3 pr-4 text-right">
                          <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/30 ml-auto" />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </SectionCard>
          </div>
        )}

        {/* Charts */}
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-2">
            <SectionCard
              title={isAdmin ? translate("dashboard.commByCloser") : translate("detail.commByProduct")}
              icon={Activity}
              badge={isAdmin ? "by closer" : "by product"}
            >
              <div className="p-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={isAdmin ? computed.closerCommData : computed.productData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                    <XAxis dataKey="name" fontSize={11} axisLine={false} tickLine={false} dy={8} />
                    <YAxis fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,0,0,0.03)" }} formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <SectionCard title={translate("dashboard.commByMonth")} icon={TrendingUp} badge="6 months">
              <div className="p-4">
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={computed.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                    <XAxis dataKey="month" fontSize={11} axisLine={false} tickLine={false} dy={8} />
                    <YAxis fontSize={11} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                    <Tooltip contentStyle={tooltipStyle} cursor={{ fill: "rgba(0,0,0,0.03)" }} formatter={(v: number) => fmt(v)} />
                    <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>
          </div>
        )}

        {/* Sales table */}
        <SectionCard
          title={isAdmin ? translate("dashboard.recentCommissions") : translate("detail.salesHistory")}
          icon={Gift}
          badge={`${isAdmin ? adminVisible : memberVisible} records`}
        >
          {loading ? (
            <div className="p-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded" />)}
            </div>
          ) : sales.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">{translate("dashboard.noData")}</div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader className="bg-muted/30">
                  <TableRow className="border-none">
                    <TableHead className="py-3 pl-4 text-[11px] font-medium text-muted-foreground">{translate("table.date")}</TableHead>
                    <TableHead className="py-3 text-[11px] font-medium text-muted-foreground">{translate("table.client")}</TableHead>
                    <TableHead className="py-3 text-[11px] font-medium text-muted-foreground">
                      {isAdmin ? translate("table.closer") : (isCloser ? translate("table.setter") : translate("table.closer"))}
                    </TableHead>
                    <TableHead className="py-3 text-right text-[11px] font-medium text-muted-foreground">{translate("table.amount")}</TableHead>
                    <TableHead className="py-3 text-right text-[11px] font-medium text-muted-foreground">Commission</TableHead>
                    <TableHead className="py-3 text-[11px] font-medium text-muted-foreground">{translate("table.status")}</TableHead>
                    <TableHead className="py-3 pr-4 text-right text-[11px] font-medium text-muted-foreground">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.slice(0, isAdmin ? adminVisible : memberVisible).map(s => (
                    <TableRow key={s.id} className="hover:bg-muted/20 border-border/20 transition-colors">
                      <TableCell className="py-3 pl-4 text-xs text-muted-foreground tabular-nums">{s.date}</TableCell>
                      <TableCell className="py-3">
                        <p className="font-medium text-sm">{s.clientName}</p>
                        {s.clientEmail && <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{s.clientEmail}</p>}
                      </TableCell>
                      <TableCell className="py-3">
                        {isAdmin ? <ProfileTag role="closer" personId={s.closerId} personName={s.closer} />
                          : isCloser ? <ProfileTag role="setter" personId={s.setterId} personName={s.setter} />
                          : <ProfileTag role="closer" personId={s.closerId} personName={s.closer} />}
                      </TableCell>
                      <TableCell className="py-3 text-right text-sm tabular-nums text-muted-foreground">{fmt(s.amount)}</TableCell>
                      <TableCell className="py-3 text-right font-semibold text-primary tabular-nums">
                        {fmt(isCloser ? s.closerCommission : (isSetter ? s.setterCommission : s.closerCommission))}
                      </TableCell>
                      <TableCell className="py-3">
                        <div className="flex items-center gap-1.5">
                          <SaleStatusBadge refunded={s.refunded} impaye={s.impaye} />
                          {isCloser && s.paymentType === "pif" && (
                            <Badge className="text-[9px] text-emerald-600 bg-emerald-500/10 border-emerald-500/20 h-4 px-1.5 rounded uppercase">PIF</Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="py-3 pr-4 text-right">
                        <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedSale(s)}>
                          <Eye className="h-3.5 w-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {(isAdmin ? sales.length > adminVisible : sales.length > memberVisible) && (
                <div className="p-4 text-center border-t border-border/20">
                  <button onClick={() => isAdmin ? setAdminVisible(v => v + PAGE_SIZE) : setMemberVisible(v => v + PAGE_SIZE)}
                    className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                    Load {PAGE_SIZE} more ({(isAdmin ? sales.length - adminVisible : sales.length - memberVisible)} remaining)
                  </button>
                </div>
              )}
            </div>
          )}
        </SectionCard>

      </div>
      <BonusTransactionsDialog
        month={bonusDialog?.month ?? null} kind={bonusDialog?.kind ?? null}
        sales={sales} tiers={tiers} open={!!bonusDialog}
        onOpenChange={(open) => !open && setBonusDialog(null)}
      />
      <SaleDetailsDialog sale={selectedSale} open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)} />
    </AppLayout>
  );
};

export default DashboardPage;
