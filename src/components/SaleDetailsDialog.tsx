import { Sale } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import { cn } from "@/lib/utils";
import { FileText, Calendar, User, Tag, CreditCard, DollarSign, MessageSquare, Link as LinkIcon } from "lucide-react";

type Props = { sale: Sale | null; open: boolean; onOpenChange: (open: boolean) => void };

const SaleDetailsDialog = ({ sale, open, onOpenChange }: Props) => {
  const { locale } = useLanguage();
  const fmt = (n: number) => formatCurrency(n, locale);

  const groups = sale ? [
    {
      title: "Essential Info", icon: FileText,
      items: [
        { label: "Client",  value: sale.clientName, icon: User     },
        { label: "Product", value: sale.product,    icon: Tag      },
        { label: "Date",    value: sale.date,        icon: Calendar },
        { label: "Email",   value: sale.clientEmail, isEmail: true  },
      ],
    },
    {
      title: "Financials", icon: DollarSign,
      items: [
        { label: "Amount (HT)",  value: fmt(sale.amount),            isBold: true },
        { label: "Closer Comm",  value: fmt(sale.closerCommission),  color: "text-primary" },
        { label: "Setter Comm",  value: fmt(sale.setterCommission),  color: "text-emerald-600" },
        { label: "Payment",      value: sale.paymentType?.toUpperCase(), badge: true },
      ],
    },
    {
      title: "Logistics", icon: CreditCard,
      items: [
        { label: "Platform",      value: sale.paymentPlatform },
        { label: "Installments",  value: sale.numInstallments ? `${sale.numInstallments} payments` : "-" },
        { label: "Recording",     value: sale.callRecordingLink, isLink: true },
        { label: "JotForm ID",    value: sale.jotformSubmissionId },
      ],
    },
  ] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden rounded-xl border border-border/40 bg-background">
        <DialogHeader className="px-4 py-3 border-b border-border/40 bg-muted/30">
          <div className="flex items-center justify-between">
            <div>
              <DialogTitle className="text-base font-semibold">Transaction Detail</DialogTitle>
              <p className="text-[11px] text-muted-foreground mt-0.5">Internal record</p>
            </div>
            {sale && <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />}
          </div>
        </DialogHeader>

        {sale && (
          <div className="p-4 max-h-[70vh] overflow-y-auto space-y-5">
            {groups.map((group, idx) => (
              <div key={idx} className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <group.icon className="h-3.5 w-3.5 text-muted-foreground" />
                  <p className="text-xs font-medium text-muted-foreground">{group.title}</p>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {group.items.map((item, i) => (
                    <div key={i} className="p-3 rounded-lg bg-muted/40">
                      <p className="text-[11px] text-muted-foreground mb-0.5">{item.label}</p>
                      <p className={cn("text-sm font-medium break-all", item.isBold && "text-base font-semibold", item.color)}>
                        {item.isLink && item.value ? (
                          <a href={item.value} target="_blank" rel="noreferrer"
                            className="text-primary hover:underline flex items-center gap-1">
                            Go to Link <LinkIcon className="h-3 w-3" />
                          </a>
                        ) : item.value || "—"}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            ))}

            {sale.notes && (
              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5 text-amber-500" />
                  <p className="text-xs font-medium text-muted-foreground">Notes</p>
                </div>
                <div className="p-3 rounded-lg bg-amber-500/5 border border-amber-500/15 text-sm text-amber-700 dark:text-amber-400 italic">
                  "{sale.notes}"
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SaleDetailsDialog;
