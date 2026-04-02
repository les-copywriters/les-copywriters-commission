import { mockSales, mockRefunds, mockImpayes } from "@/data/mock";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { DollarSign, TrendingUp, AlertTriangle, Users } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from "recharts";

/** Dashboard — main overview of sales, commissions, and performance */
const DashboardPage = () => {
  const totalSales = mockSales.reduce((s, sale) => s + sale.amount, 0);
  const totalCloserComm = mockSales.reduce((s, sale) => s + sale.closerCommission, 0);
  const totalSetterComm = mockSales.reduce((s, sale) => s + sale.setterCommission, 0);
  const totalRefunds = mockRefunds.reduce((s, r) => s + r.amount, 0);
  const totalImpayes = mockImpayes.reduce((s, i) => s + i.amount, 0);

  const fmt = (n: number) => new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(n);

  // Chart data
  const closerData = [
    { name: "Karim B.", sales: mockSales.filter(s => s.closer === "Karim B.").reduce((a, s) => a + s.amount, 0) },
    { name: "Sophie L.", sales: mockSales.filter(s => s.closer === "Sophie L.").reduce((a, s) => a + s.amount, 0) },
  ];

  const monthlyData = [
    { month: "Jan", sales: 12000 }, { month: "Fév", sales: 18500 },
    { month: "Mar", sales: totalSales }, { month: "Avr", sales: 0 },
  ];

  const pieData = [
    { name: "Commissions closers", value: totalCloserComm },
    { name: "Commissions setters", value: totalSetterComm },
    { name: "Remboursements", value: totalRefunds },
    { name: "Impayés", value: totalImpayes },
  ];
  const PIE_COLORS = ["hsl(142, 71%, 45%)", "hsl(222, 47%, 40%)", "hsl(0, 84%, 60%)", "hsl(38, 92%, 50%)"];

  return (
    <AppLayout>
      <div className="space-y-6">
        <h1 className="text-3xl font-bold">Tableau de bord</h1>

        {/* KPI cards */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title="Ventes totales" value={fmt(totalSales)} subtitle="+12% ce mois" trend="up" icon={<DollarSign className="h-5 w-5" />} />
          <StatCard title="Commissions" value={fmt(totalCloserComm + totalSetterComm)} subtitle="Closers + Setters" icon={<TrendingUp className="h-5 w-5" />} />
          <StatCard title="Remboursements" value={fmt(totalRefunds)} subtitle={`${mockRefunds.length} demandes`} trend="down" icon={<AlertTriangle className="h-5 w-5" />} />
          <StatCard title="Impayés" value={fmt(totalImpayes)} subtitle={`${mockImpayes.length} en cours`} trend="down" icon={<Users className="h-5 w-5" />} />
        </div>

        {/* Charts */}
        <div className="grid gap-4 lg:grid-cols-2">
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">Ventes par closer</CardTitle></CardHeader>
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
            <CardHeader><CardTitle className="text-base">Tendance mensuelle</CardTitle></CardHeader>
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
            <CardHeader><CardTitle className="text-base">Répartition</CardTitle></CardHeader>
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

        {/* Sales table */}
        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">Dernières ventes</CardTitle></CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Produit</TableHead>
                  <TableHead>Closer</TableHead>
                  <TableHead>Setter</TableHead>
                  <TableHead className="text-right">Montant</TableHead>
                  <TableHead>Statut</TableHead>
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
                        <Badge variant="destructive">Remboursé</Badge>
                      ) : sale.impaye ? (
                        <Badge className="bg-warning text-warning-foreground hover:bg-warning/90">Impayé</Badge>
                      ) : (
                        <Badge className="bg-success text-success-foreground hover:bg-success/90">Payé</Badge>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default DashboardPage;
