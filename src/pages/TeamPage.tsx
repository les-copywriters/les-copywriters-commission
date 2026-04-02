import { Link } from "react-router-dom";
import { mockSales, mockUsers } from "@/data/mock";
import { useLanguage } from "@/i18n";
import AppLayout from "@/components/AppLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, ArrowRight } from "lucide-react";

/** Team overview — lists closers and setters with commission summaries */
const TeamPage = () => {
  const { t, locale } = useLanguage();

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "EUR" }).format(n);

  const closers = mockUsers.filter(u => u.role === "closer");
  const setters = mockUsers.filter(u => u.role === "setter");

  const getCloserStats = (name: string) => {
    const sales = mockSales.filter(s => s.closer === name);
    return {
      count: sales.length,
      commission: sales.reduce((a, s) => a + s.closerCommission, 0),
      volume: sales.reduce((a, s) => a + s.amount, 0),
    };
  };

  const getSetterStats = (name: string) => {
    const sales = mockSales.filter(s => s.setter === name);
    return {
      count: sales.length,
      commission: sales.reduce((a, s) => a + s.setterCommission, 0),
      volume: sales.reduce((a, s) => a + s.amount, 0),
    };
  };

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("team.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("team.subtitle")}</p>
        </div>

        {/* Closers */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Closers
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {closers.map(user => {
              const stats = getCloserStats(user.name);
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
                            <Badge variant="secondary" className="text-xs">Closer</Badge>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <p className="text-muted-foreground">{t("team.sales")}</p>
                          <p className="font-bold">{stats.count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("team.commission")}</p>
                          <p className="font-bold text-primary">{fmt(stats.commission)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("team.volume")}</p>
                          <p className="font-bold">{fmt(stats.volume)}</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Setters */}
        <div>
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            Setters
          </h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {setters.map(user => {
              const stats = getSetterStats(user.name);
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
                            <Badge variant="outline" className="text-xs">Setter</Badge>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center text-sm">
                        <div>
                          <p className="text-muted-foreground">{t("team.sales")}</p>
                          <p className="font-bold">{stats.count}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("team.commission")}</p>
                          <p className="font-bold text-primary">{fmt(stats.commission)}</p>
                        </div>
                        <div>
                          <p className="text-muted-foreground">{t("team.volume")}</p>
                          <p className="font-bold">{fmt(stats.volume)}</p>
                        </div>
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
