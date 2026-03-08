import { CardType } from '@prisma/client';

export interface CreateCardBody {
  type: CardType;
  cardholderName: string;
  network?: string;
  shippingAddress?: {
    line1: string;
    line2?: string;
    city: string;
    state: string;
    postalCode: string;
    country: string;
  };
  dailyLimitCents?: number;
  monthlyLimitCents?: number;
  transactionLimitCents?: number;
}

export interface UpdateCardBody {
  cardholderName?: string;
  dailyLimitCents?: number | null;
  monthlyLimitCents?: number | null;
  transactionLimitCents?: number | null;
}
