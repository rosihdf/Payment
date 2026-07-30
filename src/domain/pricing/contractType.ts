export type ContractTypeStatus = 'active' | 'inactive';

export interface ContractType {
  id: string;
  code: string;
  name: string;
  status: ContractTypeStatus;
  createdAt: string;
  updatedAt: string;
}
