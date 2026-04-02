/** Core sale record — will map to API response later */
export type Sale = {
  id: string;
  date: string;
  clientName: string;
  clientEmail: string;
  product: string;
  closer: string;
  setter: string;
  amount: number;
  /** Auto-calculated closer commission (8.8%) */
  closerCommission: number;
  /** Auto-calculated setter commission (1%) */
  setterCommission: number;
  bonus?: number;
  refunded?: boolean;
  /** Failed payment / impayé */
  impaye?: boolean;
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
