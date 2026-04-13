import { Sale } from "@/types";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/i18n";
import { formatCurrency } from "@/lib/formatCurrency";
import SaleStatusBadge from "@/components/SaleStatusBadge";
import { cn } from "@/lib/utils";
import { FileText, Calendar, User, Tag, CreditCard, DollarSign, MessageSquare, Link as LinkIcon } from "lucide-react";

type Props = {
  sale: Sale | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const SaleDetailsDialog = ({ sale, open, onOpenChange }: Props) => {
  const { locale, t } = useLanguage();
  const fmt = (n: number) => formatCurrency(n, locale);

  const groups = sale ? [
    {
      title: "Essential Info",
      icon: FileText,
      items: [
        { label: "Client", value: sale.clientName, icon: User },
        { label: "Product", value: sale.product, icon: Tag },
        { label: "Date", value: sale.date, icon: Calendar },
        { label: "Email", value: sale.clientEmail, isEmail: true },
      ]
    },
    {
      title: "Financials",
      icon: DollarSign,
      items: [
        { label: "Amount (HT)", value: fmt(sale.amount), isBold: true },
        { label: "Closer Comm", value: fmt(sale.closerCommission), color: "text-primary" },
        { label: "Setter Comm", value: fmt(sale.setterCommission), color: "text-emerald-500" },
        { label: "Payment", value: sale.paymentType?.toUpperCase(), badge: true },
      ]
    },
    {
      title: "Logistics",
      icon: CreditCard,
      items: [
        { label: "Platform", value: sale.paymentPlatform },
        { label: "Installments", value: sale.numInstallments ? `${sale.numInstallments} payments` : "-" },
        { label: "Recording", value: sale.callRecordingLink, isLink: true },
        { label: "JotForm ID", value: sale.jotformSubmissionId },
      ]
    }
  ] : [];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl p-0 overflow-hidden border-none shadow-premium rounded-[2.5rem] bg-background">
        <DialogHeader className="p-8 pb-4 border-b border-border/40">
           <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="text-2xl font-black tracking-tight">Transaction Detail</DialogTitle>
                <p className="text-xs font-black uppercase tracking-[0.2em] text-muted-foreground mt-1">System Internal Record</p>
              </div>
              {sale && (
                <div className="flex items-center gap-2">
                  <SaleStatusBadge refunded={sale.refunded} impaye={sale.impaye} />
                </div>
              )}
           </div>
        </DialogHeader>

        {sale && (
          <div className="p-8 pt-6 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-8">
            <div className="grid grid-cols-1 gap-8">
              {groups.map((group, idx) => (
                <div key={idx} className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-primary/10 text-primary">
                       <group.icon className="h-4 w-4" />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">{group.title}</h4>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    {group.items.map((item, i) => (
                      <div key={i} className="group p-4 rounded-2xl bg-muted/20 border border-transparent hover:border-primary/20 hover:bg-muted/30 transition-all">
                        <p className="text-[9px] font-black uppercase tracking-widest text-muted-foreground/50 mb-1">{item.label}</p>
                        <p className={cn(
                          "text-sm font-bold tracking-tight break-all",
                          item.isBold && "text-lg font-black",
                          item.color
                        )}>
                          {item.isLink && item.value ? (
                            <a href={item.value} target="_blank" rel="noreferrer" className="text-primary hover:underline flex items-center gap-1">
                               Go to Link <LinkIcon className="h-3 w-3" />
                            </a>
                          ) : item.value || "-"}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              ))}

              {sale.notes && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="p-2 rounded-lg bg-amber-500/10 text-amber-500">
                       <MessageSquare className="h-4 w-4" />
                    </div>
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/60">Admin Notes</h4>
                  </div>
                  <div className="p-6 rounded-[2rem] bg-amber-500/5 border border-amber-500/10 italic text-sm font-medium text-amber-600 dark:text-amber-400 leading-relaxed">
                    "{sale.notes}"
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default SaleDetailsDialog;
