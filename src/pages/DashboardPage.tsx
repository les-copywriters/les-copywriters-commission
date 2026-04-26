import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSales } from "@/hooks/useSales";
import { useRefunds } from "@/hooks/useRefunds";
import { useImpayes } from "@/hooks/useImpayes";
import { useBonusTiers } from "@/hooks/useBonusTiers";
import { useSetterDashboardMetrics } from "@/hooks/useSetterDashboard";
import { computeSetterDateRange } from "@/lib/setterDashboard";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { monthlyBonusBreakdown, formatMonth } from "@/lib/bonusCalculation";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import ProfileTag from "@/components/ProfileTag";
import { useSyncSetterDashboard } from "@/hooks/useSetterDashboard";
import { Button } from "@/components/ui/button";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, AlertTriangle, Wallet, DollarSign, ShoppingCart, Gift, RefreshCw, Eye, ArrowRight, Activity, Calendar, Trophy, BarChart3 } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
} from "recharts";
import { cn } from "@/lib/utils";
import { useSyncJotform } from "@/hooks/useSyncJotform";
import { toast } from "sonner";
import SaleDetailsDialog from "@/components/SaleDetailsDialog";
import { Sale } from "@/types";

// ─── Shared skeleton loader ───────────────────────────────────────────────────
const CardSkeletons = ({ n = 4 }: { n?: number }) => (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[2rem]" />)}
  </div>
);

const ChartSkeletons = () => (
  <div className="grid gap-8 lg:grid-cols-2">
    {Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-[420px] rounded-[2.5rem]" />)}
  </div>
);

// ─── Chart card wrapper ───────────────────────────────────────────────────────
const ChartCard = ({ title, icon: Icon, children, badge }: { title: string; icon?: any; children: React.ReactNode; badge?: string }) => (
  <Card className="border-none shadow-premium bg-background overflow-hidden rounded-[2.5rem]">
    <CardHeader className="p-8 border-b border-border/40 flex flex-row items-center justify-between">
      <div className="flex items-center gap-3">
        {Icon && <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>}
        <CardTitle className="font-black text-sm uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
      </div>
      {badge && <Badge className="bg-primary/5 text-primary border-primary/20 font-black uppercase tracking-widest text-[8px] px-3 py-1 rounded-full">{badge}</Badge>}
    </CardHeader>
    <CardContent className="p-8">{children}</CardContent>
  </Card>
);

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  border:  "rgba(128,128,128,0.12)",
};

// ─── Main component ───────────────────────────────────────────────────────────
const DashboardPage = () => {
  const { t, locale } = useLanguage();
  const { user }      = useAuth();
  const { data: allSales   = [], isLoading: loadingSales   } = useSales();
  const { data: allRefunds = [], isLoading: loadingRefunds } = useRefunds();
  const { data: allImpayes = [], isLoading: loadingImpayes } = useImpayes();
  const { data: tiers = [] } = useBonusTiers();
  const sync = useSyncJotform();
  const funnelSync = useSyncSetterDashboard();

  const isAdmin  = user?.role === "admin";
  const isCloser = user?.role === "closer";
  const isSetter = user?.role === "setter";

  const PAGE_SIZE = 10;
  const [adminVisible,  setAdminVisible]  = useState(PAGE_SIZE);
  const [memberVisible, setMemberVisible] = useState(PAGE_SIZE);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const dateRange = useMemo(() => computeSetterDateRange("thisMonth", "", ""), []);
  const { data: metrics } = useSetterDashboardMetrics({
    profileId: user?.id,
    startDate: dateRange.start,
    endDate: dateRange.end,
    enabled: isSetter,
  });

  // Scope sales/refunds/impayes to the current user if not admin
  const sales = useMemo(() =>
    isAdmin ? allSales : allSales.filter(s =>
      isCloser ? s.closerId === user?.id : s.setterId === user?.id
    ), [allSales, isAdmin, isCloser, user?.id]);

  const visibleIds = useMemo(() => new Set(sales.map(s => s.id)), [sales]);
  const refunds = isAdmin ? allRefunds : allRefunds.filter(r => visibleIds.has(r.saleId));
  const impayes = isAdmin ? allImpayes : allImpayes.filter(i => visibleIds.has(i.saleId));

  const loading = loadingSales || loadingRefunds || loadingImpayes;
  const fmt = (n: number) => formatCurrency(n, locale);

  // ── Shared computations ────────────────────────────────────────────────────
  const computed = useMemo(() => {
    const monthLabels: Record<number, string> = locale === "fr"
      ? { 1:"Jan",2:"Fév",3:"Mar",4:"Avr",5:"Mai",6:"Jun",7:"Jul",8:"Aoû",9:"Sep",10:"Oct",11:"Nov",12:"Déc" }
      : { 1:"Jan",2:"Feb",3:"Mar",4:"Apr",5:"May",6:"Jun",7:"Jul",8:"Aug",9:"Sep",10:"Oct",11:"Nov",12:"Dec" };

    let totalCloserComm = 0, totalSetterComm = 0, totalVolume = 0, paidCount = 0;
    const closerCommMap  = new Map<string, number>();
    const productMap     = new Map<string, number>();
    const monthlyMap     = new Map<number, number>();

    for (const s of sales) {
      totalVolume += s.amount;
      if (!s.refunded && !s.impaye) {
        totalCloserComm += s.closerCommission;
        totalSetterComm += s.setterCommission;
        paidCount++;
        // per-closer (admin chart)
        closerCommMap.set(s.closer, (closerCommMap.get(s.closer) ?? 0) + s.closerCommission);
        // per-product (member chart)
        const myComm = isCloser ? s.closerCommission : isSetter ? s.setterCommission : s.closerCommission + s.setterCommission;
        productMap.set(s.product, (productMap.get(s.product) ?? 0) + myComm);
        // monthly
        const d = new Date(s.date);
        const monthKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
        monthlyMap.set(monthKey, (monthlyMap.get(monthKey) ?? 0) + myComm);
      }
    }

    const totalRefunds = refunds.reduce((a, r) => a + r.amount, 0);
    const totalImpayes = impayes.reduce((a, i) => a + i.amount, 0);
    const myComm = isCloser ? totalCloserComm : isSetter ? totalSetterComm : totalCloserComm + totalSetterComm;
    const avgComm = paidCount > 0 ? myComm / paidCount : 0;

    const now = new Date();
    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const m = d.getMonth() + 1;
      const key = `${d.getFullYear()}-${String(m).padStart(2, "0")}`;
      return { month: monthLabels[m], commission: monthlyMap.get(key) ?? 0 };
    });

    return {
      totalCloserComm, totalSetterComm, totalVolume, totalRefunds, totalImpayes,
      myComm, avgComm,
      closerCommData:  Array.from(closerCommMap, ([name, commission]) => ({ name, commission })),
      productData:     Array.from(productMap,    ([name, commission]) => ({ name, commission })),
      monthlyData,
    };
  }, [sales, refunds, impayes, isCloser, isSetter, locale]);

  // Closer: monthly bonus history
  const bonusHistory     = useMemo(() => isCloser ? monthlyBonusBreakdown(sales, tiers) : [], [sales, tiers, isCloser]);
  const currentMonthKey  = new Date().toISOString().slice(0, 7);
  const currentMonthBonus = bonusHistory.find(b => b.month === currentMonthKey) ?? bonusHistory[0] ?? null;

  return (
    <AppLayout>
      <div className="space-y-12 animate-in fade-in duration-700">
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-8">
          <div className="flex items-center gap-5">
             <div className="h-16 w-16 rounded-[1.5rem] bg-primary/10 flex items-center justify-center text-primary shadow-inner">
                <BarChart3 className="h-8 w-8" />
             </div>
             <div>
                <h1 className="text-3xl font-black tracking-tight">{isAdmin ? t("dashboard.title") : user?.name}</h1>
                <p className="text-xs text-muted-foreground font-black uppercase tracking-widest mt-1.5 opacity-60">
                  {isAdmin ? t("dashboard.salesSource") : `${t(`role.${user?.role}`)} • ${t("dashboard.salesSource")}`}
                </p>
             </div>
          </div>
          
          <div className="flex flex-wrap items-center gap-3 w-full lg:w-auto">
            {!isAdmin && (isCloser || isSetter) && (
              <Button
                variant="outline"
                size="sm"
                disabled={sync.isPending}
                className="rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] border-border/60 hover:bg-primary/5 transition-all active:scale-95 shadow-lg shadow-primary/5"
                onClick={() =>
                  sync.mutate(undefined, {
                    onSuccess: (res) => {
                      const updated = res.updated ?? 0;
                      const skipped = res.skipped ?? 0;
                      const errorCount = res.errors?.length ?? 0;
                      const total = res.total ?? 0;
                      const nonActive = res.nonActive ?? 0;
                      const checkedDesc = [
                        total > 0 ? `Checked ${total} submission(s) from JotForm.` : null,
                        nonActive > 0 ? `${nonActive} had non-active status.` : null,
                      ].filter(Boolean).join(" ") || undefined;
                      if (res.imported > 0 || updated > 0) {
                        toast.success(
                          [
                            res.imported > 0 ? `${res.imported} ${t("sync.imported")}` : null,
                            updated > 0 ? `${updated} ${t("sync.updated")}` : null,
                          ].filter(Boolean).join(" · "),
                          { description: checkedDesc }
                        );
                      } else if (skipped > 0 || errorCount > 0) {
                        toast.warning(t("sync.completedWithIssues"), {
                          description: [
                            checkedDesc,
                            skipped > 0 ? `${skipped} ${t("sync.skipped")}` : null,
                            errorCount > 0 ? `${errorCount} ${t("sync.errors")}: ${res.errors.slice(0, 2).join(" | ")}` : null,
                          ].filter(Boolean).join(" — "),
                        });
                      } else {
                        toast.info(t("sync.upToDate"), { description: checkedDesc });
                      }
                    },
                    onError: (e) => toast.error(`${t("sync.error")}: ${e.message}`),
                  })
                }
              >
                <RefreshCw className={cn("h-4 w-4 mr-2", sync.isPending && "animate-spin")} />
                {sync.isPending ? t("sync.syncing") : t("sync.button")}
              </Button>
            )}

            {isSetter && (
              <Button
                variant="outline"
                size="sm"
                disabled={funnelSync.isPending}
                className="rounded-2xl h-12 px-6 font-black uppercase tracking-widest text-[10px] border-border/60 hover:bg-primary/5 transition-all active:scale-95 shadow-lg shadow-primary/5"
                onClick={() =>
                  funnelSync.mutate({ profileId: user?.id }, {
                    onSuccess: () => toast.success("Performance Data Synced", { description: "Meetings and call metrics have been updated from iClosed/Aircall." }),
                    onError: (e) => toast.error(`Sync Error: ${e.message}`),
                  })
                }
              >
                <Activity className={cn("h-4 w-4 mr-2", funnelSync.isPending && "animate-spin")} />
                {funnelSync.isPending ? "Syncing..." : "Sync Performance"}
              </Button>
            )}
            {isSetter && (
              <Badge className="h-12 px-6 rounded-2xl bg-muted/40 text-muted-foreground border-none font-black uppercase tracking-widest text-[10px] hidden sm:flex">
                Real-time Intelligence Active
              </Badge>
            )}
          </div>
        </div>

        {/* Stat cards */}
        {loading ? <CardSkeletons /> : (
          <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title={isAdmin ? t("dashboard.totalCommissions") : t("detail.totalComm")} 
              value={fmt(computed.myComm)} 
              trend="up" 
              accent="blue" 
              icon={<Wallet className="h-5 w-5" />} 
            />
            <StatCard 
              title={isAdmin ? t("dashboard.closerCommTotal") : t("detail.totalSales")} 
              value={isAdmin ? fmt(computed.totalCloserComm) : String(sales.length)} 
              subtitle={isAdmin ? t("dashboard.closersSetters") : fmt(computed.totalVolume)} 
              accent="green" 
              icon={isAdmin ? <TrendingUp className="h-5 w-5" /> : <ShoppingCart className="h-5 w-5" />} 
            />
            <StatCard
              title={isAdmin ? t("dashboard.refunds") : isSetter ? "Show-ups" : t("detail.avgComm")}
              value={isAdmin ? fmt(computed.totalRefunds) : isSetter ? String(metrics?.summary?.showUps ?? 0) : fmt(computed.avgComm)}
              subtitle={isAdmin ? `${refunds.length} ${t("dashboard.requests")}` : isSetter ? `${(metrics?.summary?.showRate ?? 0).toFixed(1)}% show rate` : undefined}
              trend={isAdmin ? "down" : "up"}
              accent={isAdmin ? "red" : isSetter ? "orange" : "blue"}
              icon={isAdmin ? <AlertTriangle className="h-5 w-5" /> : isSetter ? <Calendar className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />}
            />
            <StatCard 
              title={t("detail.refundsUnpaid")} 
              value={`${refunds.length} / ${impayes.length}`} 
              subtitle={t("detail.refundsUnpaidSub")} 
              trend="down" 
              accent="red" 
              icon={<AlertTriangle className="h-5 w-5" />} 
            />
          </div>
        )}

        {/* Bonus Highlights for Closers */}
        {!isAdmin && isCloser && (
          <div className="grid gap-8 lg:grid-cols-2">
            <Card className="border-none shadow-premium bg-primary text-white overflow-hidden rounded-[2.5rem] relative group transition-all duration-700 hover:shadow-2xl hover:shadow-primary/20">
              <div className="absolute top-0 right-0 p-12 opacity-10 transform group-hover:scale-110 group-hover:rotate-12 transition-all duration-700">
                <Trophy className="h-48 w-48" />
              </div>
              <CardContent className="p-10 relative">
                <div className="flex items-center gap-3 mb-10">
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-black uppercase tracking-widest text-[9px] px-4 py-1.5 rounded-full backdrop-blur-md">
                    {formatMonth(currentMonthBonus?.month || currentMonthKey, locale)}
                  </Badge>
                  <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/60">{t("bonus.currentMonth")}</p>
                </div>
                
                {!currentMonthBonus || currentMonthBonus.total === 0 ? (
                  <div className="py-6">
                    <p className="text-2xl font-black tracking-tight opacity-90">{t("bonus.noBonus")}</p>
                    <p className="mt-2 text-primary-foreground/60 text-sm font-medium leading-relaxed max-w-xs italic">Accelerate your performance to unlock monthly rewards.</p>
                  </div>
                ) : (
                  <div className="space-y-10">
                    <div>
                      <p className="text-6xl font-black tabular-nums tracking-tighter mb-2 drop-shadow-lg">{fmt(currentMonthBonus.total)}</p>
                      <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/50">Current Monthly Estimated Reward</p>
                    </div>
                    <div className="grid grid-cols-2 gap-8 border-t border-white/10 pt-8">
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-primary-foreground/40 mb-2">Validated PIF Bonus</p>
                        <p className="font-black text-2xl tracking-tight">{fmt(currentMonthBonus.pifBonus)}</p>
                      </div>
                      <div>
                        <p className="text-[9px] font-black uppercase tracking-widest text-primary-foreground/40 mb-2">Performance Volume</p>
                        <p className="font-black text-2xl tracking-tight">{fmt(currentMonthBonus.volumeBonus)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden">
               <div className="p-8 border-b border-border/40 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                     <div className="p-2 rounded-lg bg-primary/10 text-primary"><Calendar className="h-4 w-4" /></div>
                     <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{t("bonus.history")}</h3>
                  </div>
                  <Badge variant="outline" className="border-primary/20 text-primary font-black uppercase tracking-widest text-[9px] px-3 py-1 rounded-full">{bonusHistory.length} Cycles Recorded</Badge>
               </div>
               <CardContent className="p-0">
                  <div className="overflow-auto max-h-[340px] custom-scrollbar">
                    <Table>
                      <TableBody>
                        {bonusHistory.map(row => (
                          <TableRow key={row.month} className="group hover:bg-muted/10 border-border/30 transition-all">
                            <TableCell className="font-black pl-8 text-sm py-6">{formatMonth(row.month, locale)}</TableCell>
                            <TableCell className="py-6">
                               <div className="flex flex-col">
                                 <span className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/40 leading-none mb-2">Gross Payout</span>
                                 <span className={cn("font-black tabular-nums text-base transition-transform group-hover:scale-105 origin-left", row.total > 0 ? "text-emerald-500" : "text-muted-foreground/30")}>
                                     {fmt(row.total)}
                                 </span>
                               </div>
                            </TableCell>
                            <TableCell className="pr-8 text-right py-6">
                               <div className="h-8 w-8 rounded-full bg-muted/30 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                                  <ArrowRight className="h-4 w-4 text-muted-foreground" />
                               </div>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
               </CardContent>
            </Card>
          </div>
        )}

        {/* Analytics Section */}
        {loading ? <ChartSkeletons /> : (
          <div className="grid gap-8 lg:grid-cols-2">
            {/* Main Chart */}
            <ChartCard title={isAdmin ? t("dashboard.commByCloser") : t("detail.commByProduct")} icon={Activity} badge={isAdmin ? "By Identity" : "By Product Line"}>
               <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={isAdmin ? computed.closerCommData : computed.productData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                    <XAxis dataKey="name" fontSize={10} style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis fontSize={10} style={{ fontWeight: 800 }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', fontWeight: '900', background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', padding: '16px' }}
                      cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                      formatter={(v: number) => fmt(v)}
                    />
                    <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[8, 8, 0, 0]} barSize={28} />
                  </BarChart>
               </ResponsiveContainer>
            </ChartCard>

            {/* Secondary Chart/Breakdown */}
            <ChartCard title={t("dashboard.commByMonth")} icon={TrendingUp} badge="Trend Analysis">
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={computed.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                    <XAxis dataKey="month" fontSize={10} style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }} axisLine={false} tickLine={false} dy={10} />
                    <YAxis fontSize={10} style={{ fontWeight: 800 }} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                    <Tooltip
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', fontWeight: '900', background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', padding: '16px' }}
                      cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                      formatter={(v: number) => fmt(v)}
                    />
                    <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[8, 8, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
            </ChartCard>
          </div>
        )}

        {/* Data Table */}
        <Card className="border-none shadow-premium rounded-[2.5rem] overflow-hidden bg-background">
          <div className="p-10 flex flex-col sm:flex-row items-center justify-between border-b border-border/40 gap-6">
             <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary"><Gift className="h-4 w-4" /></div>
                <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">
                  {isAdmin ? t("dashboard.recentCommissions") : t("detail.salesHistory")}
                </h3>
             </div>
             <Badge className="bg-primary/5 text-primary border-primary/20 font-black uppercase tracking-widest text-[9px] px-4 py-1.5 rounded-full">
               System Displaying {isAdmin ? adminVisible : memberVisible} Verified Records
             </Badge>
          </div>
          <CardContent className="p-0">
             {loading ? (
                <div className="p-10 space-y-6">
                  {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}
                </div>
              ) : sales.length === 0 ? (
                <div className="text-center py-32 grayscale opacity-40">
                  <div className="h-20 w-20 bg-muted/30 rounded-full flex items-center justify-center mx-auto mb-6">
                    <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
                  </div>
                  <p className="text-xl font-black tracking-tight text-muted-foreground/60">{t("dashboard.noData")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-none">
                        <TableHead className="py-6 pl-10 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("table.date")}</TableHead>
                        <TableHead className="py-6 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("table.client")}</TableHead>
                        <TableHead className="py-6 text-[9px] font-black uppercase tracking-widest text-muted-foreground">
                          {isAdmin ? t("table.closer") : (isCloser ? t("table.setter") : t("table.closer"))}
                        </TableHead>
                        <TableHead className="py-6 text-right text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("table.amount")}</TableHead>
                        <TableHead className="py-6 text-right text-[9px] font-black uppercase tracking-widest text-muted-foreground">Commission</TableHead>
                        <TableHead className="py-6 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("table.status")}</TableHead>
                        <TableHead className="py-6 pr-10 text-right text-[9px] font-black uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.slice(0, isAdmin ? adminVisible : memberVisible).map(s => (
                        <TableRow key={s.id} className="group hover:bg-muted/10 transition-all border-border/30">
                          <TableCell className="py-7 pl-10 text-xs font-black text-muted-foreground/60 tabular-nums italic">{s.date}</TableCell>
                          <TableCell className="py-7">
                            <div className="flex flex-col">
                              <p className="font-black text-sm tracking-tight leading-none mb-1.5">{s.clientName}</p>
                              {s.clientEmail && <p className="text-[10px] text-muted-foreground/40 font-bold truncate max-w-[200px]">{s.clientEmail}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="py-7">
                             {isAdmin ? (
                               <ProfileTag role="closer" personId={s.closerId} personName={s.closer} />
                             ) : (
                               isCloser 
                                ? <ProfileTag role="setter" personId={s.setterId} personName={s.setter} />
                                : <ProfileTag role="closer" personId={s.closerId} personName={s.closer} />
                             )}
                          </TableCell>
                          <TableCell className="py-7 text-right font-black text-sm tabular-nums text-muted-foreground/80">{fmt(s.amount)}</TableCell>
                          <TableCell className="py-7 text-right font-black text-primary tabular-nums text-base">
                            {fmt(isCloser ? s.closerCommission : (isSetter ? s.setterCommission : s.closerCommission))}
                          </TableCell>
                          <TableCell className="py-7">
                            <div className="flex items-center gap-2">
                               <SaleStatusBadge refunded={s.refunded} impaye={s.impaye} />
                               {isCloser && s.paymentType === "pif" && (
                                 <Badge className="text-[8px] font-black text-emerald-600 bg-emerald-500/10 border-emerald-500/20 h-5 px-1.5 rounded-sm uppercase tracking-widest">PIF</Badge>
                               )}
                            </div>
                          </TableCell>
                          <TableCell className="py-7 pr-10 text-right">
                            <Button variant="ghost" size="icon" className="h-10 w-10 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all active:scale-90" onClick={() => setSelectedSale(s)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {(isAdmin ? sales.length > adminVisible : sales.length > memberVisible) && (
                    <div className="p-10 text-center border-t border-border/40 bg-muted/5">
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="rounded-2xl px-12 h-12 font-black uppercase tracking-widest text-[10px] text-muted-foreground border-border/60 hover:bg-background hover:text-primary transition-all active:scale-95 shadow-sm"
                        onClick={() => isAdmin ? setAdminVisible(v => v + PAGE_SIZE) : setMemberVisible(v => v + PAGE_SIZE)}
                      >
                        Load More Records ({(isAdmin ? sales.length - adminVisible : sales.length - memberVisible)} remaining)
                      </Button>
                    </div>
                  )}
                </div>
              )}
          </CardContent>
        </Card>
      </div>
      <SaleDetailsDialog sale={selectedSale} open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)} />
    </AppLayout>
  );
};

export default DashboardPage;
