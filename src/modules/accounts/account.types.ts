import { AccountStatus, KycStatus } from '@prisma/client';

export interface CreateAccountBody {
  externalRef: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  dateOfBirth?: string;
  taxId?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  creditLimitCents: number;
  currency?: string;
}

export interface UpdateAccountBody {
  phone?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  status?: AccountStatus;
  creditLimitCents?: number;
}

export interface UpdateKycBody {
  kycStatus: KycStatus;
  notes?: string;
}

export interface ListAccountsQuery {
  status?: AccountStatus;
  kycStatus?: KycStatus;
  cursor?: string;
  limit?: string;
}
