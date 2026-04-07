import { useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { useSales } from "@/hooks/useSales";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import AppLayout from "@/components/AppLayout";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import StatCard from "@/components/StatCard";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { ArrowLeft, TrendingUp, DollarSign, ShoppingCart, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";

const SetterDetailPage = () => {
  const { name } = useParams<{ name: string }>();
  const { t, locale } = useLanguage();
  const { data: allSales = [], isLoading } = useSales();

  const decodedName = decodeURIComponent(name || "");

  const { sales, totalComm, totalSales, refundedSales, unpaidSales, avgCommission, productData } = useMemo(() => {
    const sales = allSales.filter(s => s.setter === decodedName);
    let totalComm = 0, totalSales = 0, paidCount = 0;
    const refundedSales: typeof sales = [], unpaidSales: typeof sales = [];
    const productMap = new Map<string, number>();

    for (const s of sales) {
      totalSales += s.amount;
      if (s.refunded) { refundedSales.push(s); }
      else if (s.impaye) { unpaidSales.push(s); }
      else {
        totalComm += s.setterCommission;
        paidCount++;
        productMap.set(s.product, (productMap.get(s.product) || 0) + s.setterCommission);
      }
    }

    return {
      sales,
      totalComm,
      totalSales,
      refundedSales,
      unpaidSales,
      avgCommission: paidCount > 0 ? totalComm / paidCount : 0,
      productData: Array.from(productMap, ([name, commission]) => ({ name, commission })),
    };
  }, [allSales, decodedName]);

  const fmt = (n: number) => formatCurrency(n, locale);

  return (
    <AppLayout>
      <div className="space-y-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link to="/team"><ArrowLeft className="h-4 w-4" /></Link>
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{decodedName}</h1>
            <p className="text-sm text-muted-foreground">{t("role.setter")} — {t("detail.performance")}</p>
          </div>
        </div>

        {isLoading ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-28 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title={t("detail.totalComm")} value={fmt(totalComm)} icon={<DollarSign className="h-5 w-5" />} />
            <StatCard title={t("detail.totalSales")} value={String(sales.length)} subtitle={fmt(totalSales)} icon={<ShoppingCart className="h-5 w-5" />} />
            <StatCard title={t("detail.avgComm")} value={fmt(avgCommission)} icon={<TrendingUp className="h-5 w-5" />} />
            <StatCard title={t("detail.refundsUnpaid")} value={`${refundedSales.length} / ${unpaidSales.length}`} subtitle={t("detail.refundsUnpaidSub")} trend="down" icon={<AlertTriangle className="h-5 w-5" />} />
          </div>
        )}

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
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}</div>
            ) : sales.length === 0 ? (
              <p className="text-center py-8 text-muted-foreground">{t("dashboard.noData")}</p>
            ) : (
              <div className="overflow-x-auto">
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
                        <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  );
};

export default SetterDetailPage;
