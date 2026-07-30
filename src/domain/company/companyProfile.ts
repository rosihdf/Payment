/** Zentral gepflegte Unternehmensdaten für Angebotsdokumente. Nur belegte Werte. */
export interface CompanyProfile {
  companyName: string;
  legalForm: string;
  street: string;
  postalCode: string;
  city: string;
  phone: string;
  email: string;
  website: string;
  managingDirector: string;
  registerCourt: string;
  registerNumber: string;
  vatId: string;
  bankName: string;
  iban: string;
  bic: string;
}

/** Aus App-Kontext bekannte Minimangaben; übrige Felder bewusst leer. */
export const DEFAULT_COMPANY_PROFILE: CompanyProfile = {
  companyName: 'AMRtech',
  legalForm: '',
  street: '',
  postalCode: '',
  city: '',
  phone: '',
  email: '',
  website: '',
  managingDirector: '',
  registerCourt: '',
  registerNumber: '',
  vatId: '',
  bankName: '',
  iban: '',
  bic: '',
};

export function getCompanyProfile(): CompanyProfile {
  return { ...DEFAULT_COMPANY_PROFILE };
}
