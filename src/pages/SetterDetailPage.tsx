import { useParams, Link } from "react-router-dom";
import { mockSales } from "@/data/mock";
import { useLanguage } from "@/i18n";
import AppLayout from "@/components/AppLayout";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, DollarSign, ShoppingCart, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const SetterDetailPage = () => {
  const { name } = useParams<{ name: string }>();
  const { t, locale } = useLanguage();
  const decodedName = decodeURIComponent(name || "");

  const sales = mockSales.filter(s => s.setter === decodedName);
  const totalComm = sales.reduce((a, s) => a + s.setterCommission, 0);
  const totalSales = sales.reduce((a, s) => a + s.amount, 0);
  const refundedSales = sales.filter(s => s.refunded);
  const unpaidSales = sales.filter(s => s.impaye);
  const avgCommission = sales.length > 0 ? totalComm / sales.length : 0;

  const fmt = (n: number) =>
    new Intl.NumberFormat(locale === "fr" ? "fr-FR" : "en-US", { style: "currency", currency: "EUR" }).format(n);

  const productMap = new Map<string, number>();
  sales.forEach(s => {
    productMap.set(s.product, (productMap.get(s.product) || 0) + s.setterCommission);
  });
  const productData = Array.from(productMap, ([name, commission]) => ({ name, commission }));

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/team"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{decodedName}</h1>
            <p className="text-sm text-muted-foreground">Setter — {t("detail.performance")}</p>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard title={t("detail.totalComm")} value={fmt(totalComm)} icon={<DollarSign className="h-5 w-5" />} />
          <StatCard title={t("detail.totalSales")} value={String(sales.length)} subtitle={fmt(totalSales)} icon={<ShoppingCart className="h-5 w-5" />} />
          <StatCard title={t("detail.avgComm")} value={fmt(avgCommission)} icon={<TrendingUp className="h-5 w-5" />} />
          <StatCard title={t("detail.refundsUnpaid")} value={`${refundedSales.length} / ${unpaidSales.length}`} subtitle={t("detail.refundsUnpaidSub")} trend="down" icon={<AlertTriangle className="h-5 w-5" />} />
        </div>

        {productData.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-base">{t("detail.commByProduct")}</CardTitle></CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={250}>
                <BarChart data={productData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                  <XAxis dataKey="name" fontSize={12} />
                  <YAxis fontSize={12} />
                  <Tooltip formatter={(v: number) => fmt(v)} />
                  <Bar dataKey="commission" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}

        <Card className="border-0 shadow-sm">
          <CardHeader><CardTitle className="text-base">{t("detail.salesHistory")}</CardTitle></CardHeader>
          <CardContent>
            {sales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("dashboard.noData")}</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("table.date")}</TableHead>
                    <TableHead>{t("table.client")}</TableHead>
                    <TableHead>{t("table.closer")}</TableHead>
                    <TableHead className="text-right">{t("table.amount")}</TableHead>
                    <TableHead className="text-right">{t("table.setterComm")}</TableHead>
                    <TableHead>{t("table.status")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {sales.map(sale => (
                    <TableRow key={sale.id}>
                      <TableCell className="text-muted-foreground">{sale.date}</TableCell>
                      <TableCell className="font-medium">{sale.clientName}</TableCell>
                      <TableCell>{sale.closer}</TableCell>
                      <TableCell className="text-right">{fmt(sale.amount)}</TableCell>
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

export default SetterDetailPage;
