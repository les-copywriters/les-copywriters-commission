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
import { Users, ArrowRight, AlertCircle, Archive } from "lucide-react";

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
  const avatarClass = accent === "blue"
    ? "bg-primary/10 text-primary"
    : "bg-emerald-500/10 text-emerald-600";
  const pillClass = accent === "blue"
    ? "bg-primary/5 text-primary border-primary/20"
    : "bg-emerald-500/5 text-emerald-600 border-emerald-500/20";
  const valueClass = accent === "blue" ? "text-primary" : "text-emerald-500";

  return (
    <Link to={href} className="group block">
      <div className="rounded-xl border border-border/40 bg-background overflow-hidden transition-all hover:border-border/70 hover:shadow-sm">
        <div className="p-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full font-medium text-sm", avatarClass)}>
                {initials(user.name)}
              </div>
              <div className="min-w-0 space-y-1">
                <p className="truncate text-sm font-medium text-foreground">
                  {user.name}
                </p>
                <Badge variant="outline" className={cn("rounded-md border px-2 py-0 text-[10px]", pillClass)}>
                  {accent === "blue" ? "Closer" : "Setter"}
                </Badge>
              </div>
            </div>
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-border/40 bg-muted/20 text-muted-foreground transition-all group-hover:bg-muted/40">
              <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
            </div>
          </div>

          <div className="mt-3 space-y-2">
            <div className="rounded-lg border border-border/30 bg-muted/20 px-3 py-2.5">
              <div className="flex items-end justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-[11px] text-muted-foreground">{commissionLabel}</p>
                  <p className={cn("mt-1 truncate text-sm font-semibold tabular-nums", valueClass)}>{fmt(user.commission)}</p>
                </div>
                <div className="text-right shrink-0">
                  <p className="text-[11px] text-muted-foreground">Volume</p>
                  <p className="mt-1 text-xs text-muted-foreground tabular-nums">{fmt(user.volume)}</p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">{salesLabel}</p>
                <p className="mt-0.5 text-base font-semibold tabular-nums">{user.count}</p>
              </div>
              <div className="rounded-lg border border-border/30 bg-muted/10 px-3 py-2">
                <p className="text-[11px] text-muted-foreground">Avg. Comm.</p>
                <p className="mt-0.5 text-base font-semibold tabular-nums">
                  {fmt(user.count > 0 ? user.commission / user.count : 0)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
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
      .filter(u => u.role === "closer" && u.isActive)
      .map((user) => {
        const stats = closerStatsMap.get(user.name) ?? emptyStats;
        return { ...user, role: "closer" as const, ...stats };
      })
      .filter((user) => user.name.toLowerCase().includes(searchLower));
    return sortMembers(rows);
  }, [profiles, closerStatsMap, searchLower, sortBy]);

  const setterMembers = useMemo(() => {
    const rows = profiles
      .filter(u => u.role === "setter" && u.isActive)
      .map((user) => {
        const stats = setterStatsMap.get(user.name) ?? emptyStats;
        return { ...user, role: "setter" as const, ...stats };
      })
      .filter((user) => user.name.toLowerCase().includes(searchLower));
    return sortMembers(rows);
  }, [profiles, setterStatsMap, searchLower, sortBy]);

  const legacyMembers = useMemo(() => {
    const rows = profiles
      .filter(u => !u.isActive && (u.role === "closer" || u.role === "setter"))
      .map((user) => {
        const stats = user.role === "closer"
          ? (closerStatsMap.get(user.name) ?? emptyStats)
          : (setterStatsMap.get(user.name) ?? emptyStats);
        return { ...user, ...stats };
      })
      .filter((user) => user.name.toLowerCase().includes(searchLower));
    return [...rows].sort((a, b) => a.name.localeCompare(b.name));
  }, [profiles, closerStatsMap, setterStatsMap, searchLower]);

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
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <p className="text-[11px] uppercase tracking-wide text-muted-foreground">{t("team.subtitle")}</p>
            <h1 className="text-xl font-semibold">{t("team.title")}</h1>
          </div>

          <div className="flex flex-col sm:flex-row gap-2">
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search team..."
              className="h-9 w-full sm:w-52 rounded-lg border-border/50 text-sm bg-muted/20"
            />
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="h-9 w-full sm:w-44 rounded-lg border-border/50 text-sm bg-muted/20">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-lg">
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
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {topPerformers.map((performer, idx) => (
              <div key={performer.id} className={cn(
                "rounded-xl border border-border/40 bg-background p-4",
                idx === 0 && "border-primary/20 bg-primary/5"
              )}>
                <div className="flex items-center gap-3 mb-3">
                  <div className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full font-medium text-sm",
                    idx === 0 ? "bg-primary text-white" : "bg-muted text-foreground"
                  )}>
                    {performer.name.split(" ").map(n => n[0]).join("")}
                  </div>
                  <div>
                    <p className="font-medium text-sm">{performer.name}</p>
                    <Badge variant={performer.role === "closer" ? "default" : "secondary"} className="capitalize text-[10px] h-4 rounded-md">
                      {performer.role}
                    </Badge>
                  </div>
                  <span className="ml-auto text-2xl font-bold text-muted-foreground/20">#{idx + 1}</span>
                </div>
                <div className="space-y-2">
                  <div className="flex justify-between items-end">
                    <p className="text-xs text-muted-foreground">Commission</p>
                    <p className="text-sm font-semibold text-primary">{fmt(performer.commission)}</p>
                  </div>
                  <div className="w-full bg-muted/40 h-1 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-primary rounded-full transition-all duration-1000 ease-out"
                      style={{ width: `${(performer.volume / maxVolume) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Members Grid Section */}
        <div className="space-y-8">
          {/* Closers Section */}
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-primary/10 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-primary" />
                </div>
                {t("team.closers")}
              </h2>
              <Badge variant="outline" className="rounded-md text-muted-foreground text-[10px]">{closerMembers.length} active</Badge>
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
            ) : loadError ? (
              <Alert variant="destructive" className="rounded-lg bg-destructive/5 border-destructive/20">
                <AlertCircle className="h-4 w-4" />
                <AlertTitle className="font-medium">Error loading Closers</AlertTitle>
                <AlertDescription className="mt-1 flex flex-col gap-3">
                  <p className="text-sm">{loadErrorMessage}</p>
                  <Button size="sm" variant="outline" className="w-fit rounded-lg" onClick={() => { refetchProfiles(); refetchSales(); }}>Retry</Button>
                </AlertDescription>
              </Alert>
            ) : closerMembers.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border/60 rounded-lg">
                <p className="text-sm text-muted-foreground">{t("team.noClosers")}</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-medium flex items-center gap-2">
                <div className="h-6 w-6 rounded-md bg-emerald-500/10 flex items-center justify-center">
                  <Users className="h-3.5 w-3.5 text-emerald-500" />
                </div>
                {t("team.setters")}
              </h2>
              <Badge variant="outline" className="rounded-md text-muted-foreground text-[10px]">{setterMembers.length} active</Badge>
            </div>

            {loading ? (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 rounded-lg" />)}
              </div>
            ) : setterMembers.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border/60 rounded-lg">
                <p className="text-sm text-muted-foreground">{t("team.noSetters")}</p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
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

          {/* Legacy Section */}
          {!loading && legacyMembers.length > 0 && (
            <section>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-medium flex items-center gap-2">
                  <div className="h-6 w-6 rounded-md bg-muted/50 flex items-center justify-center">
                    <Archive className="h-3.5 w-3.5 text-muted-foreground" />
                  </div>
                  Legacy Team
                </h2>
                <Badge variant="outline" className="rounded-md text-muted-foreground text-[10px]">{legacyMembers.length} archived</Badge>
              </div>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {legacyMembers.map(user => (
                  <div key={user.id} className="rounded-xl border border-border/30 bg-muted/20 p-4 opacity-60">
                    <div className="flex items-center gap-3">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-medium">
                        {user.name.split(" ").map((n: string) => n[0]).join("").slice(0, 2)}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium truncate">{user.name}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <Badge variant="outline" className="rounded-md text-[10px] capitalize text-muted-foreground border-border/40">
                            {user.role}
                          </Badge>
                          <span className="text-[10px] text-muted-foreground/50">{user.count} sales · {fmt(user.commission)}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <p className="mt-2 text-[11px] text-muted-foreground/50">Legacy members are archived. Their historical sales data is preserved. Manage in Team → Manage Team.</p>
            </section>
          )}
        </div>
      </div>
    </AppLayout>
  );
};

export default TeamPage;
