import { Sale } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import SaleStatusBadge from "@/components/SaleStatusBadge";

type Props = {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SaleDetailsDialog = ({ sale, open, onOpenChange }: Props) => {
  const { locale } = useLanguage();
  const fmt = (n: number) => formatCurrency(n, locale);

  const rows: Array<{ label: string; value: string }> = sale
    ? [
        { label: "Date", value: sale.date },
        { label: "Client", value: sale.clientName },
        { label: "Client email", value: sale.clientEmail || "-" },
        { label: "Product", value: sale.product || "-" },
        { label: "Closed by", value: sale.closer || "-" },
        { label: "Setter", value: sale.setter || "-" },
        { label: "Payment type", value: sale.paymentType || "-" },
        { label: "Payment platform", value: sale.paymentPlatform || "-" },
        { label: "Amount (HT)", value: fmt(sale.amount) },
        { label: "Amount (TTC)", value: sale.amountTTC ? fmt(sale.amountTTC) : "-" },
        { label: "Tax amount", value: sale.taxAmount ? fmt(sale.taxAmount) : "-" },
        { label: "Closer commission", value: fmt(sale.closerCommission) },
        { label: "Setter commission", value: fmt(sale.setterCommission) },
        { label: "Bonus", value: sale.bonus ? fmt(sale.bonus) : "-" },
        { label: "Installments count", value: sale.numInstallments ? String(sale.numInstallments) : "-" },
        { label: "Installment amount", value: sale.installmentAmount ? fmt(sale.installmentAmount) : "-" },
        { label: "First payment date", value: sale.firstPaymentDate || "-" },
        { label: "JotForm submission ID", value: sale.jotformSubmissionId || "-" },
        { label: "Call recording", value: sale.callRecordingLink || "-" },
        { label: "Notes", value: sale.notes || "-" },
      ]
    : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-hidden p-0">
        <DialogHeader>
          <div className="px-6 pt-6">
            <DialogTitle>Sale details</DialogTitle>
          </div>
        </DialogHeader>
        {sale && (
          <div className="space-y-4 overflow-y-auto px-6 pb-6">
            <div className="flex flex-wrap items-center gap-2">
              <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
              {sale.paymentType === "pif" && (
                <Badge variant="outline" className="text-xs text-primary border-primary/30">
                  PIF
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {rows.map((row) => (
                <div key={row.label} className="rounded-md border border-border/60 p-3">
                  <p className="text-xs uppercase tracking-wide text-muted-foreground">{row.label}</p>
                  <p className="mt-1 text-sm font-medium break-all">{row.value}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SaleDetailsDialog;
