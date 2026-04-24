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
  ResponsiveContainer, AreaChart, Area
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
  border:  "rgba(128,128,128,0.12)",
};

const ChartCard = ({ title, icon: Icon, children }: { title: string; icon?: any; children: React.ReactNode }) => (
  <Card className="border-none shadow-sm bg-background/50 backdrop-blur-sm overflow-hidden rounded-2xl">
    <div className="px-6 pt-5 pb-0 flex items-center gap-2.5">
      {Icon && <div className="p-1.5 rounded-md bg-primary/10 text-primary"><Icon className="h-3.5 w-3.5" /></div>}
      <h3 className="font-semibold text-sm text-foreground/70">{title}</h3>
    </div>
    <CardContent className="p-6 pt-4">{children}</CardContent>
  </Card>
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
  const [datePreset,       setDatePreset]       = useState<DatePreset>("allTime");
  const [customStart,      setCustomStart]      = useState("");
  const [customEnd,        setCustomEnd]        = useState("");
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
      <div className="space-y-10 animate-in fade-in duration-500">

        {/* ── Header ────────────────────────────────────────────────────────── */}
        <div className="space-y-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("analytics.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("analytics.subtitle")}</p>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {presets.map(({ key, label }) => (
              <button
                key={key}
                onClick={() => setDatePreset(key)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 text-xs font-medium transition-all",
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

        {/* ── Custom date inputs ─────────────────────────────────────────────── */}
        {datePreset === "custom" && (
          <div className="flex flex-wrap gap-5 items-end bg-muted/10 px-5 py-4 rounded-xl border border-border/40 animate-in slide-in-from-top-2 duration-200">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-3.5 w-3.5" />
              <span>Custom range</span>
            </div>
            <div className="flex flex-wrap gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">From</Label>
                <Input type="date" value={customStart} onChange={e => setCustomStart(e.target.value)} className="h-9 w-40 rounded-lg text-sm" />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">To</Label>
                <Input type="date" value={customEnd} onChange={e => setCustomEnd(e.target.value)} className="h-9 w-40 rounded-lg text-sm" />
              </div>
            </div>
          </div>
        )}

        {/* ── Filter toolbar ─────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-border/40 bg-muted/10 p-4 space-y-3">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
              <Input
                placeholder="Search client or deal..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="h-9 w-56 pl-9 rounded-lg text-sm bg-background border-border/50"
              />
            </div>

            <div className="h-5 w-px bg-border/50 hidden sm:block" />

            <Select value={filterProduct} onValueChange={setFilterProduct}>
              <SelectTrigger className="h-9 w-40 rounded-lg text-sm bg-background border-border/50">
                <SelectValue placeholder="Product" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg">
                <SelectItem value="all">All Products</SelectItem>
                {products.map(p => <SelectItem key={p} value={p}>{p}</SelectItem>)}
              </SelectContent>
            </Select>

            <Select value={filterType} onValueChange={v => setFilterType(v as PaymentFilter)}>
              <SelectTrigger className="h-9 w-36 rounded-lg text-sm bg-background border-border/50">
                <SelectValue placeholder="Type" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg">
                <SelectItem value="all">All Types</SelectItem>
                <SelectItem value="pif">PIF</SelectItem>
                <SelectItem value="installments">Installments</SelectItem>
              </SelectContent>
            </Select>

            <Select value={filterStatus} onValueChange={v => setFilterStatus(v as StatusFilter)}>
              <SelectTrigger className="h-9 w-36 rounded-lg text-sm bg-background border-border/50">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className="rounded-xl shadow-lg">
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="paid">Paid</SelectItem>
                <SelectItem value="refunded">Refunded</SelectItem>
                <SelectItem value="unpaid">Unpaid</SelectItem>
              </SelectContent>
            </Select>

            {isAdmin && (
              <Select value={filterCloser} onValueChange={setFilterCloser}>
                <SelectTrigger className="h-9 w-40 rounded-lg text-sm bg-background border-border/50">
                  <SelectValue placeholder="Closer" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg">
                  <SelectItem value="all">All Closers</SelectItem>
                  {closers.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {isAdmin && (
              <Select value={filterSetter} onValueChange={setFilterSetter}>
                <SelectTrigger className="h-9 w-40 rounded-lg text-sm bg-background border-border/50">
                  <SelectValue placeholder="Setter" />
                </SelectTrigger>
                <SelectContent className="rounded-xl shadow-lg">
                  <SelectItem value="all">All Setters</SelectItem>
                  {setters.map(s => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}
                </SelectContent>
              </Select>
            )}

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" className="h-9 px-3 gap-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/5 rounded-lg text-sm ml-auto" onClick={resetFilters}>
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* ── KPI cards ──────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
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
              subtitle={`${filteredSales.filter(s => s.paymentType === "pif" && !s.refunded && !s.impaye).length} PIF Sales`}
              accent="orange"
              icon={<Percent className="h-5 w-5" />}
            />
          </div>
        )}

        {/* ── Closer: bonus progress ─────────────────────────────────────────── */}
        {isCloser && (
          <Card className="border-none shadow-sm bg-gradient-to-br from-background via-background to-primary/5 p-8 rounded-[2.5rem] relative overflow-hidden group">
             <div className="absolute top-0 right-0 p-10 opacity-5 transform group-hover:scale-110 transition-transform">
                <Gift className="h-32 w-32 text-primary" />
             </div>
             <div className="p-0 space-y-8 relative">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="p-3 bg-primary text-white rounded-2xl shadow-lg shadow-primary/20">
                      <Gift className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="text-xl font-bold tracking-tight">{t("analytics.bonus.progress")}</h3>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-widest">{formatMonth(currentMonthKey, locale)} Performance</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="h-8 border-primary/20 text-primary font-black px-4 rounded-xl">
                    {currentMonthValidated} Sales Validated
                  </Badge>
                </div>

                {tiers.length === 0 ? (
                  <p className="text-sm text-muted-foreground font-medium italic">{t("analytics.bonus.noTiers")}</p>
                ) : (
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <div className="flex justify-between items-end mb-2">
                          <p className="text-xs font-black uppercase tracking-widest text-muted-foreground">Progress to target</p>
                          <p className="text-sm font-black text-primary tabular-nums">{progressPct.toFixed(0)}% Complete</p>
                       </div>
                       <Progress value={progressPct} className="h-3 rounded-full bg-muted/40" />
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {sortedTiers.map(tier => (
                        <div
                          key={tier.id}
                          className={cn(
                            "flex flex-col items-center gap-1 flex-1 min-w-[120px] p-4 rounded-2xl border transition-all duration-300",
                            currentMonthValidated >= tier.minSales
                              ? "bg-emerald-500 border-emerald-500/20 text-white shadow-lg shadow-emerald-500/10"
                              : "bg-muted/10 border-border/40 text-muted-foreground grayscale opacity-60"
                          )}
                        >
                          <p className="text-[10px] font-black uppercase tracking-widest leading-none mb-1">Tier</p>
                          <p className="text-lg font-black leading-none">{tier.minSales}</p>
                          <p className="text-[9px] font-bold uppercase tracking-wide mt-1">+{fmt(tier.bonusAmount)}</p>
                          {currentMonthValidated >= tier.minSales && <div className="mt-2 h-4 w-4 bg-white/20 rounded-full flex items-center justify-center"><Check className="h-2.5 w-2.5" /></div>}
                        </div>
                      ))}
                    </div>

                    {nextTier && (
                      <div className="bg-primary/5 p-4 rounded-2xl border border-primary/10 flex items-center justify-between">
                         <p className="text-sm font-medium text-primary-foreground/80">
                           <span className="font-black text-primary">{nextTier.minSales - currentMonthValidated}</span> more sales to unlock next bonus
                         </p>
                         <div className="h-8 w-8 bg-primary text-white rounded-lg flex items-center justify-center font-bold text-xs ring-4 ring-primary/10 animate-pulse">
                           +€{nextTier.bonusAmount}
                         </div>
                      </div>
                    )}
                  </div>
                )}
             </div>
          </Card>
        )}

        {/* ── Charts ─────────────────────────────────────────────────────────── */}
        <div className="grid gap-6 lg:grid-cols-2">
          <ChartCard title="Performance Trend" icon={TrendingUp}>
            {metrics.monthlyData.every(d => d.commission === 0) ? (
              <p className="text-center py-20 text-sm text-muted-foreground italic">No historical data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <AreaChart data={metrics.monthlyData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorCommAnal" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={CHART_COLORS.primary} stopOpacity={0.2}/>
                      <stop offset="95%" stopColor={CHART_COLORS.primary} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                  <XAxis dataKey="month" fontSize={10} font-weight="700" axisLine={false} tickLine={false} dy={10} />
                  <YAxis fontSize={10} font-weight="700" axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)', fontWeight: 'bold', background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}
                    formatter={(v: number) => [fmt(v), t("analytics.kpi.totalComm")]} 
                  />
                  <Area type="monotone" dataKey="commission" stroke={CHART_COLORS.primary} strokeWidth={3} fillOpacity={1} fill="url(#colorCommAnal)" />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </ChartCard>

          <ChartCard title={isAdmin ? t("analytics.chart.byCloser") : t("analytics.chart.byProduct")} icon={Layers}>
            {(isAdmin ? metrics.closerData : metrics.productData).length === 0 ? (
              <p className="text-center py-20 text-sm text-muted-foreground italic">No distribution data available</p>
            ) : (
              <ResponsiveContainer width="100%" height={280}>
                <BarChart data={isAdmin ? metrics.closerData : metrics.productData}>
                  <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                  <XAxis dataKey="name" fontSize={10} font-weight="700" axisLine={false} tickLine={false} dy={10} />
                  <YAxis fontSize={10} font-weight="700" axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)', fontWeight: 'bold', background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}
                    formatter={(v: number) => [fmt(v), t("analytics.kpi.totalComm")]} 
                  />
                  <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} barSize={20} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </ChartCard>
        </div>

        {/* ── Transactions table ─────────────────────────────────────────────── */}
        <Card className="border-none shadow-sm rounded-[2.5rem] overflow-hidden">
          <div className="p-8 border-b border-border/40 flex items-center justify-between">
            <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{t("analytics.sales.title")}</h3>
            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-bold h-8 px-4">
               {filteredSales.length} Total Records
            </Badge>
          </div>
          <CardContent className="p-0">
            {isLoading ? (
              <div className="p-8 space-y-4">
                {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full rounded-xl" />)}
              </div>
            ) : filteredSales.length === 0 ? (
              <div className="text-center py-20">
                 <p className="text-muted-foreground font-medium italic">{t("analytics.noData")}</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader className="bg-muted/30">
                    <TableRow className="border-none">
                      <TableHead className="py-4 pl-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.date")}</TableHead>
                      <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.client")}</TableHead>
                      <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.product")}</TableHead>
                      {isAdmin  && <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.closer")}</TableHead>}
                      {isAdmin  && <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.setter")}</TableHead>}
                      {!isAdmin && <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{isCloser ? t("table.setter") : t("table.closer")}</TableHead>}
                      <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.amount")}</TableHead>
                      <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Commission</TableHead>
                      <TableHead className="py-4 pr-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.status")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredSales.map(s => (
                      <TableRow key={s.id} className="group hover:bg-muted/10 transition-colors border-border/30">
                        <TableCell className="py-5 pl-8 text-xs font-medium text-muted-foreground tabular-nums">{s.date}</TableCell>
                        <TableCell className="py-5">
                            <p className="font-bold text-sm tracking-tight">{s.clientName}</p>
                        </TableCell>
                        <TableCell className="py-5">
                            <Badge variant="outline" className="text-[10px] font-bold border-border/40 hover:bg-muted/50">{s.product}</Badge>
                        </TableCell>
                        {isAdmin && <TableCell className="py-5"><ProfileTag role="closer" personId={s.closerId} personName={s.closer} /></TableCell>}
                        {isAdmin && <TableCell className="py-5"><ProfileTag role="setter" personId={s.setterId} personName={s.setter} /></TableCell>}
                        {!isAdmin && (
                          <TableCell className="py-5">
                            {isCloser
                              ? <ProfileTag role="setter" personId={s.setterId} personName={s.setter} />
                              : <ProfileTag role="closer" personId={s.closerId} personName={s.closer} />}
                          </TableCell>
                        )}
                        <TableCell className="py-5 text-right font-medium text-sm tabular-nums">{fmt(s.amount)}</TableCell>
                        <TableCell className="py-5 text-right font-black text-primary tabular-nums">
                          {fmt(isCloser ? s.closerCommission : isSetter ? s.setterCommission : s.closerCommission)}
                        </TableCell>
                        <TableCell className="py-5 pr-8">
                          <div className="flex items-center justify-end gap-2">
                            <SaleStatusBadge refunded={s.refunded} impaye={s.impaye} />
                            {s.paymentType === "pif" && (
                              <Badge variant="outline" className="text-[9px] font-black text-primary bg-primary/5 border-primary/20 h-5 px-1.5 uppercase">PIF</Badge>
                            )}
                          </div>
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
