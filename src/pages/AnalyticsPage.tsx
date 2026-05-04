import { useState, useMemo, useEffect } from "react";
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
import ProfileTag from "@/components/ProfileTag";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { DollarSign, ShoppingCart, TrendingUp, AlertTriangle, Target, Percent, Gift, X, Layers, Calendar, Check, Search } from "lucide-react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, AreaChart, Area, PieChart, Pie, Cell, Legend
} from "recharts";
import { cn, ls } from "@/lib/utils";

// ─── Types ────────────────────────────────────────────────────────────────────
type DatePreset = "thisMonth" | "lastMonth" | "last3m" | "last6m" | "thisYear" | "lastYear" | "allTime" | "custom";
type PaymentFilter = "all" | "pif" | "installments";
type StatusFilter  = "all" | "paid" | "refunded" | "unpaid";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function computeDateRange(preset: DatePreset, customStart: string, customEnd: string) {
  const now = new Date();
  const today = now.toISOString().slice(0, 10);
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  const utc = (year: number, month: number, day: number) =>
    new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);

  switch (preset) {
    case "thisMonth":  return { start: utc(y, m, 1), end: today };
    case "lastMonth":  return { start: utc(y, m - 1, 1), end: utc(y, m, 0) };
    case "last3m":     return { start: utc(y, m - 2, 1), end: today };
    case "last6m":     return { start: utc(y, m - 5, 1), end: today };
    case "thisYear":   return { start: `${y}-01-01`, end: today };
    case "lastYear":   return { start: `${y - 1}-01-01`, end: `${y - 1}-12-31` };
    case "allTime":    return { start: "2023-01-01", end: today };
    case "custom":     return { start: customStart || "2023-01-01", end: customEnd || today };
  }
}

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  border:  "rgba(128,128,128,0.12)",
};

const ChartCard = ({ title, icon: Icon, children }: { title: string; icon?: React.ElementType; children: React.ReactNode }) => (
  <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
    <div className="flex items-center gap-2 px-4 py-3 bg-muted/30 border-b border-border/40">
      {Icon && <Icon className="h-4 w-4 text-muted-foreground" />}
      <p className="text-sm font-medium">{title}</p>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

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
  const [datePreset, setDatePreset] = useState<DatePreset>(
    () => (ls.get("analytics.datePreset", "thisMonth") as DatePreset)
  );
  const [customStart, setCustomStart] = useState(
    () => ls.get("analytics.customStart")
  );
  const [customEnd, setCustomEnd] = useState(
    () => ls.get("analytics.customEnd")
  );

  useEffect(() => { ls.set("analytics.datePreset", datePreset); }, [datePreset]);
  useEffect(() => { ls.set("analytics.customStart", customStart); }, [customStart]);
  useEffect(() => { ls.set("analytics.customEnd", customEnd); }, [customEnd]);
  const [filterProduct,    setFilterProduct]    = useState("all");
  const [filterType,       setFilterType]       = useState<PaymentFilter>("all");
  const [filterStatus,     setFilterStatus]     = useState<StatusFilter>("all");
  const [filterCloser,     setFilterCloser]     = useState("all");
  const [filterSetter,     setFilterSetter]     = useState("all");
  const [search,           setSearch]           = useState("");

  const closers  = profiles.filter(p => p.role === "closer");
  const setters  = profiles.filter(p => p.role === "setter");
  const products = useMemo(() => [...new Set(allSales.map(s => s.product).filter(Boolean))].sort(), [allSales]);
  const fmt      = (n: number) => formatCurrency(n, locale);

  const hasActiveFilters =
    filterProduct !== "all" || filterType !== "all" || filterStatus !== "all" ||
    filterCloser !== "all"  || filterSetter !== "all" || search !== "";

  const resetFilters = () => {
    setFilterProduct("all"); setFilterType("all"); setFilterStatus("all");
    setFilterCloser("all");  setFilterSetter("all"); setSearch("");
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
    if (search.trim() !== "") {
      const q = search.toLowerCase();
      return (
        s.clientName?.toLowerCase().includes(q) ||
        s.product?.toLowerCase().includes(q) ||
        s.closer?.toLowerCase().includes(q) ||
        s.setter?.toLowerCase().includes(q)
      );
    }
    return true;
  }), [scopedSales, startDate, endDate, filterProduct, filterType, filterStatus, filterCloser, filterSetter, search]);

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

    // Full monthly data for the selected range
    const allMonths: string[] = [];
    const rangeStart = new Date(startDate);
    const rangeEnd   = new Date(endDate);
    for (const d = new Date(rangeStart.getFullYear(), rangeStart.getMonth(), 1);
         d <= rangeEnd;
         d.setMonth(d.getMonth() + 1)) {
      allMonths.push(d.toISOString().slice(0, 7));
    }
    const monthlyFull = allMonths.map(key => ({
      month: formatMonth(key, locale),
      commission: monthMap.get(key) ?? 0,
      revenue: Array.from(filteredSales)
        .filter(s => s.date.startsWith(key))
        .reduce((sum, s) => sum + s.amount, 0),
    }));

    // Payment mix
    const installCount = filteredSales.filter(s => s.paymentType !== "pif" && !s.refunded && !s.impaye).length;
    const paidCount    = filteredSales.filter(s => !s.refunded && !s.impaye).length;

    return {
      totalComm, totalVolume, avgComm, validatedCount,
      refundCount, unpaidCount, refundRate, pifRate,
      pifCount, installCount, paidCount,
      productData: Array.from(productMap, ([name, commission]) => ({ name, commission }))
                       .sort((a, b) => b.commission - a.commission),
      closerData:  Array.from(closerMap,  ([name, commission]) => ({ name, commission }))
                       .sort((a, b) => b.commission - a.commission),
      monthlyData,
      monthlyFull,
    };
  }, [filteredSales, isCloser, isSetter, locale, startDate, endDate]);

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

  const [animatedProgress, setAnimatedProgress] = useState(0);
  useEffect(() => {
    if (!isCloser) return;
    const t = setTimeout(() => setAnimatedProgress(progressPct), 400);
    return () => clearTimeout(t);
  }, [progressPct, isCloser]);

  // ── Date preset pills ───────────────────────────────────────────────────────
  const presets: { key: DatePreset; label: string }[] = [
    { key: "thisMonth",  label: t("analytics.preset.thisMonth")  },
    { key: "lastMonth",  label: t("analytics.preset.lastMonth")  },
    { key: "last3m",     label: t("analytics.preset.last3m")     },
    { key: "last6m",     label: t("analytics.preset.last6m")     },
    { key: "thisYear",   label: t("analytics.preset.thisYear")   },
    { key: "lastYear",   label: t("analytics.preset.lastYear")   },
    { key: "allTime",    label: t("analytics.preset.allTime")    },
    { key: "custom",     label: t("analytics.preset.custom")     },
  ];

  return (
    <AppLayout>
      <div className="space-y-6 animate-in fade-in duration-500">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="space-y-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("analytics.subtitle")}</p>
            <h1 className="text-xl font-semibold">{t("analytics.title")}</h1>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {presets.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setDatePreset(key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                  datePreset === key
                    ? "bg-primary text-white shadow-sm"
                    : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* ── Custom date inputs — single inline row ─────────────────────────── */}
        {datePreset === "custom" && (
          <div className="flex items-center gap-3 flex-wrap animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Custom range</span>
            </div>
            <div className="flex items-center gap-2">
              <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-8 w-36 rounded-lg text-sm" />
              <span className="text-xs text-muted-foreground">→</span>
              <Input type="date" value={customEnd}   onChange={e => setCustomEnd(e.target.value)}   className="h-8 w-36 rounded-lg text-sm" />
            </div>
          </div>
        )}

        {/* ── Filter toolbar ─────────────────────────────────────────────────── */}
        <div className="rounded-lg border border-border/40 bg-muted/10 p-3 space-y-2">
          <div className="flex flex-wrap gap-2 items-center">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search client or deal..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 w-52 pl-8 rounded-lg text-sm bg-background border-border/50"
              />
            </div>

            <div className="h-4 w-px bg-border/50 hidden sm:block" />

            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="h-9 w-36 rounded-lg text-sm bg-background border-border/50">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="all">All Products</SelectItem>
                {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={v => setFilterType(v as PaymentFilter)}>
              <SelectTrigger className="h-9 w-32 rounded-lg text-sm bg-background border-border/50">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="pif">PIF</SelectItem>
                <SelectItem value="installments">Installments</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-32 rounded-lg text-sm bg-background border-border/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>

            {isAdmin && (
              <Select value={filterCloser} onValueChange={setFilterCloser}>
                <SelectTrigger className="h-9 w-36 rounded-lg text-sm bg-background border-border/50">
                  <SelectValue placeholder="Closer" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="all">All Closers</SelectItem>
                  {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {isAdmin && (
              <Select value={filterSetter} onValueChange={setFilterSetter}>
                <SelectTrigger className="h-9 w-36 rounded-lg text-sm bg-background border-border/50">
                  <SelectValue placeholder="Setter" />
                </SelectTrigger>
                <SelectContent className="rounded-lg">
                  <SelectItem value="all">All Setters</SelectItem>
                  {setters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 px-2.5 gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg text-xs ml-auto" onClick={resetFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* ── KPI cards ──────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[
              <StatCard title={t("analytics.kpi.totalComm")} value={fmt(metrics.totalComm)} subtitle={`${metrics.validatedCount} ${t("analytics.kpi.validated")}`} accent="blue" icon={<DollarSign className="h-4 w-4" />} />,
              <StatCard title={t("analytics.kpi.avgComm")} value={fmt(metrics.avgComm)} subtitle={t("analytics.kpi.perValidatedSale")} accent="blue" icon={<TrendingUp className="h-4 w-4" />} />,
              <StatCard title={t("analytics.kpi.volume")} value={fmt(metrics.totalVolume)} subtitle={`${filteredSales.length} ${t("analytics.kpi.transactions")}`} accent="green" icon={<Target className="h-4 w-4" />} />,
              <StatCard title={t("analytics.kpi.salesCount")} value={String(metrics.validatedCount)} subtitle={`${metrics.refundCount + metrics.unpaidCount} ${t("analytics.kpi.exceptions")}`} accent="green" icon={<ShoppingCart className="h-4 w-4" />} />,
              <StatCard title={t("analytics.kpi.refundRate")} value={`${metrics.refundRate.toFixed(1)}%`} subtitle={`${metrics.refundCount} ${t("status.refunded").toLowerCase()} · ${metrics.unpaidCount} ${t("status.unpaid").toLowerCase()}`} trend={metrics.refundRate > 10 ? "down" : "neutral"} accent="red" icon={<AlertTriangle className="h-4 w-4" />} />,
              <StatCard title={t("analytics.kpi.pifRate")} value={`${metrics.pifRate.toFixed(1)}%`} subtitle={`${filteredSales.filter(s => s.paymentType === "pif" && !s.refunded && !s.impaye).length} PIF Sales`} accent="orange" icon={<Percent className="h-4 w-4" />} />,
            ].map((card, i) => (
              <div key={i} className="animate-in fade-in slide-in-from-bottom-4 fill-mode-both" style={{ animationDuration: "500ms", animationDelay: `${i * 75}ms` }}>
                {card}
              </div>
            ))}
          </div>
        )}

        {/* ── Closer: bonus progress ─────────────────────────────────────────── */}
        {isCloser && (
          <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
            <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
              <div className="flex items-center gap-2">
                <Gift className="h-4 w-4 text-muted-foreground" />
                <p className="text-sm font-medium">{t("analytics.bonus.progress")}</p>
              </div>
              <Badge variant="outline" className="rounded-md text-[10px] border-primary/20 text-primary">
                {currentMonthValidated} Sales Validated
              </Badge>
            </div>
            <div className="p-4 space-y-4">
               {tiers.length === 0 ? (
                  <p className="text-sm text-muted-foreground">{t("analytics.bonus.noTiers")}</p>
                ) : (
                  <div className="space-y-4">
                    <div className="space-y-1.5">
                       <div className="flex justify-between items-end">
                          <p className="text-xs text-muted-foreground">Progress to target</p>
                          <p className="text-xs font-medium text-primary tabular-nums">{progressPct.toFixed(0)}%</p>
                       </div>
                       <Progress value={animatedProgress} className="h-2 rounded-full bg-muted/40 [&>div]:transition-all [&>div]:duration-1000 [&>div]:ease-out" />
                    </div>

                    <div className="flex flex-wrap gap-2">
                      {sortedTiers.map((tier, i) => (
                        <div
                          key={tier.id}
                          className={cn(
                            "flex flex-col items-center gap-0.5 flex-1 min-w-[100px] px-3 py-2.5 rounded-lg border transition-all",
                            currentMonthValidated >= tier.minSales
                              ? "bg-emerald-500 border-emerald-500/20 text-white"
                              : "bg-muted/10 border-border/40 text-muted-foreground opacity-60"
                          )}
                          style={{ animationDuration: "400ms", animationDelay: `${700 + i * 80}ms` }}
                        >
                          <p className="text-[10px] font-medium leading-none">Tier</p>
                          <p className="text-base font-semibold leading-none">{tier.minSales}</p>
                          <p className="text-[10px] mt-0.5">+{fmt(tier.bonusAmount)}</p>
                          {currentMonthValidated >= tier.minSales && <Check className="h-3 w-3 mt-0.5" />}
                        </div>
                      ))}
                    </div>

                    {nextTier && (
                      <div className="bg-primary/5 px-3 py-2.5 rounded-lg border border-primary/10 flex items-center justify-between">
                         <p className="text-sm text-muted-foreground">
                           <span className="font-semibold text-primary">{nextTier.minSales - currentMonthValidated}</span> more sales to unlock next bonus
                         </p>
                         <Badge className="rounded-md text-xs font-medium">+€{nextTier.bonusAmount}</Badge>
                      </div>
                    )}
                  </div>
                )}
            </div>
          </div>
        )}

        {/* ── Charts Row 1 ───────────────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-2">
          <ChartCard title="Performance Trend" icon={TrendingUp}>
            {metrics.monthlyData.every(d => d.commission === 0) ? (
              <p className="text-center py-12 text-sm text-muted-foreground">No historical data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={metrics.monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCommAnal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                  <XAxis dataKey="month" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, background: "hsl(var(--background))" }}
                    formatter={(v: number) => [fmt(v), t("analytics.kpi.totalComm")]}
                  />
                  <Area type="monotone" dataKey="commission" stroke={CHART_COLORS.primary} strokeWidth={2} fillOpacity={1} fill="url(#colorCommAnal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title={isAdmin ? t("analytics.chart.byCloser") : t("analytics.chart.byProduct")} icon={Layers}>
            {(isAdmin ? metrics.closerData : metrics.productData).length === 0 ? (
              <p className="text-center py-12 text-sm text-muted-foreground">No distribution data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart data={isAdmin ? metrics.closerData : metrics.productData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                  <XAxis dataKey="name" fontSize={10} axisLine={false} tickLine={false} dy={10} />
                  <YAxis fontSize={10} axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, background: "hsl(var(--background))" }}
                    formatter={(v: number) => [fmt(v), t("analytics.kpi.totalComm")]}
                  />
                  <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[4, 4, 0, 0]} barSize={18} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── Charts Row 2 ───────────────────────────────────────────────────── */}
        <div className="grid gap-4 lg:grid-cols-3">
          {/* Revenue vs Commission dual bar */}
          <ChartCard title="Revenue vs Commission" icon={TrendingUp}>
            {metrics.monthlyFull.every(d => d.revenue === 0) ? (
              <p className="text-center py-12 text-sm text-muted-foreground">No data for selected period</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <BarChart data={metrics.monthlyFull} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                  <XAxis dataKey="month" fontSize={9} axisLine={false} tickLine={false} dy={8} />
                  <YAxis fontSize={9} axisLine={false} tickLine={false} tickFormatter={(v) => `€${(v/1000).toFixed(0)}k`} />
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, background: "hsl(var(--background))" }}
                    formatter={(v: number, name: string) => [fmt(v), name === "revenue" ? "Revenue" : "Commission"]}
                  />
                  <Legend formatter={(v) => v === "revenue" ? "Revenue" : "Commission"} wrapperStyle={{ fontSize: '10px', paddingTop: '8px' }} />
                  <Bar dataKey="revenue"    fill="hsl(var(--primary) / 0.25)" radius={[3,3,0,0]} barSize={12} />
                  <Bar dataKey="commission" fill={CHART_COLORS.primary}       radius={[3,3,0,0]} barSize={12} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Payment Mix donut */}
          <ChartCard title="Payment Mix" icon={Percent}>
            {metrics.pifCount === 0 && metrics.installCount === 0 ? (
              <p className="text-center py-12 text-sm text-muted-foreground">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "PIF",          value: metrics.pifCount },
                      { name: "Installments", value: metrics.installCount },
                    ]}
                    cx="50%" cy="45%"
                    innerRadius={55} outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    <Cell fill={CHART_COLORS.primary} />
                    <Cell fill="hsl(var(--primary) / 0.3)" />
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, background: "hsl(var(--background))" }}
                    formatter={(v: number) => [`${v} sales`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          {/* Sales Status donut */}
          <ChartCard title="Sales Status" icon={ShoppingCart}>
            {filteredSales.length === 0 ? (
              <p className="text-center py-12 text-sm text-muted-foreground">No data</p>
            ) : (
              <ResponsiveContainer width="100%" height={240}>
                <PieChart>
                  <Pie
                    data={[
                      { name: "Paid",     value: metrics.paidCount - metrics.pifCount - metrics.installCount < 0 ? metrics.paidCount : metrics.paidCount },
                      { name: "Refunded", value: metrics.refundCount },
                      { name: "Unpaid",   value: metrics.unpaidCount },
                    ].filter(d => d.value > 0)}
                    cx="50%" cy="45%"
                    innerRadius={55} outerRadius={80}
                    paddingAngle={4}
                    dataKey="value"
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    labelLine={false}
                  >
                    <Cell fill="#10b981" />
                    <Cell fill="#f59e0b" />
                    <Cell fill="#ef4444" />
                  </Pie>
                  <Tooltip
                    contentStyle={{ borderRadius: 8, border: "1px solid hsl(var(--border))", fontSize: 12, background: "hsl(var(--background))" }}
                    formatter={(v: number) => [`${v} sales`]}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── Transactions table ─────────────────────────────────────────────── */}
        <div className="rounded-xl border border-border/40 overflow-hidden bg-background">
          <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
            <p className="text-sm font-medium">{t("analytics.sales.title")}</p>
            <Badge variant="outline" className="rounded-md text-[10px] bg-primary/5 text-primary border-primary/20">
              {filteredSales.length} Total Records
            </Badge>
          </div>
          <div>
            {isLoading ? (
              <div className="p-4 space-y-3">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-16">
                 <p className="text-sm text-muted-foreground">{t("analytics.noData")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-none">
                      <TableHead className="py-2.5 pl-4 text-[11px] font-medium text-muted-foreground">{t("table.date")}</TableHead>
                      <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("table.client")}</TableHead>
                      <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("table.product")}</TableHead>
                      {isAdmin  && <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("table.closer")}</TableHead>}
                      {isAdmin  && <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{t("table.setter")}</TableHead>}
                      {!isAdmin && <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">{isCloser ? t("table.setter") : t("table.closer")}</TableHead>}
                      <TableHead className="py-2.5 text-right text-[11px] font-medium text-muted-foreground">{t("table.amount")}</TableHead>
                      <TableHead className="py-2.5 text-right text-[11px] font-medium text-muted-foreground">Commission</TableHead>
                      <TableHead className="py-2.5 pr-4 text-[11px] font-medium text-muted-foreground">{t("table.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map(s => (
                      <TableRow key={s.id} className="hover:bg-muted/20 border-border/20">
                        <TableCell className="py-3 pl-4 text-xs text-muted-foreground tabular-nums">{s.date}</TableCell>
                        <TableCell className="py-3">
                            <p className="font-medium text-sm">{s.clientName}</p>
                        </TableCell>
                        <TableCell className="py-3">
                            <Badge variant="outline" className="rounded-md text-[10px] border-border/40">{s.product}</Badge>
                        </TableCell>
                        {isAdmin && <TableCell className="py-3"><ProfileTag role="closer" personId={s.closerId} personName={s.closer} /></TableCell>}
                        {isAdmin && <TableCell className="py-3"><ProfileTag role="setter" personId={s.setterId} personName={s.setter} /></TableCell>}
                        {!isAdmin && (
                          <TableCell className="py-3">
                            {isCloser
                              ? <ProfileTag role="setter" personId={s.setterId} personName={s.setter} />
                              : <ProfileTag role="closer" personId={s.closerId} personName={s.closer} />}
                          </TableCell>
                        )}
                        <TableCell className="py-3 text-right text-sm tabular-nums">{fmt(s.amount)}</TableCell>
                        <TableCell className="py-3 text-right font-semibold text-primary tabular-nums text-sm">
                          {fmt(isCloser ? s.closerCommission : isSetter ? s.setterCommission : s.closerCommission)}
                        </TableCell>
                        <TableCell className="py-3 pr-4">
                          <div className="flex items-center gap-1.5">
                            <SaleStatusBadge refunded={s.refunded} impaye={s.impaye} />
                            {s.paymentType === "pif" && (
                              <Badge variant="outline" className="rounded-md text-[10px] text-primary bg-primary/5 border-primary/20">PIF</Badge>
                            )}
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>

      </div>
    </AppLayout>
  );
};

export default AnalyticsPage;
