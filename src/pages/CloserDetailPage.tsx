import { useMemo } from "react";
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
import { ArrowLeft, TrendingUp, DollarSign, ShoppingCart, AlertTriangle, Gift } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";

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

  const { sales, totalComm, totalSales, refundedSales, unpaidSales, avgCommission, productData } = useMemo(() => {
    const sales = allSales.filter(s => s.closer === decodedName);
    let totalComm = 0, totalSales = 0, paidCount = 0;
    const refundedSales: typeof sales = [], unpaidSales: typeof sales = [];
    const productMap = new Map<string, number>();

    for (const s of sales) {
      totalSales += s.amount;
      if (s.refunded) { refundedSales.push(s); }
      else if (s.impaye) { unpaidSales.push(s); }
      else {
        totalComm += s.closerCommission;
        paidCount++;
        productMap.set(s.product, (productMap.get(s.product) || 0) + s.closerCommission);
      }
    }

    return {
      sales,
      totalComm,
      totalSales,
      refundedSales,
      unpaidSales,
      avgCommission: paidCount > 0 ? totalComm / paidCount : 0,
      productData: Array.from(productMap, ([name, commission]) => ({ name, commission })),
    };
  }, [allSales, decodedName]);

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
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/team"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{decodedName}</h1>
            <p className="text-sm text-muted-foreground">{t("role.closer")} — {t("detail.performance")}</p>
          </div>
        </div>

        {loadError ? (
          <Alert variant="destructive">
            <AlertTitle>Unable to load closer data</AlertTitle>
            <AlertDescription className="space-y-3">
              <p>{loadErrorMessage}</p>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  refetchSales();
                  refetchTiers();
                }}
              >
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        ) : isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title={t("detail.totalComm")} value={fmt(totalComm)} accent="blue" icon={<DollarSign className="h-5 w-5" />} />
            <StatCard title={t("detail.totalSales")} value={String(sales.length)} subtitle={fmt(totalSales)} accent="green" icon={<ShoppingCart className="h-5 w-5" />} />
            <StatCard title={t("detail.avgComm")} value={fmt(avgCommission)} accent="blue" icon={<TrendingUp className="h-5 w-5" />} />
            <StatCard title={t("detail.refundsUnpaid")} value={`${refundedSales.length} / ${unpaidSales.length}`} subtitle={t("detail.refundsUnpaidSub")} trend="down" accent="red" icon={<AlertTriangle className="h-5 w-5" />} />
          </div>
        )}

        {/* ── Monthly bonus breakdown ───────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          {/* Current month bonus */}
          <Card className="border border-border/60 shadow-card">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                {t("bonus.currentMonth")}
              </CardTitle>
              {isCurrentMonth && currentMonthBonus && (
                <Badge variant="outline" className="text-xs">
                  {formatMonth(currentMonthBonus.month, locale)}
                </Badge>
              )}
            </CardHeader>
            <CardContent>
              {!currentMonthBonus || currentMonthBonus.total === 0 ? (
                <p className="text-sm text-muted-foreground py-2">{t("bonus.noBonus")}</p>
              ) : (
                <div className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("bonus.validatedCount")}</span>
                    <span className="font-semibold">{currentMonthBonus.validatedCount} {t("detail.totalSales").toLowerCase()}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">{t("bonus.pifBonus")} ({currentMonthBonus.pifCount} × €50)</span>
                    <span className={cn("font-semibold", currentMonthBonus.pifBonus > 0 ? "text-success" : "text-muted-foreground")}>
                      {fmt(currentMonthBonus.pifBonus)}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">
                      {t("bonus.volumeBonus")}
                      {currentMonthBonus.volumeTier && (
                        <span className="ml-1 text-xs text-muted-foreground">
                          (≥{currentMonthBonus.volumeTier.minSales} {t("detail.totalSales").toLowerCase()})
                        </span>
                      )}
                    </span>
                    <span className={cn("font-semibold", currentMonthBonus.volumeBonus > 0 ? "text-success" : "text-muted-foreground")}>
                      {fmt(currentMonthBonus.volumeBonus)}
                    </span>
                  </div>
                  <div className="border-t border-border pt-2 flex justify-between text-sm font-bold">
                    <span>{t("bonus.total")}</span>
                    <span className="text-success text-base">{fmt(currentMonthBonus.total)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Bonus history table */}
          <Card className="border border-border/60 shadow-card">
            <CardHeader><CardTitle className="text-base">{t("bonus.history")}</CardTitle></CardHeader>
            <CardContent>
              {loadError ? (
                <p className="text-sm text-muted-foreground py-2">Unable to load bonus history.</p>
              ) : bonusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">{t("common.noData")}</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("bonus.month")}</TableHead>
                      <TableHead className="text-right">{t("bonus.pifBonus")}</TableHead>
                      <TableHead className="text-right">{t("bonus.volumeBonus")}</TableHead>
                      <TableHead className="text-right">{t("bonus.total")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {bonusHistory.map(row => (
                      <TableRow key={row.month}>
                        <TableCell className="font-medium">{formatMonth(row.month, locale)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(row.pifBonus)}</TableCell>
                        <TableCell className="text-right text-muted-foreground">{fmt(row.volumeBonus)}</TableCell>
                        <TableCell className={cn("text-right font-bold", row.total > 0 ? "text-success" : "")}>
                          {fmt(row.total)}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </div>

        {productData.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">{t("detail.commByProduct")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={productData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="commission" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">{t("detail.salesHistory")}</CardTitle></CardHeader>
          <CardContent>
            {loadError ? (
              <p className="text-center py-8 text-muted-foreground">Unable to load sales history.</p>
            ) : isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : sales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("dashboard.noData")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.date")}</TableHead>
                      <TableHead>{t("table.client")}</TableHead>
                      <TableHead>{t("table.setter")}</TableHead>
                      <TableHead>{t("table.status")}</TableHead>
                      <TableHead className="text-right">{t("table.amount")}</TableHead>
                      <TableHead className="text-right">{t("table.closerComm")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.map(sale => (
                      <TableRow key={sale.id}>
                        <TableCell className="text-muted-foreground">{sale.date}</TableCell>
                        <TableCell className="font-medium">{sale.clientName}</TableCell>
                        <TableCell><ProfileTag role="setter" personId={sale.setterId} personName={sale.setter} /></TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                            {sale.paymentType === "pif" && (
                              <Badge variant="outline" className="text-xs text-primary border-primary/30">PIF</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{fmt(sale.amount)}</TableCell>
                        <TableCell className="text-right font-medium">{fmt(sale.closerCommission)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default CloserDetailPage;
