import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ProfileTag from "@/components/ProfileTag";
import { useSales } from "@/hooks/useSales";
import { useBonusTiers } from "@/hooks/useBonusTiers";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import { monthlyBonusBreakdown, formatMonth } from "@/lib/bonusCalculation";
import AppLayout from "@/components/AppLayout";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, TrendingUp, DollarSign, ShoppingCart, AlertTriangle, Gift, Layers, Eye, LayoutDashboard, Calendar, Wallet, Trophy, Target } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { cn } from "@/lib/utils";
import SaleDetailsDialog from "@/components/SaleDetailsDialog";
import { Sale } from "@/types";

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "#10b981",
  border: "rgba(128,128,128,0.12)",
};

const ContentCard = ({ title, icon: Icon, children, className, headerAction }: { title: string; icon?: any; children: React.ReactNode; className?: string; headerAction?: React.ReactNode }) => (
  <Card className={cn("border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden", className)}>
    <CardHeader className="p-8 border-b border-border/40 flex flex-row items-center justify-between">
      <div className="flex items-center gap-3">
        {Icon && <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>}
        <CardTitle className="font-black text-sm uppercase tracking-widest text-muted-foreground">{title}</CardTitle>
      </div>
      {headerAction}
    </CardHeader>
    <CardContent className="p-8">{children}</CardContent>
  </Card>
);

const CloserDetailPage = () => {
  const { name } = useParams<{ name: string }>();
  const { t, locale } = useLanguage();
  const {
    data: allSales = [],
    isLoading,
    isError: salesLoadFailed,
    error: salesError,
    refetch: refetchSales,
  } = useSales();
  const {
    data: tiers = [],
    isError: tiersLoadFailed,
    error: tiersError,
    refetch: refetchTiers,
  } = useBonusTiers();

  const decodedName = decodeURIComponent(name || "");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const { sales, totalComm, totalSales, refundedSales, unpaidSales, avgCommission, productData, monthlyTrend } = useMemo(() => {
    const sales = allSales.filter(s => s.closer === decodedName);
    let totalComm = 0, totalSales = 0, paidCount = 0;
    const refundedSales: typeof sales = [], unpaidSales: typeof sales = [];
    const productMap = new Map<string, number>();
    const monthMap = new Map<string, number>();

    const sortedSales = [...sales].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    for (const s of sortedSales) {
      totalSales += s.amount;
      const month = s.date.slice(0, 7);
      if (s.refunded) { refundedSales.push(s); }
      else if (s.impaye) { unpaidSales.push(s); }
      else {
        totalComm += s.closerCommission;
        paidCount++;
        productMap.set(s.product, (productMap.get(s.product) || 0) + s.closerCommission);
        monthMap.set(month, (monthMap.get(month) || 0) + s.closerCommission);
      }
    }

    return {
      sales: sortedSales.reverse(),
      totalComm,
      totalSales,
      refundedSales,
      unpaidSales,
      avgCommission: paidCount > 0 ? totalComm / paidCount : 0,
      productData: Array.from(productMap, ([name, commission]) => ({ name, commission })),
      monthlyTrend: Array.from(monthMap, ([month, commission]) => ({ month: formatMonth(month, locale), commission })),
    };
  }, [allSales, decodedName, locale]);

  const bonusHistory = useMemo(
    () => monthlyBonusBreakdown(sales, tiers),
    [sales, tiers]
  );

  const currentMonthBonus = bonusHistory[0] ?? null;
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const isCurrentMonth  = currentMonthBonus?.month === currentMonthKey;

  const fmt = (n: number) => formatCurrency(n, locale);
  const loadError = salesLoadFailed || tiersLoadFailed;
  const loadErrorMessage = salesLoadFailed
    ? salesError instanceof Error ? salesError.message : "Failed to load closer details."
    : tiersError instanceof Error ? tiersError.message : "Failed to load bonus tiers.";

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in duration-700">
        
        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
          <div className="flex items-center gap-6">
            <Button variant="ghost" size="icon" asChild className="h-14 w-14 rounded-[1.25rem] bg-muted/20 hover:bg-muted/40 transition-all border border-border/40">
              <Link to="/team"><ArrowLeft className="h-6 w-6" /></Link>
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 className="text-3xl font-black tracking-tight">{decodedName}</h1>
                <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black uppercase tracking-widest text-[9px] px-3 py-1 rounded-full">
                  {t("role.closer")}
                </Badge>
              </div>
              <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px] mt-1.5 flex items-center gap-2">
                <Target className="h-3 w-3" /> Professional Performance Intelligence
              </p>
            </div>
          </div>
          
          <div className="flex items-center gap-3 w-full lg:w-auto">
             <div className="flex -space-x-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 w-10 rounded-full border-4 border-background bg-muted flex items-center justify-center text-[10px] font-black">
                    {decodedName[i]?.toUpperCase()}
                  </div>
                ))}
             </div>
             <Badge className="h-12 px-8 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-xl shadow-primary/20 text-xs">
                {sales.length} Total Transactions
             </Badge>
          </div>
        </div>

        {loadError && (
          <Alert variant="destructive" className="rounded-[2.5rem] border-none shadow-2xl bg-rose-500/10 p-8">
            <AlertTriangle className="h-6 w-6 text-rose-500" />
            <AlertTitle className="font-black uppercase tracking-widest text-rose-500 text-lg">System Data Interrupt</AlertTitle>
            <AlertDescription className="space-y-6 pt-4">
              <p className="font-medium opacity-90 leading-relaxed max-w-2xl">{loadErrorMessage}</p>
              <Button
                size="sm"
                variant="outline"
                className="h-11 rounded-xl border-rose-500/20 text-rose-500 font-black uppercase tracking-widest text-[10px] px-8 hover:bg-rose-500 hover:text-white transition-all"
                onClick={() => { refetchSales(); refetchTiers(); }}
              >
                Reconnect to Database
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* KPIs */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-[2rem]" />)}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title={t("detail.totalComm")} value={fmt(totalComm)} accent="blue" icon={<Wallet className="h-5 w-5" />} trend="up" />
            <StatCard title={t("detail.totalSales")} value={String(sales.length)} subtitle={fmt(totalSales)} accent="green" icon={<ShoppingCart className="h-5 w-5" />} />
            <StatCard title={t("detail.avgComm")} value={fmt(avgCommission)} accent="blue" icon={<TrendingUp className="h-5 w-5" />} trend="up" />
            <StatCard title={t("detail.refundsUnpaid")} value={`${refundedSales.length} / ${unpaidSales.length}`} subtitle={t("detail.refundsUnpaidSub")} trend="down" accent="red" icon={<AlertTriangle className="h-5 w-5" />} />
          </div>
        )}

        {/* Bonus & Charts */}
        <div className="grid gap-8 lg:grid-cols-2">
          {/* Current month bonus */}
          <ContentCard title={t("bonus.currentMonth")} icon={Trophy} className="bg-gradient-to-br from-background via-background to-primary/5">
             {!currentMonthBonus || currentMonthBonus.total === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 text-center space-y-6 grayscale opacity-40">
                   <div className="h-20 w-20 rounded-[1.5rem] bg-muted/40 flex items-center justify-center text-muted-foreground/30">
                      <Gift className="h-10 w-10" />
                   </div>
                   <p className="text-sm text-muted-foreground font-black uppercase tracking-widest">{t("bonus.noBonus")}</p>
                </div>
              ) : (
                <div className="space-y-8">
                  {isCurrentMonth && (
                    <div className="bg-primary/5 border border-primary/10 p-6 rounded-[1.5rem] flex items-center justify-between shadow-inner">
                       <div className="flex items-center gap-3">
                          <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
                          <p className="text-[10px] font-black uppercase tracking-widest text-primary">{formatMonth(currentMonthBonus.month, locale)}</p>
                       </div>
                       <Badge className="bg-primary text-white font-black uppercase tracking-widest text-[8px] px-3 py-0.5 rounded-full">Active Period</Badge>
                    </div>
                  )}
                  <div className="space-y-6">
                    <div className="flex justify-between items-center group">
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">{t("bonus.validatedCount")}</span>
                      <span className="font-black text-lg text-foreground tabular-nums">{currentMonthBonus.validatedCount}</span>
                    </div>
                    <div className="flex justify-between items-center group">
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                         {t("bonus.pifBonus")} 
                         <span className="text-[9px] font-bold text-primary/40 ml-2">({currentMonthBonus.pifCount} × €50)</span>
                      </span>
                      <span className={cn("font-black text-lg tabular-nums", currentMonthBonus.pifBonus > 0 ? "text-emerald-500" : "text-muted-foreground/30")}>
                        {fmt(currentMonthBonus.pifBonus)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center group">
                      <span className="text-xs font-black uppercase tracking-widest text-muted-foreground/60">
                        {t("bonus.volumeBonus")}
                        {currentMonthBonus.volumeTier && (
                          <Badge variant="outline" className="ml-3 text-[8px] font-black border-emerald-500/20 text-emerald-500 uppercase px-2 py-0">
                            {currentMonthBonus.volumeTier.minSales}+ Sales
                          </Badge>
                        )}
                      </span>
                      <span className={cn("font-black text-lg tabular-nums", currentMonthBonus.volumeBonus > 0 ? "text-emerald-500" : "text-muted-foreground/30")}>
                        {fmt(currentMonthBonus.volumeBonus)}
                      </span>
                    </div>
                    <div className="pt-8 border-t border-border/40 flex flex-col items-center gap-2 text-center">
                      <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/40">{t("bonus.total")} Estimated Reward</span>
                      <span className="text-5xl font-black text-emerald-500 tabular-nums tracking-tighter drop-shadow-sm">{fmt(currentMonthBonus.total)}</span>
                    </div>
                  </div>
                </div>
              )}
          </ContentCard>

          {/* Bonus history table */}
          <ContentCard title={t("bonus.history")} icon={Calendar}>
            {bonusHistory.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 grayscale opacity-40 text-center space-y-6">
                   <div className="h-20 w-20 rounded-[1.5rem] bg-muted/40 flex items-center justify-center">
                      <LayoutDashboard className="h-10 w-10 text-muted-foreground/30" />
                   </div>
                   <p className="text-sm text-muted-foreground font-black uppercase tracking-widest">{t("common.noData")}</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-[2rem] border border-border/40 bg-muted/5">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-none">
                        <TableHead className="py-5 pl-8 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("bonus.month")}</TableHead>
                        <TableHead className="py-5 text-right text-[9px] font-black uppercase tracking-widest text-muted-foreground">PIF</TableHead>
                        <TableHead className="py-5 text-right text-[9px] font-black uppercase tracking-widest text-muted-foreground">Volume</TableHead>
                        <TableHead className="py-5 pr-8 text-right text-[9px] font-black uppercase tracking-widest text-muted-foreground">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bonusHistory.map(row => (
                        <TableRow key={row.month} className="hover:bg-muted/10 transition-all group border-border/30">
                          <TableCell className="py-6 pl-8 font-black text-sm tracking-tight">{formatMonth(row.month, locale)}</TableCell>
                          <TableCell className="py-6 text-right text-muted-foreground font-bold tabular-nums text-xs">{fmt(row.pifBonus)}</TableCell>
                          <TableCell className="py-6 text-right text-muted-foreground font-bold tabular-nums text-xs">{fmt(row.volumeBonus)}</TableCell>
                          <TableCell className={cn("py-6 pr-8 text-right font-black tabular-nums text-sm transition-transform group-hover:scale-110", row.total > 0 ? "text-emerald-500" : "text-muted-foreground/30")}>
                            {fmt(row.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
          </ContentCard>
        </div>

        {/* Analytics & Sales */}
        <div className="grid gap-8 lg:grid-cols-5">
           <ContentCard title={t("detail.commByProduct")} icon={Layers} className="lg:col-span-2">
              {productData.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 grayscale opacity-40 text-center space-y-6">
                   <div className="h-20 w-20 rounded-[1.5rem] bg-muted/40 flex items-center justify-center">
                      <Layers className="h-10 w-10 text-muted-foreground/30" />
                   </div>
                   <p className="text-sm text-muted-foreground font-black uppercase tracking-widest">No mapping data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={340}>
                  <BarChart data={productData} margin={{ top: 20, right: 10, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                    <XAxis 
                       dataKey="name" 
                       fontSize={10} 
                       style={{ fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em' }} 
                       axisLine={false} 
                       tickLine={false} 
                       angle={-30} 
                       textAnchor="end" 
                       height={60} 
                       dy={10}
                    />
                    <YAxis 
                       fontSize={10} 
                       style={{ fontWeight: 800 }} 
                       axisLine={false} 
                       tickLine={false} 
                       tickFormatter={(v) => `€${v}`} 
                    />
                    <Tooltip 
                      contentStyle={{ borderRadius: '20px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.2)', fontWeight: '900', background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))', padding: '16px' }}
                      cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                      formatter={(v: number) => [fmt(v), "Product Revenue"]} 
                    />
                    <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[8, 8, 0, 0]} barSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              )}
           </ContentCard>

           <ContentCard title={t("detail.salesHistory")} icon={Eye} className="lg:col-span-3">
              {isLoading ? (
                <div className="space-y-6 py-4">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-16 w-full rounded-2xl" />)}</div>
              ) : sales.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-20 grayscale opacity-40 text-center space-y-6">
                   <div className="h-20 w-20 rounded-[1.5rem] bg-muted/40 flex items-center justify-center">
                      <ShoppingCart className="h-10 w-10 text-muted-foreground/30" />
                   </div>
                   <p className="text-sm text-muted-foreground font-black uppercase tracking-widest">{t("dashboard.noData")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-8 sm:mx-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-none">
                        <TableHead className="py-5 pl-8 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("table.date")}</TableHead>
                        <TableHead className="py-5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("table.client")}</TableHead>
                        <TableHead className="py-5 text-[9px] font-black uppercase tracking-widest text-muted-foreground">{t("table.status")}</TableHead>
                        <TableHead className="py-5 text-right text-[9px] font-black uppercase tracking-widest text-muted-foreground">Commission</TableHead>
                        <TableHead className="py-5 pr-8 text-right text-[9px] font-black uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map(sale => (
                        <TableRow key={sale.id} className="group hover:bg-muted/10 transition-all border-border/30">
                          <TableCell className="py-6 pl-8 text-xs font-black text-muted-foreground/60 tabular-nums italic">{sale.date}</TableCell>
                          <TableCell className="py-6">
                            <p className="font-black text-sm tracking-tight leading-none mb-1.5">{sale.clientName}</p>
                            <Badge variant="outline" className="text-[8px] font-black border-primary/20 text-primary uppercase h-4 px-1.5 rounded-sm">
                               {sale.product}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-6">
                             <div className="flex items-center gap-2">
                               <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                               {sale.paymentType === "pif" && (
                                  <div className="h-5 px-2 bg-emerald-500/10 text-emerald-600 rounded text-[8px] font-black uppercase tracking-widest flex items-center border border-emerald-500/20 shadow-sm">PIF</div>
                               )}
                             </div>
                          </TableCell>
                          <TableCell className="py-6 text-right font-black text-primary tabular-nums text-base">{fmt(sale.closerCommission)}</TableCell>
                          <TableCell className="py-6 pr-8 text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedSale(sale)} className="h-10 w-10 p-0 rounded-2xl hover:bg-primary/10 hover:text-primary transition-all active:scale-90">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
           </ContentCard>
        </div>
      </div>
      <SaleDetailsDialog sale={selectedSale} open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)} />
    </AppLayout>
  );
};

export default CloserDetailPage;
