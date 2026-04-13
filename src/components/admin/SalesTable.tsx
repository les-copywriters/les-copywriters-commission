import { useState } from "react";
import { Sale } from "@/types";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import ProfileTag from "@/components/ProfileTag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2, Eye } from "lucide-react";
import SaleDetailsDialog from "@/components/SaleDetailsDialog";
import { cn } from "@/lib/utils";

const PAGE_SIZE = 15;

type Props = {
  sales: Sale[];
  onEdit: (sale: Sale) => void;
  onDelete: (id: string) => void;
};

const SalesTable = ({ sales, onEdit, onDelete }: Props) => {
  const { t, locale } = useLanguage();
  const fmt = (n: number) => formatCurrency(n, locale);
  const [visible, setVisible] = useState(PAGE_SIZE);
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null);

  return (
    <div className="space-y-4">
      <div className="rounded-3xl border border-border/40 overflow-hidden bg-background shadow-sm">
        <Table>
          <TableHeader className="bg-muted/30">
            <TableRow className="hover:bg-transparent border-border/40">
              <TableHead className="pl-6 h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.date")}</TableHead>
              <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.client")}</TableHead>
              <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.closer")}</TableHead>
              <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.setter")}</TableHead>
              <TableHead className="h-12 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.amount")}</TableHead>
              <TableHead className="h-12 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.closerComm")}</TableHead>
              <TableHead className="h-12 text-right text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.setterComm")}</TableHead>
              <TableHead className="h-12 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.status")}</TableHead>
              <TableHead className="h-12 text-right pr-6 text-[10px] font-black uppercase tracking-widest text-muted-foreground">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.slice(0, visible).map((sale) => (
              <TableRow key={sale.id} className="group hover:bg-muted/10 transition-colors border-border/30">
                <TableCell className="text-muted-foreground pl-6 tabular-nums text-xs font-medium">
                  {sale.date}
                </TableCell>
                <TableCell className="max-w-[200px]">
                  <div className="flex flex-col">
                    <p className="font-bold text-sm tracking-tight truncate">{sale.clientName}</p>
                    {sale.clientEmail && (
                      <p className="text-[10px] text-muted-foreground font-medium truncate italic">{sale.clientEmail}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <ProfileTag role="closer" personId={sale.closerId} personName={sale.closer} />
                </TableCell>
                <TableCell>
                  <ProfileTag role="setter" personId={sale.setterId} personName={sale.setter} />
                </TableCell>
                <TableCell className="text-right tabular-nums font-medium text-sm">
                  {fmt(sale.amount)}
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="font-black text-primary text-sm tracking-tight">{fmt(sale.closerCommission)}</span>
                </TableCell>
                <TableCell className="text-right tabular-nums">
                  <span className="font-black text-emerald-600 text-sm tracking-tight">{fmt(sale.setterCommission)}</span>
                </TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                    {sale.paymentType === "pif" && (
                      <Badge variant="outline" className="text-[9px] font-black text-primary bg-primary/5 border-primary/20 h-5 px-1.5 px-1.5 uppercase">PIF</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex justify-end gap-1 opacity-20 group-hover:opacity-100 transition-all duration-300 transform group-hover:translate-x-0 translate-x-1">
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-primary/10 hover:text-primary" onClick={() => onEdit(sale)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-muted" onClick={() => setSelectedSale(sale)}>
                      <Eye className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg hover:bg-destructive/10 hover:text-destructive" onClick={() => onDelete(sale.id)}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {sales.length > visible && (
        <div className="mt-6 text-center">
          <Button 
            variant="ghost" 
            size="sm" 
            className="rounded-xl px-6 font-bold text-muted-foreground hover:bg-muted/50 transition-all"
            onClick={() => setVisible(v => v + PAGE_SIZE)}
          >
            Show more ({sales.length - visible} remaining)
          </Button>
        </div>
      )}
      <SaleDetailsDialog sale={selectedSale} open={!!selectedSale} onOpenChange={(open) => !open && setSelectedSale(null)} />
    </div>
  );
};

export default SalesTable;
