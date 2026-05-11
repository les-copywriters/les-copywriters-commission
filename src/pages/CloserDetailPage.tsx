import { useMemo, useState } from "react";
import { useParams, Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import ProfileTag from "@/components/ProfileTag";
import { useSales } from "@/hooks/useSales";
import { useRefunds } from "@/hooks/useRefunds";
import { useBonusTiers } from "@/hooks/useBonusTiers";
import { useCloserFramework } from "@/hooks/useCallAnalysis";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import { monthlyBonusBreakdown, formatMonth } from "@/lib/bonusCalculation";
import AppLayout from "@/components/AppLayout";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import StatCard from "@/components/StatCard";
import { FrameworkDisplay, FrameworkSkeleton } from "@/components/FrameworkDisplay";
import { supabase } from "@/lib/supabase";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, TrendingUp, DollarSign, ShoppingCart, AlertTriangle, Gift, Layers, Eye, LayoutDashboard, Calendar, Wallet, Trophy, Target, BookOpen } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area } from "recharts";
import { cn } from "@/lib/utils";
import SaleDetailsDialog from "@/components/SaleDetailsDialog";
import { Sale } from "@/types";
import BonusTransactionsDialog, { BonusDrilldownKind } from "@/components/BonusTransactionsDialog";

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  secondary: "hsl(var(--secondary))",
  accent: "#10b981",
  border: "rgba(128,128,128,0.12)",
};

const ContentCard = ({ title, icon: Icon, children, className, headerAction }: { title: string; icon?: React.ElementType; children: React.ReactNode; className?: string; headerAction?: React.ReactNode }) => (
  <div className={cn("rounded-xl border border-border/40 overflow-hidden bg-background", className)}>
    <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
      <div className="flex items-center gap-2">
        {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
        <p className="text-sm font-medium">{title}</p>
      </div>
      {headerAction}
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const CloserDetailPage = () => {
  const { name } = useParams<{ name: string }>();
  const { user } = useAuth();
  const { t, locale } = useLanguage();

  const decodedName = decodeURIComponent(name || "");

  // All hooks must be called unconditionally before any early return (React rules of hooks)
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
  const { data: allRefunds = [] } = useRefunds();

  const { data: profileId } = useQuery({
    queryKey: ["profile_id_by_name", decodedName],
    queryFn: async () => {
      if (user?.role === "closer") return user.id;
      const { data } = await supabase
        .from("profiles")
        .select("id")
        .eq("name", decodedName)
        .single();
      return (data as { id: string } | null)?.id ?? null;
    },
    enabled: !!decodedName,
    staleTime: 1000 * 60 * 5,
  });

  const { data: framework, isLoading: loadingFramework } = useCloserFramework(profileId ?? null);

  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);
  const [bonusDialog, setBonusDialog] = useState<{ month: string; kind: BonusDrilldownKind } | null>(null);

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

  // Scope refunds to this closer's sales so timing logic is correct
  const closerSaleIds = useMemo(() => new Set(sales.map(s => s.id)), [sales]);
  const closerRefunds = useMemo(
    () => allRefunds.filter(r => closerSaleIds.has(r.saleId)),
    [allRefunds, closerSaleIds],
  );
  const bonusHistory = useMemo(
    () => monthlyBonusBreakdown(sales, tiers, closerRefunds),
    [sales, tiers, closerRefunds],
  );

  // Redirect after all hooks — closer can only view their own page
  if (user?.role === "closer" && decodedName && decodedName !== user.name) {
    return <Navigate to={`/team/closer/${encodeURIComponent(user.name ?? "")}`} replace />;
  }

  const currentMonthKey   = new Date().toISOString().slice(0, 7);
  const currentMonthBonus = bonusHistory.find(b => b.month === currentMonthKey) ?? null;
  const isCurrentMonth    = currentMonthBonus?.month === currentMonthKey;

  const fmt = (n: number) => formatCurrency(n, locale);
  const loadError = salesLoadFailed || tiersLoadFailed;
  const loadErrorMessage = salesLoadFailed
    ? salesError instanceof Error ? salesError.message : "Failed to load closer details."
    : tiersError instanceof Error ? tiersError.message : "Failed to load bonus tiers.";
  const openBonusDialog = (month: string, kind: BonusDrilldownKind) => setBonusDialog({ month, kind });

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-700">

        {/* Header */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" asChild className="h-9 w-9 rounded-lg bg-muted/20 hover:bg-muted/40 border border-border/40">
              <Link to={user?.role === "closer" ? "/dashboard" : "/team"}><ArrowLeft className="h-4 w-4" /></Link>
            </Button>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("role.closer")}</p>
              <h1 className="text-xl font-semibold">{decodedName}</h1>
            </div>
          </div>

          <Badge variant="outline" className="rounded-md px-3 py-1.5 text-xs font-medium border-border/60">
            {sales.length} Total Transactions
          </Badge>
        </div>

        {loadError && (
          <Alert variant="destructive" className="rounded-lg border-destructive/20 bg-destructive/5">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle className="font-medium">Error loading data</AlertTitle>
            <AlertDescription className="flex flex-col gap-3 pt-1">
              <p className="text-sm">{loadErrorMessage}</p>
              <Button
                size="sm"
                variant="outline"
                className="rounded-lg h-8 w-fit border-destructive/20 text-destructive text-xs"
                onClick={() => { refetchSales(); refetchTiers(); }}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* KPIs */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title={t("detail.totalComm")} value={fmt(totalComm)} accent="blue" icon={<Wallet className="h-4 w-4" />} trend="up" />
            <StatCard title={t("detail.totalSales")} value={String(sales.length)} subtitle={fmt(totalSales)} accent="green" icon={<ShoppingCart className="h-4 w-4" />} />
            <StatCard title={t("detail.avgComm")} value={fmt(avgCommission)} accent="blue" icon={<TrendingUp className="h-4 w-4" />} trend="up" />
            <StatCard title={t("detail.refundsUnpaid")} value={`${refundedSales.length} / ${unpaidSales.length}`} subtitle={t("detail.refundsUnpaidSub")} trend="down" accent="red" icon={<AlertTriangle className="h-4 w-4" />} />
          </div>
        )}

        {/* Bonus & Charts */}
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Current month bonus */}
          <ContentCard title={t("bonus.currentMonth")} icon={Trophy}>
             {!currentMonthBonus || currentMonthBonus.total === 0 ? (
                <div className="text-center py-12">
                   <p className="text-sm text-muted-foreground">{t("bonus.noBonus")}</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {isCurrentMonth && (
                    <div className="bg-primary/5 border border-primary/10 px-3 py-2.5 rounded-lg flex items-center justify-between">
                       <div className="flex items-center gap-2">
                          <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                          <p className="text-xs font-medium text-primary">{formatMonth(currentMonthBonus.month, locale)}</p>
                       </div>
                       <Badge className="rounded-md text-[10px] font-medium">Active Period</Badge>
                    </div>
                  )}
                  <div className="space-y-3">
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">{t("bonus.validatedCount")}</span>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 font-semibold text-sm text-foreground tabular-nums hover:bg-transparent hover:text-primary"
                        onClick={() => openBonusDialog(currentMonthBonus.month, "validatedCount")}
                      >
                        {currentMonthBonus.validatedCount}
                      </Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                         {t("bonus.pifBonus")}
                         <span className="text-[10px] text-muted-foreground/60 ml-1">({currentMonthBonus.pifCount} × €50)</span>
                      </span>
                      <Button
                        variant="ghost"
                        className={cn("h-auto p-0 font-semibold text-sm tabular-nums hover:bg-transparent hover:text-primary", currentMonthBonus.pifBonus > 0 ? "text-emerald-500" : "text-muted-foreground/40")}
                        onClick={() => openBonusDialog(currentMonthBonus.month, "pifBonus")}
                      >
                        {fmt(currentMonthBonus.pifBonus)}
                      </Button>
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-muted-foreground">
                        {t("bonus.volumeBonus")}
                        {currentMonthBonus.volumeTier && (
                          <Badge variant="outline" className="ml-2 rounded-md text-[10px] border-emerald-500/20 text-emerald-500">
                            {currentMonthBonus.volumeTier.minSales}+ Sales
                          </Badge>
                        )}
                      </span>
                      <Button
                        variant="ghost"
                        className={cn("h-auto p-0 font-semibold text-sm tabular-nums hover:bg-transparent hover:text-primary", currentMonthBonus.volumeBonus > 0 ? "text-emerald-500" : "text-muted-foreground/40")}
                        onClick={() => openBonusDialog(currentMonthBonus.month, "volumeBonus")}
                      >
                        {fmt(currentMonthBonus.volumeBonus)}
                      </Button>
                    </div>
                    <div className="pt-3 border-t border-border/40 flex flex-col items-center gap-1 text-center">
                      <span className="text-[11px] text-muted-foreground">{t("bonus.total")}</span>
                      <Button
                        variant="ghost"
                        className="h-auto p-0 text-3xl font-bold text-emerald-500 tabular-nums hover:bg-transparent hover:text-primary"
                        onClick={() => openBonusDialog(currentMonthBonus.month, "total")}
                      >
                        {fmt(currentMonthBonus.total)}
                      </Button>
                    </div>
                  </div>
                </div>
              )}
          </ContentCard>

          {/* Bonus history table */}
          <ContentCard title={t("bonus.history")} icon={Calendar}>
            {bonusHistory.length === 0 ? (
                <div className="text-center py-12">
                   <p className="text-sm text-muted-foreground">{t("common.noData")}</p>
                </div>
              ) : (
                <div className="overflow-hidden rounded-lg border border-border/40">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-none">
                        <TableHead className="py-2.5 pl-4 text-[11px] font-medium text-muted-foreground">{t("bonus.month")}</TableHead>
                        <TableHead className="py-2.5 text-right text-[11px] font-medium text-muted-foreground">PIF</TableHead>
                        <TableHead className="py-2.5 text-right text-[11px] font-medium text-muted-foreground">Volume</TableHead>
                        <TableHead className="py-2.5 pr-4 text-right text-[11px] font-medium text-muted-foreground">Total</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {bonusHistory.map(row => (
                        <TableRow key={row.month} className="hover:bg-muted/20 border-border/20">
                          <TableCell className="py-3 pl-4 text-sm">{formatMonth(row.month, locale)}</TableCell>
                          <TableCell className="py-3 text-right">
                            <Button
                              variant="ghost"
                              className="h-auto p-0 text-muted-foreground text-xs hover:bg-transparent hover:text-primary"
                              onClick={() => openBonusDialog(row.month, "pifBonus")}
                            >
                              {fmt(row.pifBonus)}
                            </Button>
                          </TableCell>
                          <TableCell className="py-3 text-right">
                            <Button
                              variant="ghost"
                              className="h-auto p-0 text-muted-foreground text-xs hover:bg-transparent hover:text-primary"
                              onClick={() => openBonusDialog(row.month, "volumeBonus")}
                            >
                              {fmt(row.volumeBonus)}
                            </Button>
                          </TableCell>
                          <TableCell className="py-3 pr-4 text-right">
                            <Button
                              variant="ghost"
                              className={cn("h-auto p-0 text-sm font-medium tabular-nums hover:bg-transparent hover:text-primary", row.total > 0 ? "text-emerald-500" : "text-muted-foreground/40")}
                              onClick={() => openBonusDialog(row.month, "total")}
                            >
                              {fmt(row.total)}
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

        {/* Analytics & Sales */}
        <div className="grid gap-6 lg:grid-cols-5">
           <ContentCard title={t("detail.commByProduct")} icon={Layers} className="lg:col-span-2">
              {productData.length === 0 ? (
                <div className="text-center py-12">
                   <p className="text-sm text-muted-foreground">No mapping data</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={productData} margin={{ top: 10, right: 10, left: 10, bottom: 40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                    <XAxis
                       dataKey="name"
                       fontSize={10}
                       axisLine={false}
                       tickLine={false}
                       angle={-30}
                       textAnchor="end"
                       height={60}
                       dy={10}
                    />
                    <YAxis
                       fontSize={10}
                       axisLine={false}
                       tickLine={false}
                       tickFormatter={(v) => `€${v}`}
                    />
                    <Tooltip
                      contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, background: "hsl(var(--background))" }}
                      cursor={{ fill: 'rgba(0,0,0,0.03)' }}
                      formatter={(v: number) => [fmt(v), "Product Revenue"]}
                    />
                    <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} barSize={28} />
                  </BarChart>
                </ResponsiveContainer>
              )}
           </ContentCard>

           <ContentCard title={t("detail.salesHistory")} icon={Eye} className="lg:col-span-3">
              {isLoading ? (
                <div className="space-y-3 py-2">{Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}</div>
              ) : sales.length === 0 ? (
                <div className="text-center py-12">
                   <p className="text-sm text-muted-foreground">{t("dashboard.noData")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-none">
                        <TableHead className="py-2.5 pl-4 text-[11px] font-medium text-muted-foreground">{t("table.date")}</TableHead>
                        <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("table.client")}</TableHead>
                        <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("table.status")}</TableHead>
                        <TableHead className="py-2.5 text-right text-[11px] font-medium text-muted-foreground">Commission</TableHead>
                        <TableHead className="py-2.5 pr-4 text-right text-[11px] font-medium text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map(sale => (
                        <TableRow key={sale.id} className="hover:bg-muted/20 border-border/20">
                          <TableCell className="py-3 pl-4 text-xs text-muted-foreground tabular-nums">{sale.date}</TableCell>
                          <TableCell className="py-3">
                            <p className="font-medium text-sm leading-none mb-1">{sale.clientName}</p>
                            <Badge variant="outline" className="rounded-md text-[10px] border-primary/20 text-primary">
                               {sale.product}
                            </Badge>
                          </TableCell>
                          <TableCell className="py-3">
                             <div className="flex items-center gap-1.5">
                               <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                               {sale.paymentType === "pif" && (
                                  <div className="h-4 px-1.5 bg-emerald-500/10 text-emerald-600 rounded-md text-[10px] font-medium flex items-center border border-emerald-500/20">PIF</div>
                               )}
                             </div>
                          </TableCell>
                          <TableCell className="py-3 text-right font-semibold text-primary tabular-nums text-sm">{fmt(sale.closerCommission)}</TableCell>
                          <TableCell className="py-3 pr-4 text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedSale(sale)} className="h-8 w-8 p-0 rounded-lg hover:bg-primary/10 hover:text-primary transition-all">
                              <Eye className="h-3.5 w-3.5" />
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

      {/* My Sales Framework */}
      <ContentCard
        title="My Sales Framework"
        icon={BookOpen}
        headerAction={
          framework ? (
            <Badge variant="outline" className="rounded-md text-[10px] border-emerald-500/20 text-emerald-600 bg-emerald-500/5">
              Generated from {framework.generatedFromCalls.length} call{framework.generatedFromCalls.length !== 1 ? "s" : ""}
            </Badge>
          ) : null
        }
      >
        {loadingFramework ? (
          <FrameworkSkeleton />
        ) : framework ? (
          <FrameworkDisplay markdown={framework.framework} />
        ) : (
          <div className="text-center py-10">
            <BookOpen className="mx-auto h-8 w-8 text-muted-foreground/30 mb-3" />
            <p className="text-sm text-muted-foreground">No framework generated yet</p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Your admin can generate a personalised sales framework from your analyzed calls in the AI Coaching section.
            </p>
          </div>
        )}
      </ContentCard>

      <BonusTransactionsDialog
        month={bonusDialog?.month ?? null}
        kind={bonusDialog?.kind ?? null}
        sales={sales}
        tiers={tiers}
        open={!!bonusDialog}
        onOpenChange={(open) => !open && setBonusDialog(null)}
      />
      <SaleDetailsDialog sale={selectedSale} open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)} />
    </AppLayout>
  );
};

export default CloserDetailPage;
