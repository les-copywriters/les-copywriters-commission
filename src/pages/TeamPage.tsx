import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useProfiles } from "@/hooks/useProfiles";
import { useSales } from "@/hooks/useSales";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, ArrowRight } from "lucide-react";

const TeamPage = () => {
  const { t, locale } = useLanguage();
  const { data: profiles = [], isLoading: loadingProfiles } = useProfiles();
  const { data: sales = [], isLoading: loadingSales } = useSales();

  const fmt = (n: number) => formatCurrency(n, locale);

  const closers = profiles.filter(u => u.role === "closer");
  const setters = profiles.filter(u => u.role === "setter");
  const loading = loadingProfiles || loadingSales;

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

        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            {t("team.closers")}
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {loading
              ? Array.from({ length: 2 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-xl" />)
              : closers.length === 0
              ? <p className="text-sm text-muted-foreground py-4">{t("team.noClosers")}</p>
              : closers.map(user => {
                  const stats = closerStatsMap.get(user.name) ?? emptyStats;
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
              : setters.length === 0
              ? <p className="text-sm text-muted-foreground py-4">{t("team.noSetters")}</p>
              : setters.map(user => {
                  const stats = setterStatsMap.get(user.name) ?? emptyStats;
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
