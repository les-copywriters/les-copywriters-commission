import { useState, useMemo } from "react";
import { useSales } from "@/hooks/useSales";
import { useBonusTiers } from "@/hooks/useBonusTiers";
import { useProfiles } from "@/hooks/useProfiles";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import { formatMonth } from "@/lib/bonusCalculation";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import SetterTag from "@/components/SetterTag";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { DollarSign, ShoppingCart, TrendingUp, AlertTriangle, Target, Percent, Gift, X } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, LineChart, Line,
} from "recharts";
import { cn } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type DatePreset = "thisMonth" | "lastMonth" | "last3m" | "last6m" | "thisYear" | "allTime" | "custom";
type PaymentFilter = "all" | "pif" | "installments";
type StatusFilter  = "all" | "paid" | "refunded" | "unpaid";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeDateRange(preset: DatePreset, customStart: string, customEnd: string) {
  const now   = new Date();
  const today = now.toISOString().slice(0, 10);
  switch (preset) {
    case "thisMonth":  return { start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), end: today };
    case "lastMonth":  return { start: new Date(now.getFullYear(), now.getMonth() - 1, 1).toISOString().slice(0, 10), end: new Date(now.getFullYear(), now.getMonth(), 0).toISOString().slice(0, 10) };
    case "last3m":     return { start: new Date(now.getFullYear(), now.getMonth() - 2, 1).toISOString().slice(0, 10), end: today };
    case "last6m":     return { start: new Date(now.getFullYear(), now.getMonth() - 5, 1).toISOString().slice(0, 10), end: today };
    case "thisYear":   return { start: `${now.getFullYear()}-01-01`, end: today };
    case "allTime":    return { start: "2000-01-01", end: today };
    case "custom":     return { start: customStart || "2000-01-01", end: customEnd || today };
  }
}

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  border:  "hsl(var(--border))",
  line:    "hsl(213,50%,25%)",
};
const PRODUCTS = ["Formation Pro", "Coaching Premium", "Mastermind"];

// ─── Main component ───────────────────────────────────────────────────────────
const AnalyticsPage = () => {
  const { t, locale } = useLanguage();
  const { user }      = useAuth();
  const { data: allSales = [], isLoading } = useSales();
  const { data: tiers    = [] }            = useBonusTiers();
  const { data: profiles = [] }            = useProfiles();

  const isAdmin  = user?.role === "admin";
  const isCloser = user?.role === "closer";
  const isSetter = user?.role === "setter";

  // ── Filter state ────────────────────────────────────────────────────────────
  const [datePreset,       setDatePreset]       = useState<DatePreset>("allTime");
  const [customStart,      setCustomStart]      = useState("");
  const [customEnd,        setCustomEnd]        = useState("");
  const [filterProduct,    setFilterProduct]    = useState("all");
  const [filterType,       setFilterType]       = useState<PaymentFilter>("all");
  const [filterStatus,     setFilterStatus]     = useState<StatusFilter>("all");
  const [filterCloser,     setFilterCloser]     = useState("all");
  const [filterSetter,     setFilterSetter]     = useState("all");

  const closers = profiles.filter(p => p.role === "closer");
  const setters = profiles.filter(p => p.role === "setter");
  const fmt     = (n: number) => formatCurrency(n, locale);

  const hasActiveFilters =
    filterProduct !== "all" || filterType !== "all" || filterStatus !== "all" ||
    filterCloser !== "all"  || filterSetter !== "all";

  const resetFilters = () => {
    setFilterProduct("all"); setFilterType("all"); setFilterStatus("all");
    setFilterCloser("all");  setFilterSetter("all");
  };

  // ── Scope to current user if not admin ──────────────────────────────────────
  const scopedSales = useMemo(() =>
    isAdmin ? allSales : allSales.filter(s =>
      isCloser ? s.closerId === user?.id : s.setterId === user?.id
    ), [allSales, isAdmin, isCloser, user?.id]);

  // ── Date range ──────────────────────────────────────────────────────────────
  const { start: startDate, end: endDate } = useMemo(
    () => computeDateRange(datePreset, customStart, customEnd),
    [datePreset, customStart, customEnd],
  );

  // ── Apply all filters ───────────────────────────────────────────────────────
  const filteredSales = useMemo(() => scopedSales.filter(s => {
    if (s.date < startDate || s.date > endDate)                    return false;
    if (filterProduct !== "all" && s.product !== filterProduct)    return false;
    if (filterType    !== "all" && s.paymentType !== filterType)   return false;
    if (filterStatus === "paid"     && (s.refunded || s.impaye))   return false;
    if (filterStatus === "refunded" && !s.refunded)                return false;
    if (filterStatus === "unpaid"   && !s.impaye)                  return false;
    if (filterCloser !== "all" && s.closerId !== filterCloser)     return false;
    if (filterSetter !== "all" && s.setterId !== filterSetter)     return false;
    return true;
  }), [scopedSales, startDate, endDate, filterProduct, filterType, filterStatus, filterCloser, filterSetter]);

  // ── Computed metrics ────────────────────────────────────────────────────────
  const metrics = useMemo(() => {
    let totalComm = 0, totalVolume = 0, validatedCount = 0, pifCount = 0,
        refundCount = 0, unpaidCount = 0;
    const productMap = new Map<string, number>();
    const closerMap  = new Map<string, number>();
    const monthMap   = new Map<string, number>();

    for (const s of filteredSales) {
      totalVolume += s.amount;
      if (s.refunded) { refundCount++; continue; }
      if (s.impaye)   { unpaidCount++; continue; }

      const myComm = isCloser ? s.closerCommission
                   : isSetter ? s.setterCommission
                   : s.closerCommission + s.setterCommission;
      totalComm += myComm;
      validatedCount++;
      if (s.paymentType === "pif") pifCount++;
      productMap.set(s.product, (productMap.get(s.product) ?? 0) + myComm);
      closerMap.set(s.closer,   (closerMap.get(s.closer)   ?? 0) + myComm);
      monthMap.set(s.date.slice(0, 7), (monthMap.get(s.date.slice(0, 7)) ?? 0) + myComm);
    }

    const total      = filteredSales.length;
    const refundRate = total > 0 ? (refundCount / total) * 100 : 0;
    const pifRate    = validatedCount > 0 ? (pifCount / validatedCount) * 100 : 0;
    const avgComm    = validatedCount > 0 ? totalComm / validatedCount : 0;

    // Last 6 months trend
    const now = new Date();
    const monthlyData = Array.from({ length: 6 }, (_, i) => {
      const d   = new Date(now.getFullYear(), now.getMonth() - 5 + i, 1);
      const key = d.toISOString().slice(0, 7);
      return { month: formatMonth(key, locale), commission: monthMap.get(key) ?? 0 };
    });

    return {
      totalComm, totalVolume, avgComm, validatedCount,
      refundCount, unpaidCount, refundRate, pifRate,
      productData: Array.from(productMap, ([name, commission]) => ({ name, commission }))
                       .sort((a, b) => b.commission - a.commission),
      closerData:  Array.from(closerMap,  ([name, commission]) => ({ name, commission }))
                       .sort((a, b) => b.commission - a.commission),
      monthlyData,
    };
  }, [filteredSales, isCloser, isSetter, locale]);

  // ── Closer bonus progress (always current month, unaffected by date filter) ─
  const currentMonthKey = new Date().toISOString().slice(0, 7);
  const currentMonthValidated = useMemo(() => {
    if (!isCloser) return 0;
    return scopedSales.filter(s =>
      s.date.startsWith(currentMonthKey) && !s.refunded && !s.impaye
    ).length;
  }, [scopedSales, isCloser, currentMonthKey]);

  const sortedTiers   = useMemo(() => [...tiers].sort((a, b) => a.minSales - b.minSales), [tiers]);
  const currentTier   = sortedTiers.filter(t => t.minSales <= currentMonthValidated).at(-1) ?? null;
  const nextTier      = sortedTiers.find(t => t.minSales > currentMonthValidated) ?? null;
  const progressTarget = nextTier?.minSales ?? currentTier?.minSales ?? 13;
  const progressPct    = Math.min((currentMonthValidated / progressTarget) * 100, 100);

  // ── Date preset pills ───────────────────────────────────────────────────────
  const presets: { key: DatePreset; label: string }[] = [
    { key: "thisMonth",  label: t("analytics.preset.thisMonth")  },
    { key: "lastMonth",  label: t("analytics.preset.lastMonth")  },
    { key: "last3m",     label: t("analytics.preset.last3m")     },
    { key: "last6m",     label: t("analytics.preset.last6m")     },
    { key: "thisYear",   label: t("analytics.preset.thisYear")   },
    { key: "allTime",    label: t("analytics.preset.allTime")    },
    { key: "custom",     label: t("analytics.preset.custom")     },
  ];

  return (
    <AppLayout>
      <div className="space-y-6">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div>
          <h1 className="text-3xl font-bold">{t("analytics.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("analytics.subtitle")}</p>
        </div>

        {/* ── Date range presets ─────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2">
          {presets.map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDatePreset(key)}
              className={cn(
                "rounded-full px-4 py-1.5 text-sm font-medium border transition-colors",
                datePreset === key
                  ? "bg-primary text-white border-primary shadow-sm"
                  : "bg-background text-muted-foreground border-border hover:border-primary/50 hover:text-foreground"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── Custom date inputs ─────────────────────────────────────────────── */}
        {datePreset === "custom" && (
          <div className="flex flex-wrap gap-4 items-end">
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("analytics.filter.from")}</Label>
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 w-40" />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">{t("analytics.filter.to")}</Label>
              <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 w-40" />
            </div>
          </div>
        )}

        {/* ── Filter row ─────────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 items-center">
          <Select value={filterProduct} onValueChange={setFilterProduct}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder={t("analytics.filter.product")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("analytics.filter.allProducts")}</SelectItem>
              {PRODUCTS.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
            </SelectContent>
          </Select>

          <Select value={filterType} onValueChange={v => setFilterType(v as PaymentFilter)}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder={t("analytics.filter.type")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("analytics.filter.allTypes")}</SelectItem>
              <SelectItem value="pif">PIF</SelectItem>
              <SelectItem value="installments">{t("admin.installments")}</SelectItem>
            </SelectContent>
          </Select>

          <Select value={filterStatus} onValueChange={v => setFilterStatus(v as StatusFilter)}>
            <SelectTrigger className="h-9 w-44"><SelectValue placeholder={t("analytics.filter.status")} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{t("analytics.filter.allStatuses")}</SelectItem>
              <SelectItem value="paid">{t("status.paid")}</SelectItem>
              <SelectItem value="refunded">{t("status.refunded")}</SelectItem>
              <SelectItem value="unpaid">{t("status.unpaid")}</SelectItem>
            </SelectContent>
          </Select>

          {isAdmin && (
            <Select value={filterCloser} onValueChange={setFilterCloser}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder={t("analytics.filter.closer")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("analytics.filter.allClosers")}</SelectItem>
                {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {isAdmin && (
            <Select value={filterSetter} onValueChange={setFilterSetter}>
              <SelectTrigger className="h-9 w-44"><SelectValue placeholder={t("analytics.filter.setter")} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("analytics.filter.allSetters")}</SelectItem>
                {setters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
              </SelectContent>
            </Select>
          )}

          {hasActiveFilters && (
            <Button variant="ghost" size="sm" className="h-9 gap-1.5 text-muted-foreground hover:text-foreground" onClick={resetFilters}>
              <X className="h-3.5 w-3.5" />{t("analytics.filter.reset")}
            </Button>
          )}
        </div>

        {/* ── KPI cards ──────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard
              title={t("analytics.kpi.totalComm")}
              value={fmt(metrics.totalComm)}
              subtitle={`${metrics.validatedCount} ${t("analytics.kpi.validated")}`}
              accent="blue"
              icon={<DollarSign className="h-5 w-5" />}
            />
            <StatCard
              title={t("analytics.kpi.avgComm")}
              value={fmt(metrics.avgComm)}
              subtitle={t("analytics.kpi.perValidatedSale")}
              accent="blue"
              icon={<TrendingUp className="h-5 w-5" />}
            />
            <StatCard
              title={t("analytics.kpi.volume")}
              value={fmt(metrics.totalVolume)}
              subtitle={`${filteredSales.length} ${t("analytics.kpi.transactions")}`}
              accent="green"
              icon={<Target className="h-5 w-5" />}
            />
            <StatCard
              title={t("analytics.kpi.salesCount")}
              value={String(metrics.validatedCount)}
              subtitle={`${metrics.refundCount + metrics.unpaidCount} ${t("analytics.kpi.exceptions")}`}
              accent="green"
              icon={<ShoppingCart className="h-5 w-5" />}
            />
            <StatCard
              title={t("analytics.kpi.refundRate")}
              value={`${metrics.refundRate.toFixed(1)}%`}
              subtitle={`${metrics.refundCount} ${t("status.refunded").toLowerCase()} · ${metrics.unpaidCount} ${t("status.unpaid").toLowerCase()}`}
              trend={metrics.refundRate > 10 ? "down" : "neutral"}
              accent="red"
              icon={<AlertTriangle className="h-5 w-5" />}
            />
            <StatCard
              title={t("analytics.kpi.pifRate")}
              value={`${metrics.pifRate.toFixed(1)}%`}
              subtitle={`${filteredSales.filter(s => s.paymentType === "pif" && !s.refunded && !s.impaye).length} PIF`}
              accent="orange"
              icon={<Percent className="h-5 w-5" />}
            />
          </div>
        )}

        {/* ── Closer: bonus progress ─────────────────────────────────────────── */}
        {isCloser && (
          <Card className="border border-border/60 shadow-card">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Gift className="h-4 w-4 text-primary" />
                {t("analytics.bonus.progress")}
                <Badge variant="outline" className="text-xs ml-auto">{formatMonth(currentMonthKey, locale)}</Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {tiers.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t("analytics.bonus.noTiers")}</p>
              ) : (
                <>
                  <div className="flex justify-between items-baseline">
                    <span className="text-sm text-muted-foreground">{t("analytics.bonus.validatedThisMonth")}</span>
                    <span className="text-2xl font-bold tabular-nums">
                      {currentMonthValidated}
                      {nextTier && <span className="text-base font-normal text-muted-foreground"> / {nextTier.minSales}</span>}
                    </span>
                  </div>
                  <Progress value={progressPct} className="h-2.5" />
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">
                      {nextTier
                        ? `${nextTier.minSales - currentMonthValidated} ${t("analytics.bonus.toUnlock")} +€${nextTier.bonusAmount}`
                        : currentTier
                          ? <span className="text-success font-semibold">{t("analytics.bonus.tierReached")} 🎉</span>
                          : null
                      }
                    </span>
                    {currentTier && (
                      <span className="text-success font-semibold">
                        {t("analytics.bonus.currentTier")}: +€{currentTier.bonusAmount}
                      </span>
                    )}
                  </div>

                  {/* Tier markers */}
                  {sortedTiers.length > 0 && (
                    <div className="flex gap-2 pt-1 flex-wrap">
                      {sortedTiers.map(tier => (
                        <div
                          key={tier.id}
                          className={cn(
                            "flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium border",
                            currentMonthValidated >= tier.minSales
                              ? "bg-success/10 border-success/30 text-success"
                              : "bg-muted border-border text-muted-foreground"
                          )}
                        >
                          {currentMonthValidated >= tier.minSales ? "✓" : "○"}
                          {tier.minSales} {t("detail.totalSales").toLowerCase()} → +€{tier.bonusAmount}
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        )}

        {/* ── Charts ─────────────────────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border border-border/60 shadow-card">
            <CardHeader><CardTitle className="text-base">{t("analytics.chart.trend")}</CardTitle></CardHeader>
            <CardContent>
              {metrics.monthlyData.every(d => d.commission === 0) ? (
                <p className="text-center py-12 text-sm text-muted-foreground">{t("analytics.noData")}</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <LineChart data={metrics.monthlyData}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                    <XAxis dataKey="month" fontSize={12} />
                    <YAxis fontSize={12} tickFormatter={v => fmt(v)} width={70} />
                    <Tooltip formatter={(v: number) => [fmt(v), t("analytics.kpi.totalComm")]} />
                    <Line type="monotone" dataKey="commission" stroke={CHART_COLORS.line} strokeWidth={2.5} dot={{ r: 4, fill: CHART_COLORS.line }} activeDot={{ r: 6 }} />
                  </LineChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>

          <Card className="border border-border/60 shadow-card">
            <CardHeader>
              <CardTitle className="text-base">
                {isAdmin ? t("analytics.chart.byCloser") : t("analytics.chart.byProduct")}
              </CardTitle>
            </CardHeader>
            <CardContent>
              {(isAdmin ? metrics.closerData : metrics.productData).length === 0 ? (
                <p className="text-center py-12 text-sm text-muted-foreground">{t("analytics.noData")}</p>
              ) : (
                <ResponsiveContainer width="100%" height={240}>
                  <BarChart data={isAdmin ? metrics.closerData : metrics.productData} margin={{ bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} />
                    <XAxis dataKey="name" fontSize={11} tick={{ dy: 4 }} />
                    <YAxis fontSize={12} tickFormatter={v => fmt(v)} width={70} />
                    <Tooltip formatter={(v: number) => [fmt(v), t("analytics.kpi.totalComm")]} />
                    <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              )}
            </CardContent>
          </Card>
        </div>

        {/* ── Transactions table ─────────────────────────────────────────────── */}
        <Card className="border border-border/60 shadow-card">
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">{t("analytics.sales.title")}</CardTitle>
            <Badge variant="outline">{filteredSales.length} {t("analytics.kpi.transactions")}</Badge>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : filteredSales.length === 0 ? (
              <p className="text-center py-10 text-sm text-muted-foreground">{t("analytics.noData")}</p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>{t("table.date")}</TableHead>
                      <TableHead>{t("table.client")}</TableHead>
                      <TableHead>{t("table.product")}</TableHead>
                      {isAdmin  && <TableHead>{t("table.closer")}</TableHead>}
                      {isAdmin  && <TableHead>{t("table.setter")}</TableHead>}
                      {!isAdmin && <TableHead>{isCloser ? t("table.setter") : t("table.closer")}</TableHead>}
                      <TableHead>{t("table.status")}</TableHead>
                      <TableHead className="text-right">{t("table.amount")}</TableHead>
                      <TableHead className="text-right">
                        {isAdmin || isCloser ? t("table.closerComm") : t("table.setterComm")}
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map(s => (
                      <TableRow key={s.id}>
                        <TableCell className="text-muted-foreground text-sm">{s.date}</TableCell>
                        <TableCell className="font-medium">{s.clientName}</TableCell>
                        <TableCell className="text-sm">{s.product}</TableCell>
                        {isAdmin  && <TableCell className="text-sm">{s.closer}</TableCell>}
                        {isAdmin  && <TableCell><SetterTag setterId={s.setterId} setterName={s.setter} /></TableCell>}
                        {!isAdmin && (
                          <TableCell>
                            {isCloser
                              ? <SetterTag setterId={s.setterId} setterName={s.setter} />
                              : <span className="text-sm">{s.closer}</span>}
                          </TableCell>
                        )}
                        <TableCell>
                          <div className="flex items-center gap-1.5">
                            <SaleStatusBadge refunded={s.refunded} impaye={s.impaye} />
                            {s.paymentType === "pif" && (
                              <Badge variant="outline" className="text-xs text-primary border-primary/30">PIF</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right text-sm">{fmt(s.amount)}</TableCell>
                        <TableCell className="text-right font-semibold">
                          {fmt(isCloser ? s.closerCommission : isSetter ? s.setterCommission : s.closerCommission)}
                        </TableCell>
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

export default AnalyticsPage;
