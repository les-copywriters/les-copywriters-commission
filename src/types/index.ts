/** Core sale record */
export type Sale = {
  id: string;
  date: string;
  clientName: string;
  clientEmail: string;
  product: string;
  closer: string;            // display name
  setter: string | null;     // display name (null when no setter)
  closerId: string;          // profiles.id
  setterId: string | null;   // profiles.id (null when no setter)
  amount: number;       // HT (ex-tax)
  amountTTC?: number;
  taxAmount?: number;
  closerCommission: number;
  setterCommission: number;
  bonus?: number;
  refunded?: boolean;
  impaye?: boolean;
  paymentType?: "pif" | "installments";
  numInstallments?: number;
  installmentAmount?: number;
  firstPaymentDate?: string;
  paymentPlatform?: string;
  callRecordingLink?: string;
  notes?: string;
  jotformSubmissionId?: string;
};

export type UserRole = "closer" | "setter" | "admin";

export type User = {
  id: string;
  name: string;
  role: UserRole;
};

export type Refund = {
  id: string;
  saleId: string;
  amount: number;
  date: string;
  status: "pending" | "approved" | "refused";
};

export type Impaye = {
  id: string;
  saleId: string;
  amount: number;
  date: string;
};
