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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp, TrendingDown, AlertTriangle, Wallet, DollarSign, ShoppingCart, Gift, LayoutDashboard, RefreshCw } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import { cn } from "@/lib/utils";
import { useSyncJotform } from "@/hooks/useSyncJotform";
import { toast } from "sonner";
import SaleDetailsDialog from "@/components/SaleDetailsDialog";
import { Sale } from "@/types";

// ─── Shared skeleton loader ───────────────────────────────────────────────────
const CardSkeletons = ({ n = 4 }: { n?: number }) => (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
    {Array.from({ length: n }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
  </div>
);

// ─── Chart card wrapper ───────────────────────────────────────────────────────
const ChartCard = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <Card className="border border-border/60 shadow-card">
    <CardHeader><CardTitle className="text-base">{title}</CardTitle></CardHeader>
    <CardContent>{children}</CardContent>
  </Card>
);

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  border:  "hsl(var(--border))",
  line:    "hsl(213, 50%, 25%)",
};
const PIE_COLORS = ["hsl(201,96%,46%)", "hsl(213,50%,30%)", "hsl(0,84%,60%)", "hsl(38,92%,50%)"];

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

  // ── ADMIN VIEW ─────────────────────────────────────────────────────────────
  if (isAdmin) {
    return (
      <AppLayout>
        <div className="space-y-8">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
              <LayoutDashboard className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">{t("dashboard.title")}</h1>
              <p className="text-sm text-muted-foreground">{t("dashboard.salesSource")}</p>
            </div>
          </div>

          {loading ? <CardSkeletons /> : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <StatCard title={t("dashboard.totalCommissions")} value={fmt(computed.myComm)} subtitle={t("dashboard.trendUp")} trend="up" accent="blue" icon={<Wallet className="h-5 w-5" />} />
              <StatCard title={t("dashboard.closerCommTotal")} value={fmt(computed.totalCloserComm)} subtitle={t("dashboard.closersSetters")} accent="green" icon={<TrendingUp className="h-5 w-5" />} />
              <StatCard title={t("dashboard.refunds")} value={fmt(computed.totalRefunds)} subtitle={`${refunds.length} ${t("dashboard.requests")}`} trend="down" accent="red" icon={<AlertTriangle className="h-5 w-5" />} />
              <StatCard title={t("dashboard.impayes")} value={fmt(computed.totalImpayes)} subtitle={`${impayes.length} ${t("dashboard.ongoing")}`} trend="down" accent="orange" icon={<TrendingDown className="h-5 w-5" />} />
            </div>
          )}

          <div className="grid gap-4 lg:grid-cols-2">
            <ChartCard title={t("dashboard.commByCloser")}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={computed.closerCommData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("dashboard.commByMonth")}>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={computed.monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Line type="monotone" dataKey="commission" stroke={CHART_COLORS.line} strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("dashboard.breakdown")}>
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={computed.pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                    {computed.pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </ChartCard>

            <ChartCard title={t("dashboard.recentCommissions")}>
              {loading ? (
                <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
              ) : sales.length === 0 ? (
                <p className="text-center py-8 text-muted-foreground">{t("dashboard.noData")}</p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("table.date")}</TableHead>
                        <TableHead>{t("table.client")}</TableHead>
                        <TableHead>{t("table.closer")}</TableHead>
                        <TableHead>{t("table.setter")}</TableHead>
                        <TableHead className="text-right">{t("table.closerComm")}</TableHead>
                        <TableHead className="text-right">{t("table.setterComm")}</TableHead>
                        <TableHead>{t("table.status")}</TableHead>
                        <TableHead className="text-right">Details</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.slice(0, adminVisible).map(s => (
                        <TableRow key={s.id}>
                          <TableCell className="text-muted-foreground">{s.date}</TableCell>
                          <TableCell className="font-medium">{s.clientName}</TableCell>
                          <TableCell><ProfileTag role="closer" personId={s.closerId} personName={s.closer} /></TableCell>
                          <TableCell><ProfileTag role="setter" personId={s.setterId} personName={s.setter} /></TableCell>
                          <TableCell className="text-right font-medium">{fmt(s.closerCommission)}</TableCell>
                          <TableCell className="text-right font-medium">{fmt(s.setterCommission)}</TableCell>
                          <TableCell><SaleStatusBadge refunded={s.refunded} impaye={s.impaye} /></TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedSale(s)}>
                              View
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  {sales.length > adminVisible && (
                    <div className="mt-3 text-center">
                      <Button variant="ghost" size="sm" onClick={() => setAdminVisible(v => v + PAGE_SIZE)}>
                        Show more ({sales.length - adminVisible} remaining)
                      </Button>
                    </div>
                  )}
                </div>
              )}
            </ChartCard>
          </div>
        </div>
      </AppLayout>
    );
  }

  // ── CLOSER / SETTER VIEW ───────────────────────────────────────────────────
  const commLabel  = isCloser ? t("table.closerComm") : t("table.setterComm");

  return (
    <AppLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold">{user?.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {t(`role.${user?.role}`)} — {t("dashboard.salesSource")}
            </p>
          </div>
          {isCloser && (
            <Button
              variant="outline"
              size="sm"
              disabled={sync.isPending}
              className="shrink-0 mt-1"
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
                    if (res.errors?.length > 0) {
                      toast.warning(`${res.errors.length} setter(s) not matched`, {
                        description: res.errors.slice(0, 3).join("\n"),
                      });
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
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title={t("detail.totalComm")} value={fmt(computed.myComm)} trend="up" accent="blue" icon={<DollarSign className="h-5 w-5" />} />
            <StatCard title={t("detail.totalSales")} value={String(sales.length)} subtitle={fmt(computed.totalVolume)} accent="green" icon={<ShoppingCart className="h-5 w-5" />} />
            <StatCard title={t("detail.avgComm")} value={fmt(computed.avgComm)} accent="blue" icon={<TrendingUp className="h-5 w-5" />} />
            <StatCard
              title={t("detail.refundsUnpaid")}
              value={`${refunds.length} / ${impayes.length}`}
              subtitle={t("detail.refundsUnpaidSub")}
              trend="down" accent="red"
              icon={<AlertTriangle className="h-5 w-5" />}
            />
          </div>
        )}

        {/* Closer: monthly bonus section */}
        {isCloser && (
          <div className="grid gap-4 lg:grid-cols-2">
            {/* Current month bonus */}
            <Card className="border border-border/60 shadow-card">
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Gift className="h-4 w-4 text-primary" />
                  {t("bonus.currentMonth")}
                </CardTitle>
                {currentMonthBonus && (
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
                      <span className="font-semibold">{currentMonthBonus.validatedCount}</span>
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
                          <span className="ml-1 text-xs">(≥{currentMonthBonus.volumeTier.minSales})</span>
                        )}
                      </span>
                      <span className={cn("font-semibold", currentMonthBonus.volumeBonus > 0 ? "text-success" : "text-muted-foreground")}>
                        {fmt(currentMonthBonus.volumeBonus)}
                      </span>
                    </div>
                    <div className="border-t border-border pt-2 flex justify-between font-bold text-sm">
                      <span>{t("bonus.total")}</span>
                      <span className="text-success text-base">{fmt(currentMonthBonus.total)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Bonus history */}
            <Card className="border border-border/60 shadow-card">
              <CardHeader><CardTitle className="text-base">{t("bonus.history")}</CardTitle></CardHeader>
              <CardContent>
                {bonusHistory.length === 0 ? (
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
        )}

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          {computed.productData.length > 0 && (
            <ChartCard title={t("detail.commByProduct")}>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={computed.productData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[6,6,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </ChartCard>
          )}

          <ChartCard title={t("dashboard.commByMonth")}>
            <ResponsiveContainer width="100%" height={250}>
              <LineChart data={computed.monthlyData}>
                <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                <XAxis dataKey="month" fontSize={12} />
                <YAxis fontSize={12} />
                <Tooltip formatter={(v: number) => fmt(v)} />
                <Line type="monotone" dataKey="commission" stroke={CHART_COLORS.line} strokeWidth={2} dot={{ r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        {/* Sales history */}
        <Card className="border border-border/60 shadow-card">
          <CardHeader><CardTitle className="text-base">{t("detail.salesHistory")}</CardTitle></CardHeader>
          <CardContent>
            {loading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : sales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("dashboard.noData")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.date")}</TableHead>
                      <TableHead>{t("table.client")}</TableHead>
                      <TableHead>{isCloser ? t("table.setter") : t("table.closer")}</TableHead>
                      <TableHead>{t("table.status")}</TableHead>
                      <TableHead className="text-right">{t("table.amount")}</TableHead>
                      <TableHead className="text-right">{commLabel}</TableHead>
                      <TableHead className="text-right">Details</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {sales.slice(0, memberVisible).map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground">{s.date}</TableCell>
                        <TableCell className="font-medium">{s.clientName}</TableCell>
                        <TableCell>
                          {isCloser
                            ? <ProfileTag role="setter" personId={s.setterId} personName={s.setter} />
                            : <ProfileTag role="closer" personId={s.closerId} personName={s.closer} />}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <SaleStatusBadge refunded={s.refunded} impaye={s.impaye} />
                            {isCloser && s.paymentType === "pif" && (
                              <Badge variant="outline" className="text-xs text-primary border-primary/30">PIF</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">{fmt(s.amount)}</TableCell>
                        <TableCell className="text-right font-medium">
                          {fmt(isCloser ? s.closerCommission : s.setterCommission)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button variant="ghost" size="sm" onClick={() => setSelectedSale(s)}>
                            View
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {sales.length > memberVisible && (
                  <div className="mt-3 text-center">
                    <Button variant="ghost" size="sm" onClick={() => setMemberVisible(v => v + PAGE_SIZE)}>
                      Show more ({sales.length - memberVisible} remaining)
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
