import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

import { Link } from "react-router-dom";
import { useProfiles } from "@/hooks/useProfiles";
import { useSales } from "@/hooks/useSales";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Users, ArrowRight, AlertCircle } from "lucide-react";

const initials = (name: string) => name.split(" ").map((n) => n[0]).join("").slice(0, 2);

const MemberCard = ({
  user,
  href,
  accent,
  salesLabel,
  commissionLabel,
  fmt,
}: {
  user: { id: string; name: string; count: number; commission: number; volume: number };
  href: string;
  accent: "blue" | "green";
  salesLabel: string;
  commissionLabel: string;
  fmt: (n: number) => string;
}) => {
  const theme = accent === "blue"
    ? {
        frame: "from-primary/12 via-primary/5 to-transparent",
        avatar: "bg-primary/12 text-primary ring-primary/20",
        pill: "bg-primary/10 text-primary border-primary/20",
        arrow: "text-primary",
        statGlow: "shadow-primary/10",
        volume: "bg-primary/10 text-primary",
      }
    : {
        frame: "from-emerald-500/12 via-emerald-500/5 to-transparent",
        avatar: "bg-emerald-500/12 text-emerald-500 ring-emerald-500/20",
        pill: "bg-emerald-500/10 text-emerald-500 border-emerald-500/20",
        arrow: "text-emerald-500",
        statGlow: "shadow-emerald-500/10",
        volume: "bg-emerald-500/10 text-emerald-500",
      };

  return (
    <Link to={href} className="group block">
      <Card className="relative overflow-hidden rounded-[1.45rem] border border-border/35 bg-card/95 shadow-[0_10px_26px_rgba(0,0,0,0.14)] transition-all duration-300 hover:-translate-y-1 hover:border-border/60 hover:shadow-[0_16px_34px_rgba(0,0,0,0.18)]">
        <div className={cn("pointer-events-none absolute inset-x-0 top-0 h-14 bg-gradient-to-b opacity-75", theme.frame)} />
        <CardContent className="relative p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-[0.95rem] font-black text-sm ring-1 transition-all duration-300", theme.avatar)}>
                {initials(user.name)}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="truncate text-[1rem] leading-none font-black tracking-tight text-foreground">
                  {user.name}
                </p>
                <Badge variant="outline" className={cn("rounded-full border px-2.5 py-0.5 text-[9px] font-black uppercase tracking-[0.16em]", theme.pill)}>
                  {accent === "blue" ? "Closer" : "Setter"}
                </Badge>
              </div>
            </div>

            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-border/45 bg-background/60 text-muted-foreground transition-all duration-300 group-hover:border-transparent group-hover:bg-background group-hover:shadow-md">
              <ArrowRight className={cn("h-3.5 w-3.5 transition-all duration-300 group-hover:translate-x-0.5", theme.arrow)} />
            </div>
          </div>

          <div className="mt-4 space-y-2.5">
            <div className="rounded-[1.15rem] border border-border/35 bg-background/45 px-3.5 py-3">
              <div className="flex items-end justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground/65">{commissionLabel}</p>
                  <p className="mt-1.5 truncate text-[1.05rem] leading-none font-black tracking-tight text-foreground">{fmt(user.commission)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground/55">Volume</p>
                  <p className={cn("mt-1 text-[11px] font-black tabular-nums", accent === "blue" ? "text-primary" : "text-emerald-500")}>{fmt(user.volume)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div className="rounded-[0.95rem] border border-border/30 bg-muted/15 px-3 py-2.5">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground/65">{salesLabel}</p>
                <p className="mt-1 text-lg font-black tabular-nums text-foreground">{user.count}</p>
              </div>
              <div className="rounded-[0.95rem] border border-border/30 bg-muted/15 px-3 py-2.5">
                <p className="text-[8px] font-black uppercase tracking-[0.14em] text-muted-foreground/65">Avg. Comm.</p>
                <p className="mt-1 text-lg font-black tabular-nums text-foreground">
                  {fmt(user.count > 0 ? user.commission / user.count : 0)}
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
};

const TeamPage = () => {
  const { t, locale } = useLanguage();
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"name" | "sales" | "commission" | "volume">("commission");
  const {
    data: profiles = [],
    isLoading: loadingProfiles,
    isError: profilesLoadFailed,
    error: profilesError,
    refetch: refetchProfiles,
  } = useProfiles();
  const {
    data: sales = [],
    isLoading: loadingSales,
    isError: salesLoadFailed,
    error: salesError,
    refetch: refetchSales,
  } = useSales();

  const fmt = (n: number) => formatCurrency(n, locale);

  const loading = loadingProfiles || loadingSales;
  const loadError = profilesLoadFailed || salesLoadFailed;
  const loadErrorMessage = profilesLoadFailed
    ? profilesError instanceof Error ? profilesError.message : "Failed to load team members."
    : salesError instanceof Error ? salesError.message : "Failed to load sales stats.";

  // Pre-compute stats in a single pass over sales
  const closerStatsMap = useMemo(() => {
    const map = new Map<string, { count: number; commission: number; volume: number }>();
    for (const s of sales) {
      if (!s.closer) continue;
      const prev = map.get(s.closer) ?? { count: 0, commission: 0, volume: 0 };
      map.set(s.closer, {
        count: prev.count + 1,
        commission: prev.commission + (!s.refunded && !s.impaye ? s.closerCommission : 0),
        volume: prev.volume + s.amount,
      });
    }
    return map;
  }, [sales]);

  const setterStatsMap = useMemo(() => {
    const map = new Map<string, { count: number; commission: number; volume: number }>();
    for (const s of sales) {
      if (!s.setter) continue;
      const prev = map.get(s.setter) ?? { count: 0, commission: 0, volume: 0 };
      map.set(s.setter, {
        count: prev.count + 1,
        commission: prev.commission + (!s.refunded && !s.impaye ? s.setterCommission : 0),
        volume: prev.volume + s.amount,
      });
    }
    return map;
  }, [sales]);

  const emptyStats = { count: 0, commission: 0, volume: 0 };
  const searchLower = search.trim().toLowerCase();

  const sortMembers = (
    members: Array<{ id: string; name: string; role: "closer" | "setter" } & typeof emptyStats>,
  ) =>
    [...members].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "sales") return b.count - a.count;
      if (sortBy === "volume") return b.volume - a.volume;
      return b.commission - a.commission;
    });

  const closerMembers = useMemo(() => {
    const rows = profiles
      .filter(u => u.role === "closer")
      .map((user) => {
        const stats = closerStatsMap.get(user.name) ?? emptyStats;
        return { ...user, role: "closer" as const, ...stats };
      })
      .filter((user) => user.name.toLowerCase().includes(searchLower));
    return sortMembers(rows);
  }, [profiles, closerStatsMap, searchLower, sortBy]);

  const setterMembers = useMemo(() => {
    const rows = profiles
      .filter(u => u.role === "setter")
      .map((user) => {
        const stats = setterStatsMap.get(user.name) ?? emptyStats;
        return { ...user, role: "setter" as const, ...stats };
      })
      .filter((user) => user.name.toLowerCase().includes(searchLower));
    return sortMembers(rows);
  }, [profiles, setterStatsMap, searchLower, sortBy]);

  const topPerformers = useMemo(() => {
    const all = [...closerMembers, ...setterMembers].sort((a, b) => b.commission - a.commission);
    return all.slice(0, 3);
  }, [closerMembers, setterMembers]);

  const maxVolume = useMemo(() => {
    const volumes = [...closerMembers, ...setterMembers].map(m => m.volume);
    return Math.max(...volumes, 1);
  }, [closerMembers, setterMembers]);

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-5">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{t("team.title")}</h1>
            <p className="text-sm text-muted-foreground mt-1">{t("team.subtitle")}</p>
          </div>

          <div className="flex flex-col sm:flex-row gap-2.5">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team..."
              className="h-9 w-full sm:w-56 rounded-lg border-border/50 text-sm bg-muted/20"
            />
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="h-9 w-full sm:w-48 rounded-lg border-border/50 text-sm bg-muted/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl">
                <SelectItem value="commission">Sort by commission</SelectItem>
                <SelectItem value="sales">Sort by sales</SelectItem>
                <SelectItem value="volume">Sort by volume</SelectItem>
                <SelectItem value="name">Sort by name</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Top Performers Section */}
        {!loading && topPerformers.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {topPerformers.map((performer, idx) => (
              <Card key={performer.id} className={cn(
                "border-none relative overflow-hidden group transition-all duration-500 hover:-translate-y-1",
                idx === 0 ? "shadow-xl shadow-primary/10 bg-primary/5" : "shadow-lg shadow-muted/20 bg-muted/20"
              )}>
                <div className={cn(
                  "absolute top-0 right-0 p-4 font-black text-6xl opacity-5 select-none",
                  idx === 0 ? "text-primary" : "text-muted-foreground"
                )}>
                  #{idx + 1}
                </div>
                <CardContent className="p-6">
                  <div className="flex items-center gap-3 mb-5">
                    <div className={cn(
                      "flex h-11 w-11 items-center justify-center rounded-xl font-bold text-base shadow-inner",
                      idx === 0 ? "bg-primary text-white" : "bg-background text-primary border border-border/40"
                    )}>
                      {performer.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-semibold text-base">{performer.name}</p>
                      <Badge variant={performer.role === "closer" ? "default" : "secondary"} className="capitalize text-[10px] h-4 font-medium">
                        {performer.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-3">
                    <div className="flex justify-between items-end">
                      <p className="text-xs font-medium text-muted-foreground">Commission</p>
                      <p className="text-xl font-bold text-primary">{fmt(performer.commission)}</p>
                    </div>
                    <div className="w-full bg-muted/40 h-1.5 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                        style={{ width: `${(performer.volume / maxVolume) * 100}%` }}
                      />
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Members Grid Section */}
        <div className="space-y-12">
          {/* Closers Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-primary" />
                </div>
                {t("team.closers")}
              </h2>
              <Badge variant="outline" className="text-muted-foreground font-medium px-3">{closerMembers.length} active</Badge>
            </div>
            
            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}
              </div>
            ) : loadError ? (
              <Alert variant="destructive" className="rounded-2xl bg-destructive/5 border-destructive/20">
                <AlertCircle className="h-5 w-5" />
                <AlertTitle className="font-bold">Error loading Closers</AlertTitle>
                <AlertDescription className="mt-2 flex flex-col gap-4">
                  <p>{loadErrorMessage}</p>
                  <Button size="sm" variant="outline" className="w-fit" onClick={() => { refetchProfiles(); refetchSales(); }}>Retry</Button>
                </AlertDescription>
              </Alert>
            ) : closerMembers.length === 0 ? (
              <div className="text-center py-16 bg-muted/10 rounded-3xl border border-dashed border-border/60">
                <p className="text-muted-foreground italic font-medium">{t("team.noClosers")}</p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {closerMembers.map(user => (
                  <MemberCard
                    key={user.id}
                    user={user}
                    href={`/team/closer/${encodeURIComponent(user.name)}`}
                    accent="blue"
                    salesLabel={t("team.sales")}
                    commissionLabel={t("team.commission")}
                    fmt={fmt}
                  />
                ))}
              </div>
            )}
          </section>

          {/* Setters Section */}
          <section>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <div className="h-8 w-8 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-emerald-500" />
                </div>
                {t("team.setters")}
              </h2>
              <Badge variant="outline" className="text-muted-foreground font-medium px-3">{setterMembers.length} active</Badge>
            </div>
            
            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}
              </div>
            ) : setterMembers.length === 0 ? (
              <div className="text-center py-16 bg-muted/10 rounded-3xl border border-dashed border-border/60">
                <p className="text-muted-foreground italic font-medium">{t("team.noSetters")}</p>
              </div>
            ) : (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {setterMembers.map(user => (
                  <MemberCard
                    key={user.id}
                    user={user}
                    href={`/team/setter/${encodeURIComponent(user.name)}`}
                    accent="green"
                    salesLabel={t("team.sales")}
                    commissionLabel={t("team.commission")}
                    fmt={fmt}
                  />
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </AppLayout>
  );
};

export default TeamPage;
