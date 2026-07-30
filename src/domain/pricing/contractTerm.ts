export type ContractTermStatus = 'active' | 'inactive';

export interface ContractTerm {
  id: string;
  contractTypeId: string | null;
  name: string;
  months: number;
  isStandard: boolean;
  status: ContractTermStatus;
  validFrom: string | null;
  validUntil: string | null;
  createdAt: string;
  updatedAt: string;
}
