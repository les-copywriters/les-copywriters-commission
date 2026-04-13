import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/formatCurrency";
import { useSales } from "@/hooks/useSales";
import { useRefunds } from "@/hooks/useRefunds";
import { useImpayes } from "@/hooks/useImpayes";
import { useBonusTiers } from "@/hooks/useBonusTiers";
import { useLanguage } from "@/i18n";
import { useAuth } from "@/context/AuthContext";
import { monthlyBonusBreakdown, formatMonth } from "@/lib/bonusCalculation";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import ProfileTag from "@/components/ProfileTag";
import { Button } from "@/components/ui/button";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, AlertTriangle, Wallet, DollarSign, ShoppingCart, Gift, LayoutDashboard, RefreshCw, Eye, ArrowRight, Activity } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line, AreaChart, Area
} from "recharts";
import { cn } from "@/lib/utils";
import { useSyncJotform } from "@/hooks/useSyncJotform";
import { toast } from "sonner";
import SaleDetailsDialog from "@/components/SaleDetailsDialog";
import { Sale } from "@/types";

// ─── Shared skeleton loader ───────────────────────────────────────────────────
const CardSkeletons = ({ n = 4 }: { n?: number }) => (
  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
  </div>
);

// ─── Chart card wrapper ───────────────────────────────────────────────────────
const ChartCard = ({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) => (
  <Card className="border-none shadow-sm bg-background/50 backdrop-blur-sm overflow-hidden rounded-3xl">
    <div className="p-6 pb-0 flex items-center gap-2">
      {Icon && <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>}
      <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{title}</h3>
    </div>
    <CardContent className="p-6">{children}</CardContent>
  </Card>
);

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  border:  "rgba(128,128,128,0.12)",
  line:    "hsl(var(--primary))",
};
const PIE_COLORS = ["#3b82f6", "#10b981", "#ef4444", "#f59e0b"];

// ─── Main component ───────────────────────────────────────────────────────────
const DashboardPage = () => {
  const { t, locale } = useLanguage();
  const { user }      = useAuth();
  const { data: allSales   = [], isLoading: loadingSales   } = useSales();
  const { data: allRefunds = [], isLoading: loadingRefunds } = useRefunds();
  const { data: allImpayes = [], isLoading: loadingImpayes } = useImpayes();
  const { data: tiers = [] } = useBonusTiers();
  const sync = useSyncJotform();

  const isAdmin  = user?.role === "admin";
  const isCloser = user?.role === "closer";
  const isSetter = user?.role === "setter";

  const PAGE_SIZE = 10;
  const [adminVisible,  setAdminVisible]  = useState(PAGE_SIZE);
  const [memberVisible, setMemberVisible] = useState(PAGE_SIZE);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

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
        const month = new Date(s.date).getMonth() + 1;
        monthlyMap.set(month, (monthlyMap.get(month) ?? 0) + myComm);
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
      return { month: monthLabels[m], commission: monthlyMap.get(m) ?? 0 };
    });

    return {
      totalCloserComm, totalSetterComm, totalVolume, totalRefunds, totalImpayes,
      myComm, avgComm,
      closerCommData:  Array.from(closerCommMap, ([name, commission]) => ({ name, commission })),
      productData:     Array.from(productMap,    ([name, commission]) => ({ name, commission })),
      monthlyData,
      pieData: [
        { name: t("dashboard.closerComm"), value: totalCloserComm },
        { name: t("dashboard.setterComm"), value: totalSetterComm },
        { name: t("dashboard.refunds"),    value: totalRefunds },
        { name: t("dashboard.impayes"),    value: totalImpayes },
      ],
    };
  }, [sales, refunds, impayes, isCloser, isSetter, locale, t]);

  // Closer: monthly bonus history
  const bonusHistory     = useMemo(() => isCloser ? monthlyBonusBreakdown(sales, tiers) : [], [sales, tiers, isCloser]);
  const currentMonthKey  = new Date().toISOString().slice(0, 7);
  const currentMonthBonus = bonusHistory.find(b => b.month === currentMonthKey) ?? bonusHistory[0] ?? null;

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in duration-500">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
              <LayoutDashboard className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight">{isAdmin ? t("dashboard.title") : user?.name}</h1>
              <p className="text-sm text-muted-foreground font-medium">
                {isAdmin ? t("dashboard.salesSource") : `${t(`role.${user?.role}`)} — ${t("dashboard.salesSource")}`}
              </p>
            </div>
          </div>
          
          {!isAdmin && isCloser && (
            <Button
              variant="outline"
              size="sm"
              disabled={sync.isPending}
              className="rounded-xl h-10 px-4 font-bold border-border/60 hover:bg-primary/5 transition-all active:scale-95"
              onClick={() =>
                sync.mutate(undefined, {
                  onSuccess: (res) => {
                    const updated = res.updated ?? 0;
                    if (res.imported > 0 || updated > 0) {
                      toast.success(
                        [
                          res.imported > 0 ? `${res.imported} ${t("sync.imported")}` : null,
                          updated > 0 ? `${updated} setter(s) updated` : null,
                        ].filter(Boolean).join(" · ")
                      );
                    } else {
                      toast.info(t("sync.upToDate"));
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
        </div>

        {/* Stat cards */}
        {loading ? <CardSkeletons /> : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard 
              title={isAdmin ? t("dashboard.totalCommissions") : t("detail.totalComm")} 
              value={fmt(computed.myComm)} 
              subtitle={isAdmin ? t("dashboard.trendUp") : undefined}
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
              title={isAdmin ? t("dashboard.refunds") : t("detail.avgComm")} 
              value={isAdmin ? fmt(computed.totalRefunds) : fmt(computed.avgComm)} 
              subtitle={isAdmin ? `${refunds.length} ${t("dashboard.requests")}` : undefined}
              trend={isAdmin ? "down" : "up"} 
              accent={isAdmin ? "red" : "blue"} 
              icon={isAdmin ? <AlertTriangle className="h-5 w-5" /> : <TrendingUp className="h-5 w-5" />} 
            />
            <StatCard 
              title={isAdmin ? t("dashboard.impayes") : t("detail.refundsUnpaid")} 
              value={isAdmin ? fmt(computed.totalImpayes) : `${refunds.length} / ${impayes.length}`} 
              subtitle={isAdmin ? `${impayes.length} ${t("dashboard.ongoing")}` : t("detail.refundsUnpaidSub")} 
              trend="down" 
              accent={isAdmin ? "orange" : "red"} 
              icon={isAdmin ? <TrendingDown className="h-5 w-5" /> : <AlertTriangle className="h-5 w-5" />} 
            />
          </div>
        )}

        {/* Bonus Highlights for Closers */}
        {!isAdmin && isCloser && (
          <div className="grid gap-6 lg:grid-cols-2">
            <Card className="border-none shadow-premium bg-primary text-white overflow-hidden rounded-[2.5rem] relative group transition-all duration-500 hover:shadow-primary/20">
              <div className="absolute top-0 right-0 p-8 opacity-20 transform group-hover:scale-110 transition-transform">
                <Gift className="h-32 w-32" />
              </div>
              <CardContent className="p-8 relative">
                <div className="flex items-center gap-2 mb-6">
                  <Badge className="bg-white/20 hover:bg-white/30 text-white border-none font-bold px-3 py-1">
                    {formatMonth(currentMonthBonus?.month || currentMonthKey, locale)}
                  </Badge>
                  <p className="text-sm font-black uppercase tracking-widest text-primary-foreground/80">{t("bonus.currentMonth")}</p>
                </div>
                
                {!currentMonthBonus || currentMonthBonus.total === 0 ? (
                  <div className="py-2">
                    <p className="text-xl font-bold opacity-80">{t("bonus.noBonus")}</p>
                    <p className="mt-2 text-primary-foreground/60 text-sm">Keep up the good work to earn bonuses!</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    <div>
                      <p className="text-4xl font-black tabular-nums tracking-tighter mb-2">{fmt(currentMonthBonus.total)}</p>
                      <p className="text-[10px] font-bold text-primary-foreground/80 uppercase tracking-widest">Estimated Bonus</p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 border-t border-white/10 pt-6">
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/60 mb-1">PIF Bonus</p>
                        <p className="font-bold text-lg">{fmt(currentMonthBonus.pifBonus)}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-black uppercase tracking-widest text-primary-foreground/60 mb-1">Vol. Bonus</p>
                        <p className="font-bold text-lg">{fmt(currentMonthBonus.volumeBonus)}</p>
                      </div>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-none shadow-sm rounded-[2.5rem] bg-background overflow-hidden">
               <div className="p-6 border-b border-border/40 flex items-center justify-between">
                  <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{t("bonus.history")}</h3>
                  <Badge variant="outline" className="border-primary/20 text-primary font-bold">{bonusHistory.length} months</Badge>
               </div>
               <CardContent className="p-0">
                  <div className="overflow-auto max-h-[300px]">
                    <Table>
                      <TableBody>
                        {bonusHistory.map(row => (
                          <TableRow key={row.month} className="hover:bg-muted/10 border-border/30">
                            <TableCell className="font-bold pl-6 text-sm py-4">{formatMonth(row.month, locale)}</TableCell>
                            <TableCell className="py-4">
                               <div className="flex flex-col">
                                 <span className="text-[10px] font-black text-muted-foreground uppercase leading-none mb-1">Total</span>
                                 <span className={cn("font-black tabular-nums", row.total > 0 ? "text-emerald-500" : "text-muted-foreground")}>
                                     {fmt(row.total)}
                                 </span>
                               </div>
                            </TableCell>
                            <TableCell className="pr-6 text-right py-4">
                               <ArrowRight className="h-4 w-4 text-muted-foreground/30 ml-auto" />
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
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Main Chart */}
          <ChartCard title={isAdmin ? t("dashboard.commByCloser") : t("detail.commByProduct")} icon={Activity}>
             <ResponsiveContainer width="100%" height={300}>
                <AreaChart data={isAdmin ? computed.closerCommData : computed.productData}>
                  <defs>
                    <linearGradient id="colorComm" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                  <XAxis dataKey="name" fontSize={10} font-weight="700" axisLine={false} tickLine={false} dy={10} />
                  <YAxis fontSize={10} font-weight="700" axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)', fontWeight: 'bold', background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}
                    formatter={(v: number) => fmt(v)} 
                  />
                  <Area 
                    type="monotone" 
                    dataKey="commission" 
                    stroke={CHART_COLORS.line} 
                    strokeWidth={3} 
                    fillOpacity={1} 
                    fill="url(#colorComm)" 
                    animationDuration={2000}
                  />
                </AreaChart>
             </ResponsiveContainer>
          </ChartCard>

          {/* Secondary Chart/Breakdown */}
          <ChartCard title={t("dashboard.commByMonth")} icon={TrendingUp}>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={computed.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                  <XAxis dataKey="month" fontSize={10} font-weight="700" axisLine={false} tickLine={false} dy={10} />
                  <YAxis fontSize={10} font-weight="700" axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)', fontWeight: 'bold', background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}
                    formatter={(v: number) => fmt(v)} 
                  />
                  <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[6,6,0,0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Data Table */}
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
          <div className="p-8 flex items-center justify-between border-b border-border/40">
             <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">
               {isAdmin ? t("dashboard.recentCommissions") : t("detail.salesHistory")}
             </h3>
             <Badge variant="outline" className="border-primary/20 text-primary font-bold px-3 py-1">
               Showing {isAdmin ? adminVisible : memberVisible} records
             </Badge>
          </div>
          <CardContent className="p-0">
             {loading ? (
                <div className="p-8 space-y-4">
                  {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
                </div>
              ) : sales.length === 0 ? (
                <div className="text-center py-20">
                  <p className="text-muted-foreground font-medium italic">{t("dashboard.noData")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-none">
                        <TableHead className="py-4 pl-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.date")}</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.client")}</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">
                          {isAdmin ? t("table.closer") : (isCloser ? t("table.setter") : t("table.closer"))}
                        </TableHead>
                        <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.amount")}</TableHead>
                        <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Commission</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.status")}</TableHead>
                        <TableHead className="py-4 pr-8 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.slice(0, isAdmin ? adminVisible : memberVisible).map(s => (
                        <TableRow key={s.id} className="group hover:bg-muted/10 transition-colors border-border/30">
                          <TableCell className="py-5 pl-8 text-xs font-medium text-muted-foreground tabular-nums">{s.date}</TableCell>
                          <TableCell className="py-5">
                            <div className="flex flex-col">
                              <p className="font-bold text-sm tracking-tight">{s.clientName}</p>
                              {s.clientEmail && <p className="text-[10px] text-muted-foreground line-clamp-1 italic">{s.clientEmail}</p>}
                            </div>
                          </TableCell>
                          <TableCell className="py-5">
                             {isAdmin ? (
                               <ProfileTag role="closer" personId={s.closerId} personName={s.closer} />
                             ) : (
                               isCloser 
                                ? <ProfileTag role="setter" personId={s.setterId} personName={s.setter} />
                                : <ProfileTag role="closer" personId={s.closerId} personName={s.closer} />
                             )}
                          </TableCell>
                          <TableCell className="py-5 text-right font-medium text-sm tabular-nums">{fmt(s.amount)}</TableCell>
                          <TableCell className="py-5 text-right font-black text-primary tabular-nums">
                            {fmt(isCloser ? s.closerCommission : (isSetter ? s.setterCommission : s.closerCommission))}
                          </TableCell>
                          <TableCell className="py-5">
                            <div className="flex items-center gap-2">
                               <SaleStatusBadge refunded={s.refunded} impaye={s.impaye} />
                               {isCloser && s.paymentType === "pif" && (
                                 <Badge variant="outline" className="text-[9px] font-black text-primary bg-primary/5 border-primary/20 h-5 px-1.5 uppercase">PIF</Badge>
                               )}
                            </div>
                          </TableCell>
                          <TableCell className="py-5 pr-8 text-right">
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted opacity-20 group-hover:opacity-100 transition-opacity" onClick={() => setSelectedSale(s)}>
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  
                  {(isAdmin ? sales.length > adminVisible : sales.length > memberVisible) && (
                    <div className="p-8 text-center border-t border-border/40">
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="rounded-xl px-10 font-bold text-muted-foreground hover:bg-muted/50 transition-all"
                        onClick={() => isAdmin ? setAdminVisible(v => v + PAGE_SIZE) : setMemberVisible(v => v + PAGE_SIZE)}
                      >
                        Show more ({(isAdmin ? sales.length - adminVisible : sales.length - memberVisible)} remaining)
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
