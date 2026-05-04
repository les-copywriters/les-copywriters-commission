import { useState } from "react";
import { Sale } from "@/types";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import ProfileTag from "@/components/ProfileTag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CreditCard, Pencil, Trash2, Eye, Undo2 } from "lucide-react";
import SaleDetailsDialog from "@/components/SaleDetailsDialog";

const PAGE_SIZE = 15;

type Props = {
  sales: Sale[];
  onEdit: (sale: Sale) => void;
  onDelete: (id: string) => void;
  onMarkRefund?: (sale: Sale) => void;
  onMarkImpaye?: (sale: Sale) => void;
};

const SalesTable = ({ sales, onEdit, onDelete, onMarkRefund, onMarkImpaye }: Props) => {
  const { t, locale } = useLanguage();
  const fmt = (n: number) => formatCurrency(n, locale);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  return (
    <div>
      <div className="overflow-x-auto">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border/30">
              <TableHead className="pl-4 h-10 text-[11px] font-medium text-muted-foreground">{t("table.date")}</TableHead>
              <TableHead className="h-10 text-[11px] font-medium text-muted-foreground">{t("table.client")}</TableHead>
              <TableHead className="h-10 text-[11px] font-medium text-muted-foreground">{t("table.closer")}</TableHead>
              <TableHead className="h-10 text-[11px] font-medium text-muted-foreground">{t("table.setter")}</TableHead>
              <TableHead className="h-10 text-right text-[11px] font-medium text-muted-foreground">{t("table.amount")}</TableHead>
              <TableHead className="h-10 text-right text-[11px] font-medium text-muted-foreground">{t("table.closerComm")}</TableHead>
              <TableHead className="h-10 text-right text-[11px] font-medium text-muted-foreground">{t("table.setterComm")}</TableHead>
              <TableHead className="h-10 text-[11px] font-medium text-muted-foreground">{t("table.status")}</TableHead>
              <TableHead className="h-10 text-right pr-4 text-[11px] font-medium text-muted-foreground">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.slice(0, visible).map((sale) => (
              <TableRow key={sale.id} className="group hover:bg-muted/20 transition-colors border-border/20">
                <TableCell className="text-muted-foreground pl-4 tabular-nums text-xs">
                  {sale.date}
                </TableCell>
                <TableCell className="max-w-[180px]">
                  <p className="font-medium text-sm truncate">{sale.clientName}</p>
                  {sale.clientEmail && (
                    <p className="text-[11px] text-muted-foreground truncate">{sale.clientEmail}</p>
                  )}
                </TableCell>
                <TableCell>
                  <ProfileTag role="closer" personId={sale.closerId} personName={sale.closer} />
                </TableCell>
                <TableCell>
                  <ProfileTag role="setter" personId={sale.setterId} personName={sale.setter} />
                </TableCell>
                <TableCell className="text-right tabular-nums text-sm text-muted-foreground">
                  {fmt(sale.amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="font-semibold text-primary text-sm">{fmt(sale.closerCommission)}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="font-semibold text-emerald-600 text-sm">{fmt(sale.setterCommission)}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                    {sale.paymentType === "pif" && (
                      <Badge variant="outline" className="text-[9px] font-medium text-primary bg-primary/5 border-primary/20 h-4 px-1.5 rounded uppercase">PIF</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right pr-4">
                  <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => onEdit(sale)}>
                      <Pencil className="h-3 w-3" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-muted" onClick={() => setSelectedSale(sale)}>
                      <Eye className="h-3 w-3" />
                    </Button>
                    {onMarkRefund && !sale.refunded && !sale.impaye && (
                      <Button
                        variant="ghost" size="icon" title="Mark as refunded"
                        className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => onMarkRefund(sale)}
                      >
                        <Undo2 className="h-3 w-3" />
                      </Button>
                    )}
                    {onMarkImpaye && !sale.impaye && !sale.refunded && (
                      <Button
                        variant="ghost" size="icon" title="Mark as failed payment"
                        className="h-7 w-7 rounded-lg hover:bg-amber-500/10 hover:text-amber-600"
                        onClick={() => onMarkImpaye(sale)}
                      >
                        <CreditCard className="h-3 w-3" />
                      </Button>
                    )}
                    <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(sale.id)}>
                      <Trash2 className="h-3 w-3" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {sales.length > visible && (
        <div className="px-4 py-3 border-t border-border/20 text-center">
          <button
            onClick={() => setVisible(v => v + PAGE_SIZE)}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Show {Math.min(PAGE_SIZE, sales.length - visible)} more ({sales.length - visible} remaining)
          </button>
        </div>
      )}

      <SaleDetailsDialog sale={selectedSale} open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)} />
    </div>
  );
};

export default SalesTable;
