import { useState } from "react";
import { Sale } from "@/types";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import ProfileTag from "@/components/ProfileTag";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Pencil, Trash2 } from "lucide-react";

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

  return (
    <div>
      <div className="overflow-x-auto -mx-6">
        <Table>
          <TableHeader>
            <TableRow className="hover:bg-transparent">
              <TableHead className="pl-6">{t("table.date")}</TableHead>
              <TableHead>{t("table.client")}</TableHead>
              <TableHead>{t("table.closer")}</TableHead>
              <TableHead>{t("table.setter")}</TableHead>
              <TableHead className="text-right">{t("table.amount")}</TableHead>
              <TableHead className="text-right">{t("table.closerComm")}</TableHead>
              <TableHead className="text-right">{t("table.setterComm")}</TableHead>
              <TableHead>{t("table.status")}</TableHead>
              <TableHead className="text-right pr-6">{t("table.actions")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sales.slice(0, visible).map((sale) => (
              <TableRow key={sale.id} className="group">
                <TableCell className="text-muted-foreground pl-6 tabular-nums">{sale.date}</TableCell>
                <TableCell>
                  <div>
                    <p className="font-medium">{sale.clientName}</p>
                    {sale.clientEmail && (
                      <p className="text-xs text-muted-foreground">{sale.clientEmail}</p>
                    )}
                  </div>
                </TableCell>
                <TableCell>
                  <ProfileTag role="closer" personId={sale.closerId} personName={sale.closer} />
                </TableCell>
                <TableCell>
                  <ProfileTag role="setter" personId={sale.setterId} personName={sale.setter} />
                </TableCell>
                <TableCell className="text-right tabular-nums">{fmt(sale.amount)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums text-primary">{fmt(sale.closerCommission)}</TableCell>
                <TableCell className="text-right font-medium tabular-nums text-primary">{fmt(sale.setterCommission)}</TableCell>
                <TableCell>
                  <div className="flex items-center gap-1.5">
                    <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                    {sale.paymentType === "pif" && (
                      <Badge variant="outline" className="text-xs text-primary border-primary/30">PIF</Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right pr-6">
                  <div className="flex justify-end gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => onEdit(sale)}>
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 hover:bg-destructive/10" onClick={() => onDelete(sale.id)}>
                      <Trash2 className="h-3.5 w-3.5 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {sales.length > visible && (
        <div className="mt-3 text-center">
          <Button variant="ghost" size="sm" onClick={() => setVisible(v => v + PAGE_SIZE)}>
            Show more ({sales.length - visible} remaining)
          </Button>
        </div>
      )}
    </div>
  );
};

export default SalesTable;
