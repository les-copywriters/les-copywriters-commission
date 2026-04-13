import { useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import ProfileTag from "@/components/ProfileTag";
import { useSales } from "@/hooks/useSales";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import AppLayout from "@/components/AppLayout";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import StatCard from "@/components/StatCard";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { ArrowLeft, TrendingUp, DollarSign, ShoppingCart, AlertTriangle, Layers, Eye } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { cn } from "@/lib/utils";
import SaleDetailsDialog from "@/components/SaleDetailsDialog";
import { Sale } from "@/types";

const CHART_COLORS = {
  primary: "hsl(var(--primary))",
  border:  "rgba(128,128,128,0.12)",
};

const ContentCard = ({ title, icon: Icon, children, className }: { title: string; icon?: any; children: React.ReactNode; className?: string }) => (
  <Card className={cn("border-none shadow-premium rounded-[2.5rem] bg-background overflow-hidden", className)}>
    <div className="p-8 border-b border-border/40 flex items-center gap-2">
      {Icon && <div className="p-2 rounded-lg bg-primary/10 text-primary"><Icon className="h-4 w-4" /></div>}
      <h3 className="font-black text-sm uppercase tracking-widest text-muted-foreground">{title}</h3>
    </div>
    <CardContent className="p-8">{children}</CardContent>
  </Card>
);

const SetterDetailPage = () => {
  const { name } = useParams<{ name: string }>();
  const { t, locale } = useLanguage();
  const {
    data: allSales = [],
    isLoading,
    isError: salesLoadFailed,
    error: salesError,
    refetch: refetchSales,
  } = useSales();

  const decodedName = decodeURIComponent(name || "");
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

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
  const loadErrorMessage = salesError instanceof Error ? salesError.message : "Failed to load setter details.";

  return (
    <AppLayout>
      <div className="space-y-10 animate-in fade-in duration-500">
        
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" asChild className="h-12 w-12 rounded-2xl bg-muted/20 hover:bg-muted/40 transition-all">
              <Link to="/team"><ArrowLeft className="h-6 w-6" /></Link>
            </Button>
            <div>
              <h1 className="text-2xl font-black tracking-tight">{decodedName}</h1>
              <p className="text-muted-foreground font-medium uppercase tracking-widest text-[10px]">{t("role.setter")} • Performance Analytics</p>
            </div>
          </div>
          
          <Badge className="h-10 px-6 rounded-2xl bg-primary text-white font-black uppercase tracking-widest shadow-xl shadow-primary/20">
            {sales.length} Appointed Deals
          </Badge>
        </div>

        {salesLoadFailed && (
          <Alert variant="destructive" className="rounded-[2rem] border-none shadow-lg bg-rose-500/10">
            <AlertTitle className="font-black uppercase tracking-widest text-rose-500">Unable to load setter data</AlertTitle>
            <AlertDescription className="space-y-4 pt-2">
              <p className="font-medium">{loadErrorMessage}</p>
              <Button
                size="sm"
                variant="outline"
                className="rounded-xl border-rose-500/20 text-rose-500 font-bold"
                onClick={() => refetchSales()}
              >
                Retry Request
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* KPIs */}
        {isLoading ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-32 rounded-3xl" />)}
          </div>
        ) : (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard title={t("detail.totalComm")} value={fmt(totalComm)} accent="blue" icon={<DollarSign className="h-5 w-5" />} />
            <StatCard title={t("detail.totalSales")} value={String(sales.length)} subtitle={fmt(totalSales)} accent="green" icon={<ShoppingCart className="h-5 w-5" />} />
            <StatCard title={t("detail.avgComm")} value={fmt(avgCommission)} accent="blue" icon={<TrendingUp className="h-5 w-5" />} />
            <StatCard title={t("detail.refundsUnpaid")} value={`${refundedSales.length} / ${unpaidSales.length}`} subtitle={t("detail.refundsUnpaidSub")} trend="down" accent="red" icon={<AlertTriangle className="h-5 w-5" />} />
          </div>
        )}

        {/* Charts & Sales */}
        <div className="grid gap-6 lg:grid-cols-5">
           <ContentCard title={t("detail.commByProduct")} icon={Layers} className="lg:col-span-2">
              {productData.length === 0 ? (
                <div className="text-center py-20 grayscale opacity-40">
                   <p className="text-sm text-muted-foreground font-medium italic">No sales data recorded yet.</p>
                </div>
              ) : (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={productData} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.border} vertical={false} />
                    <XAxis dataKey="name" fontSize={10} font-weight="700" axisLine={false} tickLine={false} angle={-25} textAnchor="end" height={60} />
                    <YAxis fontSize={10} font-weight="700" axisLine={false} tickLine={false} tickFormatter={(v) => `€${v}`} />
                    <Tooltip 
                      contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.15)', fontWeight: 'bold', background: 'hsl(var(--card))', color: 'hsl(var(--card-foreground))' }}
                      formatter={(v: number) => [fmt(v), "Commission"]} 
                    />
                    <Bar dataKey="commission" fill={CHART_COLORS.primary} radius={[6, 6, 0, 0]} barSize={24} />
                  </BarChart>
                </ResponsiveContainer>
              )}
           </ContentCard>

           <ContentCard title={t("detail.salesHistory")} icon={Eye} className="lg:col-span-3">
              {isLoading ? (
                <div className="space-y-4 py-4">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-12 w-full rounded-xl" />)}</div>
              ) : sales.length === 0 ? (
                <div className="text-center py-20 grayscale opacity-40">
                   <p className="text-sm text-muted-foreground font-medium italic">{t("dashboard.noData")}</p>
                </div>
              ) : (
                <div className="overflow-x-auto -mx-8 sm:mx-0">
                  <Table>
                    <TableHeader className="bg-muted/30">
                      <TableRow className="border-none">
                        <TableHead className="py-4 pl-8 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.date")}</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.client")}</TableHead>
                        <TableHead className="py-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.status")}</TableHead>
                        <TableHead className="py-4 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Commission</TableHead>
                        <TableHead className="py-4 pr-8 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {sales.map(sale => (
                        <TableRow key={sale.id} className="group hover:bg-muted/10 transition-colors border-border/30">
                          <TableCell className="py-5 pl-8 text-xs font-medium text-muted-foreground tabular-nums">{sale.date}</TableCell>
                          <TableCell className="py-5">
                            <p className="font-bold text-sm tracking-tight">{sale.clientName}</p>
                            <p className="text-[10px] text-muted-foreground font-bold uppercase tracking-widest mt-0.5">{sale.product}</p>
                          </TableCell>
                          <TableCell className="py-5">
                             <div className="flex items-center gap-2">
                               <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                               {sale.paymentType === "pif" && <Badge variant="outline" className="text-[9px] font-black text-primary border-primary/20 bg-primary/5 uppercase h-5 px-1.5">PIF</Badge>}
                             </div>
                          </TableCell>
                          <TableCell className="py-5 text-right font-black text-primary tabular-nums">{fmt(sale.setterCommission)}</TableCell>
                          <TableCell className="py-5 pr-8 text-right">
                            <Button variant="ghost" size="sm" onClick={() => setSelectedSale(sale)} className="h-9 w-9 p-0 rounded-xl hover:bg-primary/5 hover:text-primary transition-all">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
           </ContentCard>
        </div>
      </div>
      <SaleDetailsDialog sale={selectedSale} open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)} />
    </AppLayout>
  );
};

export default SetterDetailPage;
