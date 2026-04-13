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
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shadow-inner">
              <Users className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">{t("team.title")}</h1>
              <p className="text-muted-foreground">{t("team.subtitle")}</p>
            </div>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative">
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search team..."
                className="pl-4 h-11 w-full sm:w-64 rounded-xl border-border/40 focus-visible:ring-primary/20 bg-muted/30"
              />
            </div>
            <Select value={sortBy} onValueChange={(value) => setSortBy(value as typeof sortBy)}>
              <SelectTrigger className="h-11 w-full sm:w-56 rounded-xl border-border/40 bg-muted/30">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="rounded-xl border-border/40">
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
                  <div className="flex items-center gap-4 mb-6">
                    <div className={cn(
                      "flex h-14 w-14 items-center justify-center rounded-2xl font-black text-xl shadow-inner",
                      idx === 0 ? "bg-primary text-white" : "bg-background text-primary border border-border/40"
                    )}>
                      {performer.name.split(" ").map(n => n[0]).join("")}
                    </div>
                    <div>
                      <p className="font-bold text-lg">{performer.name}</p>
                      <Badge variant={performer.role === "closer" ? "default" : "secondary"} className="uppercase text-[9px] h-4">
                        {performer.role}
                      </Badge>
                    </div>
                  </div>
                  <div className="space-y-4">
                    <div className="flex justify-between items-end">
                      <p className="text-xs font-bold text-muted-foreground uppercase tracking-widest">Commission</p>
                      <p className="text-2xl font-black text-primary">{fmt(performer.commission)}</p>
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
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
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
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {closerMembers.map(user => (
                  <Link key={user.id} to={`/team/closer/${encodeURIComponent(user.name)}`} className="group">
                    <Card className="border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-3xl overflow-hidden group-hover:-translate-y-1">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary font-black group-hover:bg-primary group-hover:text-white transition-colors duration-300">
                            {user.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-primary transition-all duration-300" />
                        </div>
                        <div>
                          <p className="font-bold text-lg mb-4">{user.name}</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-muted/30 rounded-2xl group-hover:bg-background transition-colors duration-300">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">{t("team.sales")}</p>
                              <p className="text-lg font-black mt-1 tabular-nums">{user.count}</p>
                            </div>
                            <div className="p-3 bg-primary/5 rounded-2xl group-hover:bg-primary group-hover:shadow-lg group-hover:shadow-primary/20 transition-all duration-300">
                              <p className={cn("text-[10px] font-bold uppercase transition-colors duration-300", "text-primary group-hover:text-white/80")}>{t("team.commission")}</p>
                              <p className={cn("text-lg font-black mt-1 tabular-nums transition-colors duration-300", "text-primary group-hover:text-white")}>{fmt(user.commission)}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
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
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-40 rounded-3xl" />)}
              </div>
            ) : setterMembers.length === 0 ? (
              <div className="text-center py-16 bg-muted/10 rounded-3xl border border-dashed border-border/60">
                <p className="text-muted-foreground italic font-medium">{t("team.noSetters")}</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {setterMembers.map(user => (
                  <Link key={user.id} to={`/team/setter/${encodeURIComponent(user.name)}`} className="group">
                    <Card className="border-none shadow-sm hover:shadow-xl transition-all duration-300 rounded-3xl overflow-hidden group-hover:-translate-y-1">
                      <CardContent className="p-6">
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-500/10 text-emerald-600 font-black group-hover:bg-emerald-500 group-hover:text-white transition-colors duration-300">
                            {user.name.split(" ").map(n => n[0]).join("")}
                          </div>
                          <ArrowRight className="h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-emerald-500 transition-all duration-300" />
                        </div>
                        <div>
                          <p className="font-bold text-lg mb-4">{user.name}</p>
                          <div className="grid grid-cols-2 gap-4">
                            <div className="p-3 bg-muted/30 rounded-2xl group-hover:bg-background transition-colors duration-300">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase">{t("team.sales")}</p>
                              <p className="text-lg font-black mt-1 tabular-nums">{user.count}</p>
                            </div>
                            <div className="p-3 bg-emerald-500/5 rounded-2xl group-hover:bg-emerald-500 group-hover:shadow-lg group-hover:shadow-emerald-500/20 transition-all duration-300">
                              <p className={cn("text-[10px] font-bold uppercase transition-colors duration-300", "text-emerald-600 group-hover:text-white/80")}>{t("team.commission")}</p>
                              <p className={cn("text-lg font-black mt-1 tabular-nums transition-colors duration-300", "text-emerald-600 group-hover:text-white")}>{fmt(user.commission)}</p>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  </Link>
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
