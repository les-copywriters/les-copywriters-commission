import { useMemo, useState } from "react";
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
import { Users, ArrowRight } from "lucide-react";

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

  const closers = profiles.filter(u => u.role === "closer");
  const setters = profiles.filter(u => u.role === "setter");
  const loading = loadingProfiles || loadingSales;
  const loadError = profilesLoadFailed || salesLoadFailed;
  const loadErrorMessage = profilesLoadFailed
    ? profilesError instanceof Error ? profilesError.message : "Failed to load team members."
    : salesError instanceof Error ? salesError.message : "Failed to load sales stats.";

  // Pre-compute stats in a single pass over sales — avoids O(N*M) per-member filtering
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
    const rows = closers
      .map((user) => {
        const stats = closerStatsMap.get(user.name) ?? emptyStats;
        return { ...user, role: "closer" as const, ...stats };
      })
      .filter((user) => user.name.toLowerCase().includes(searchLower));
    return sortMembers(rows);
  }, [closers, closerStatsMap, searchLower, sortBy]);

  const setterMembers = useMemo(() => {
    const rows = setters
      .map((user) => {
        const stats = setterStatsMap.get(user.name) ?? emptyStats;
        return { ...user, role: "setter" as const, ...stats };
      })
      .filter((user) => user.name.toLowerCase().includes(searchLower));
    return sortMembers(rows);
  }, [setters, setterStatsMap, searchLower, sortBy]);

  const totalVisibleMembers = closerMembers.length + setterMembers.length;
  const visibleSales = [...closerMembers, ...setterMembers].reduce((acc, member) => acc + member.count, 0);
  const visibleCommission = [...closerMembers, ...setterMembers].reduce((acc, member) => acc + member.commission, 0);

  return (
    <AppLayout>
      <div className="space-y-8">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10">
            <Users className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold">{t("team.title")}</h1>
            <p className="text-sm text-muted-foreground">{t("team.subtitle")}</p>
          </div>
        </div>

        <Card className="border border-border/60">
          <CardContent className="p-4 space-y-4">
            <div className="flex flex-col gap-3 md:flex-row">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search closer or setter..."
                className="md:max-w-md"
              />
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
                <SelectTrigger className="md:w-64">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="commission">Sort by commission</SelectItem>
                  <SelectItem value="sales">Sort by sales</SelectItem>
                  <SelectItem value="volume">Sort by volume</SelectItem>
                  <SelectItem value="name">Sort by name</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">Visible team members</p>
                <p className="text-xl font-semibold">{totalVisibleMembers}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("team.sales")}</p>
                <p className="text-xl font-semibold">{visibleSales}</p>
              </div>
              <div className="rounded-lg border border-border/60 p-3">
                <p className="text-xs text-muted-foreground uppercase tracking-wide">{t("dashboard.totalCommissions")}</p>
                <p className="text-xl font-semibold text-primary">{fmt(visibleCommission)}</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t("team.closers")}
          </h2>
          {loadError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Unable to load team data</AlertTitle>
              <AlertDescription className="space-y-3">
                <p>{loadErrorMessage}</p>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    refetchProfiles();
                    refetchSales();
                  }}
                >
                  Retry
                </Button>
              </AlertDescription>
            </Alert>
          )}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
              : loadError
              ? null
              : closerMembers.length === 0
              ? <p className="text-sm text-muted-foreground py-4">{t("team.noClosers")}</p>
              : closerMembers.map(user => {
                  const stats = { count: user.count, commission: user.commission, volume: user.volume };
                  return (
                    <Link key={user.id} to={`/team/closer/${encodeURIComponent(user.name)}`}>
                      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-sm">
                                {user.name.split(" ").map(n => n[0]).join("")}
                              </div>
                              <div>
                                <p className="font-semibold">{user.name}</p>
                                <Badge variant="secondary" className="text-xs">{t("role.closer")}</Badge>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div><p className="text-muted-foreground">{t("team.sales")}</p><p className="font-bold">{stats.count}</p></div>
                            <div><p className="text-muted-foreground">{t("team.commission")}</p><p className="font-bold text-primary">{fmt(stats.commission)}</p></div>
                            <div><p className="text-muted-foreground">{t("team.volume")}</p><p className="font-bold">{fmt(stats.volume)}</p></div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t("team.setters")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
              : loadError
              ? null
              : setterMembers.length === 0
              ? <p className="text-sm text-muted-foreground py-4">{t("team.noSetters")}</p>
              : setterMembers.map(user => {
                  const stats = { count: user.count, commission: user.commission, volume: user.volume };
                  return (
                    <Link key={user.id} to={`/team/setter/${encodeURIComponent(user.name)}`}>
                      <Card className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer group">
                        <CardContent className="p-5">
                          <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-3">
                              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-accent text-accent-foreground font-bold text-sm">
                                {user.name.split(" ").map(n => n[0]).join("")}
                              </div>
                              <div>
                                <p className="font-semibold">{user.name}</p>
                                <Badge variant="outline" className="text-xs">{t("role.setter")}</Badge>
                              </div>
                            </div>
                            <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          <div className="grid grid-cols-3 gap-2 text-center text-sm">
                            <div><p className="text-muted-foreground">{t("team.sales")}</p><p className="font-bold">{stats.count}</p></div>
                            <div><p className="text-muted-foreground">{t("team.commission")}</p><p className="font-bold text-primary">{fmt(stats.commission)}</p></div>
                            <div><p className="text-muted-foreground">{t("team.volume")}</p><p className="font-bold">{fmt(stats.volume)}</p></div>
                          </div>
                        </CardContent>
                      </Card>
                    </Link>
                  );
                })}
          </div>
        </div>
      </div>
    </AppLayout>
  );
};

export default TeamPage;
