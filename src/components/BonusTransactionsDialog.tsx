import { useMemo, useState } from "react";
import { Sale } from "@/types";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import { BonusTier, formatMonth, calculateMonthBonus } from "@/lib/bonusCalculation";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import SaleDetailsDialog from "@/components/SaleDetailsDialog";
import { Calendar, Eye, Gift, Layers, ListChecks, Wallet } from "lucide-react";

export type BonusDrilldownKind = "validatedCount" | "pifBonus" | "volumeBonus" | "total";

type Props = {
  month: string | null; kind: BonusDrilldownKind | null;
  sales: Sale[]; tiers: BonusTier[];
  open: boolean; onOpenChange: (open: boolean) => void;
};

const kindMeta: Record<BonusDrilldownKind, { label: string; icon: typeof Gift; description: string }> = {
  validatedCount: { label: "Validated Sales",  icon: ListChecks, description: "All validated transactions in this cycle." },
  pifBonus:       { label: "PIF Bonus",         icon: Gift,       description: "Only validated PIF transactions contribute to this bonus." },
  volumeBonus:    { label: "Volume Bonus",       icon: Layers,     description: "Validated transactions used to reach the monthly volume tier." },
  total:          { label: "Total Bonus",        icon: Wallet,     description: "Combined view of the validated transactions behind the full monthly reward." },
};

const BonusTransactionsDialog = ({ month, kind, sales, tiers, open, onOpenChange }: Props) => {
  const { locale } = useLanguage();
  const fmt = (n: number) => formatCurrency(n, locale);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  const detail = useMemo(() => {
    if (!month || !kind) return null;
    const monthSales    = sales.filter(s => s.date.slice(0,7) === month).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    const validatedSales = monthSales.filter(s => !s.refunded && !s.impaye);
    const pifSales       = validatedSales.filter(s => s.paymentType === "pif");
    const monthlyBonus   = calculateMonthBonus(monthSales, tiers);
    const includedIds    = new Set((kind === "pifBonus" ? pifSales : validatedSales).map(s => s.id));
    return { monthSales, validatedSales, pifSales, includedIds, monthlyBonus };
  }, [kind, month, sales, tiers]);

  const meta       = kind ? kindMeta[kind] : null;
  const monthLabel = month ? formatMonth(month, locale) : "";

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden rounded-xl border border-border/40 bg-background">

          {/* Header */}
          <DialogHeader className="px-4 py-3 border-b border-border/40 bg-muted/30">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2.5">
                {meta && <meta.icon className="h-4 w-4 text-muted-foreground" />}
                <div>
                  <DialogTitle className="text-base font-semibold">{meta?.label ?? "Bonus Detail"}</DialogTitle>
                  <p className="text-[11px] text-muted-foreground">{monthLabel}</p>
                </div>
              </div>
              {detail && (
                <div className="flex gap-2">
                  <Badge className="rounded-md px-2 py-0.5 text-[10px] font-medium bg-primary/10 text-primary border-primary/20">
                    <Calendar className="h-3 w-3 mr-1" />{detail.validatedSales.length} validated
                  </Badge>
                  <Badge className="rounded-md px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                    {detail.pifSales.length} PIF
                  </Badge>
                </div>
              )}
            </div>
            {meta && <p className="text-[11px] text-muted-foreground mt-1">{meta.description}</p>}
          </DialogHeader>

          {detail && (
            <div className="p-4 space-y-4 max-h-[78vh] overflow-y-auto">

              {/* Summary tiles */}
              <div className="grid gap-3 grid-cols-2 md:grid-cols-4">
                {[
                  { label: "Validated",     value: String(detail.monthlyBonus.validatedCount), color: "" },
                  { label: "PIF Bonus",     value: fmt(detail.monthlyBonus.pifBonus),           color: "text-emerald-600" },
                  { label: "Volume Bonus",  value: fmt(detail.monthlyBonus.volumeBonus),         color: "text-emerald-600" },
                  { label: "Total Bonus",   value: fmt(detail.monthlyBonus.total),               color: "text-primary", highlight: true },
                ].map((item) => (
                  <div key={item.label} className={`rounded-lg border p-3 ${item.highlight ? "border-primary/20 bg-primary/5" : "border-border/40 bg-muted/30"}`}>
                    <p className="text-[11px] text-muted-foreground">{item.label}</p>
                    <p className={`text-lg font-semibold tabular-nums mt-0.5 ${item.color}`}>{item.value}</p>
                  </div>
                ))}
              </div>

              {/* Transactions table */}
              <div className="rounded-lg border border-border/40 overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 bg-muted/30 border-b border-border/40">
                  <p className="text-sm font-medium">Monthly Transactions</p>
                  <span className="text-[11px] text-muted-foreground">{detail.monthSales.length} transaction{detail.monthSales.length !== 1 ? "s" : ""}</span>
                </div>

                {detail.monthSales.length === 0 ? (
                  <p className="p-8 text-center text-sm text-muted-foreground">No transactions found for this month.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="bg-muted/30">
                        <TableRow className="border-none">
                          <TableHead className="pl-4 py-2.5 text-[11px] font-medium text-muted-foreground">Date</TableHead>
                          <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">Client</TableHead>
                          <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">Product</TableHead>
                          <TableHead className="py-2.5 text-right text-[11px] font-medium text-muted-foreground">HT Amount</TableHead>
                          <TableHead className="py-2.5 text-right text-[11px] font-medium text-muted-foreground">Closer Comm</TableHead>
                          <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">Bonus</TableHead>
                          <TableHead className="py-2.5 text-[11px] font-medium text-muted-foreground">Status</TableHead>
                          <TableHead className="pr-4 py-2.5 text-right text-[11px] font-medium text-muted-foreground">View</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {detail.monthSales.map((sale) => {
                          const included = detail.includedIds.has(sale.id);
                          return (
                            <TableRow key={sale.id} className="border-border/20 hover:bg-muted/20 transition-colors">
                              <TableCell className="pl-4 py-3 text-xs text-muted-foreground tabular-nums">{sale.date}</TableCell>
                              <TableCell className="py-3">
                                <p className="font-medium text-sm">{sale.clientName}</p>
                                {sale.clientEmail && <p className="text-[11px] text-muted-foreground truncate max-w-[200px]">{sale.clientEmail}</p>}
                              </TableCell>
                              <TableCell className="py-3 text-sm text-muted-foreground">{sale.product}</TableCell>
                              <TableCell className="py-3 text-right tabular-nums text-sm">{fmt(sale.amount)}</TableCell>
                              <TableCell className="py-3 text-right tabular-nums font-medium text-primary text-sm">{fmt(sale.closerCommission)}</TableCell>
                              <TableCell className="py-3">
                                <Badge className={included
                                  ? "rounded-md px-2 py-0.5 text-[10px] font-medium bg-emerald-500/10 text-emerald-600 border-emerald-500/20"
                                  : "rounded-md px-2 py-0.5 text-[10px] font-medium bg-muted text-muted-foreground border-border/40"}>
                                  {included ? "Included" : "Excluded"}
                                </Badge>
                              </TableCell>
                              <TableCell className="py-3">
                                <div className="flex items-center gap-1.5">
                                  <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                                  {sale.paymentType === "pif" && (
                                    <Badge className="rounded-md px-1.5 py-0.5 text-[9px] font-medium text-emerald-600 bg-emerald-500/10 border-emerald-500/20 uppercase">PIF</Badge>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell className="pr-4 py-3 text-right">
                                <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => setSelectedSale(sale)}>
                                  <Eye className="h-3.5 w-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </div>

              {/* Note */}
              <div className="rounded-lg border border-border/40 bg-muted/20 px-3 py-2.5">
                <p className="text-[11px] text-muted-foreground font-medium mb-1">Calculation Note</p>
                <p className="text-[11px] text-muted-foreground">
                  Bonus drill-downs use validated sales only — refunded or unpaid transactions are excluded.
                  {kind === "pifBonus" ? " PIF slice further filters to paymentType = pif." : ""}
                </p>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <SaleDetailsDialog sale={selectedSale} open={!!selectedSale} onOpenChange={(o) => !o && setSelectedSale(null)} />
    </>
  );
};

export default BonusTransactionsDialog;
