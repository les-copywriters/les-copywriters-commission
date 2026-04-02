import { mockSales, mockRefunds, mockImpayes } from "@/data/mock";
import { useLanguage } from "@/i18n";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertTriangle, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

const DashboardPage = () => {
  const { t, locale } = useLanguage();
  const totalSales = mockSales.reduce((s, sale) => s + sale.amount, 0);
  const totalCloserComm = mockSales.reduce((s, sale) => s + sale.closerCommission, 0);
  const totalSetterComm = mockSales.reduce((s, sale) => s + sale.setterCommission, 0);
  const totalRefunds = mockRefunds.reduce((s, r) => s + r.amount, 0);
  const totalImpayes = mockImpayes.reduce((s, i) => s + i.amount, 0);

  const fmt = (n: number) => new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "EUR" }).format(n);

  const closerData = [
    { name: "Karim B.", sales: mockSales.filter(s => s.closer === "Karim B.").reduce((a, s) => a + s.amount, 0) },
    { name: "Sophie L.", sales: mockSales.filter(s => s.closer === "Sophie L.").reduce((a, s) => a + s.amount, 0) },
  ];

  const monthlyData = [
    { month: "Jan", sales: 12000 }, { month: locale === "fr" ? "Fév" : "Feb", sales: 18500 },
    { month: "Mar", sales: totalSales }, { month: locale === "fr" ? "Avr" : "Apr", sales: 0 },
  ];

  const pieData = [
    { name: t("dashboard.closerComm"), value: totalCloserComm },
    { name: t("dashboard.setterComm"), value: totalSetterComm },
    { name: t("dashboard.refunds"), value: totalRefunds },
    { name: t("dashboard.impayes"), value: totalImpayes },
  ];
  const PIE_COLORS = ["hsl(142, 71%, 45%)", "hsl(222, 47%, 40%)", "hsl(0, 84%, 60%)", "hsl(38, 92%, 50%)"];

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">{t("dashboard.title")}</h1>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title={t("dashboard.totalSales")} value={fmt(totalSales)} subtitle={t("dashboard.trendUp")} trend="up" icon={<DollarSign className="h-5 w-5" />} />
          <StatCard title={t("dashboard.commissions")} value={fmt(totalCloserComm + totalSetterComm)} subtitle={t("dashboard.closersSetters")} icon={<TrendingUp className="h-5 w-5" />} />
          <StatCard title={t("dashboard.refunds")} value={fmt(totalRefunds)} subtitle={`${mockRefunds.length} ${t("dashboard.requests")}`} trend="down" icon={<AlertTriangle className="h-5 w-5" />} />
          <StatCard title={t("dashboard.impayes")} value={fmt(totalImpayes)} subtitle={`${mockImpayes.length} ${t("dashboard.ongoing")}`} trend="down" icon={<Users className="h-5 w-5" />} />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">{t("dashboard.salesByCloser")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={closerData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="sales" fill="hsl(142, 71%, 45%)" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">{t("dashboard.monthlyTrend")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={monthlyData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(220,13%,91%)" />
                  <XAxis dataKey="month" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Line type="monotone" dataKey="sales" stroke="hsl(222, 47%, 11%)" strokeWidth={2} dot={{ r: 4 }} />
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

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">{t("dashboard.recentSales")}</CardTitle></CardHeader>
          <CardContent>
            {mockSales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("dashboard.noSales")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.date")}</TableHead>
                    <TableHead>{t("table.client")}</TableHead>
                    <TableHead>{t("table.product")}</TableHead>
                    <TableHead>{t("table.closer")}</TableHead>
                    <TableHead>{t("table.setter")}</TableHead>
                    <TableHead className="text-right">{t("table.amount")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {mockSales.map((sale) => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">{sale.date}</TableCell>
                      <TableCell className="font-medium">{sale.clientName}</TableCell>
                      <TableCell>{sale.product}</TableCell>
                      <TableCell>{sale.closer}</TableCell>
                      <TableCell>{sale.setter}</TableCell>
                      <TableCell className="text-right font-medium">{fmt(sale.amount)}</TableCell>
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
