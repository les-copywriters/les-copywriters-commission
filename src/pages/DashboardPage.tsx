import { mockSales, mockRefunds, mockImpayes } from "@/data/mock";
import { useLanguage } from "@/i18n";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, TrendingDown, AlertTriangle, Wallet } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

/** Commission dashboard — sales data comes from JotForm */
const DashboardPage = () => {
  const { t, locale } = useLanguage();

  const totalCloserComm = mockSales.reduce((s, sale) => s + sale.closerCommission, 0);
  const totalSetterComm = mockSales.reduce((s, sale) => s + sale.setterCommission, 0);
  const totalComm = totalCloserComm + totalSetterComm;
  const totalRefunds = mockRefunds.reduce((s, r) => s + r.amount, 0);
  const totalImpayes = mockImpayes.reduce((s, i) => s + i.amount, 0);

  const fmt = (n: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "EUR" }).format(n);

  // Commission per closer
  const closerCommData = [
    { name: "Karim B.", commission: mockSales.filter(s => s.closer === "Karim B.").reduce((a, s) => a + s.closerCommission, 0) },
    { name: "Sophie L.", commission: mockSales.filter(s => s.closer === "Sophie L.").reduce((a, s) => a + s.closerCommission, 0) },
  ];

  const monthlyCommData = [
    { month: "Jan", commission: 1056 }, { month: locale === "fr" ? "Fév" : "Feb", commission: 1628 },
    { month: "Mar", commission: totalComm }, { month: locale === "fr" ? "Avr" : "Apr", commission: 0 },
  ];

  const pieData = [
    { name: t("dashboard.closerComm"), value: totalCloserComm },
    { name: t("dashboard.setterComm"), value: totalSetterComm },
    { name: t("dashboard.refunds"), value: totalRefunds },
    { name: t("dashboard.impayes"), value: totalImpayes },
  ];
  const PIE_COLORS = ["hsl(201, 96%, 46%)", "hsl(213, 50%, 30%)", "hsl(0, 84%, 60%)", "hsl(38, 92%, 50%)"];

  return (
    <AppLayout>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>
          <p className="text-sm text-muted-foreground mt-1">{t("dashboard.salesSource")}</p>
        </div>

        {/* KPI cards — commission focused */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title={t("dashboard.totalCommissions")} value={fmt(totalComm)} subtitle={t("dashboard.trendUp")} trend="up" icon={<Wallet className="h-5 w-5" />} />
          <StatCard title={t("dashboard.closerCommTotal")} value={fmt(totalCloserComm)} subtitle={t("dashboard.closersSetters")} icon={<TrendingUp className="h-5 w-5" />} />
          <StatCard title={t("dashboard.refunds")} value={fmt(totalRefunds)} subtitle={`${mockRefunds.length} ${t("dashboard.requests")}`} trend="down" icon={<AlertTriangle className="h-5 w-5" />} />
          <StatCard title={t("dashboard.impayes")} value={fmt(totalImpayes)} subtitle={`${mockImpayes.length} ${t("dashboard.ongoing")}`} trend="down" icon={<TrendingDown className="h-5 w-5" />} />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">{t("dashboard.commByCloser")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={closerCommData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,16%,88%)" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="commission" fill="hsl(201, 96%, 46%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">{t("dashboard.commByMonth")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyCommData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(216,16%,88%)" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Line type="monotone" dataKey="commission" stroke="hsl(213, 50%, 10%)" strokeWidth={2} dot={{ r: 4 }} />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm lg:col-span-2">
            <CardHeader><CardTitle className="text-base">{t("dashboard.breakdown")}</CardTitle></CardHeader>
            <CardContent className="flex justify-center">
              <ResponsiveContainer width="100%" height={250}>
                <PieChart>
                  <Pie data={pieData} cx="50%" cy="50%" outerRadius={90} dataKey="value" label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} fontSize={11}>
                    {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i]} />)}
                  </Pie>
                  <Tooltip formatter={(v: number) => fmt(v)} />
                </PieChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        </div>

        {/* Commission detail table */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">{t("dashboard.recentCommissions")}</CardTitle></CardHeader>
          <CardContent>
            {mockSales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("dashboard.noData")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.date")}</TableHead>
                    <TableHead>{t("table.client")}</TableHead>
                    <TableHead>{t("table.closer")}</TableHead>
                    <TableHead>{t("table.setter")}</TableHead>
                    <TableHead className="text-right">{t("table.amount")}</TableHead>
                    <TableHead className="text-right">{t("table.closerComm")}</TableHead>
                    <TableHead className="text-right">{t("table.setterComm")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">{sale.date}</TableCell>
                      <TableCell className="font-medium">{sale.clientName}</TableCell>
                      <TableCell>{sale.closer}</TableCell>
                      <TableCell>{sale.setter}</TableCell>
                      <TableCell className="text-right">{fmt(sale.amount)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(sale.closerCommission)}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(sale.setterCommission)}</TableCell>
                      <TableCell>
                        {sale.refunded ? (
                          <Badge variant="destructive">{t("status.refunded")}</Badge>
                        ) : sale.impaye ? (
                          <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">{t("status.unpaid")}</Badge>
                        ) : (
                          <Badge className="bg-success text-success-foreground hover:bg-success/90">{t("status.paid")}</Badge>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
