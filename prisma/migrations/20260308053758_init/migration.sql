-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('ACTIVE', 'INACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "CardType" AS ENUM ('VIRTUAL', 'PHYSICAL');

-- CreateEnum
CREATE TYPE "CardStatus" AS ENUM ('PENDING_ACTIVATION', 'ACTIVE', 'INACTIVE', 'SUSPENDED', 'CLOSED');

-- CreateEnum
CREATE TYPE "KycStatus" AS ENUM ('PENDING', 'VERIFIED', 'REJECTED', 'REQUIRES_REVIEW');

-- CreateEnum
CREATE TYPE "LimitType" AS ENUM ('DAILY', 'MONTHLY', 'PER_TRANSACTION', 'MCC_BLOCK', 'MCC_ALLOW');

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "external_ref" TEXT NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'INACTIVE',
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "phone" TEXT,
    "date_of_birth" DATE,
    "tax_id" TEXT,
    "kyc_status" "KycStatus" NOT NULL DEFAULT 'PENDING',
    "kyc_verified_at" TIMESTAMP(3),
    "address_line1" TEXT,
    "address_line2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postal_code" TEXT,
    "country" TEXT,
    "credit_limit_cents" INTEGER NOT NULL DEFAULT 0,
    "available_balance_cents" INTEGER NOT NULL DEFAULT 0,
    "statement_balance_cents" INTEGER NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cards" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "type" "CardType" NOT NULL,
    "status" "CardStatus" NOT NULL DEFAULT 'PENDING_ACTIVATION',
    "last4" TEXT NOT NULL,
    "masked_pan" TEXT NOT NULL,
    "network" TEXT NOT NULL DEFAULT 'VISA',
    "expiry_month" INTEGER NOT NULL,
    "expiry_year" INTEGER NOT NULL,
    "cardholder_name" TEXT NOT NULL,
    "shipping_address" JSONB,
    "daily_limit_cents" INTEGER,
    "monthly_limit_cents" INTEGER,
    "transaction_limit_cents" INTEGER,
    "activated_at" TIMESTAMP(3),
    "deactivated_at" TIMESTAMP(3),
    "expires_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cards_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "account_spending_limits" (
    "id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "limit_type" "LimitType" NOT NULL,
    "value_cents" INTEGER,
    "mcc_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "account_spending_limits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "card_spending_limits" (
    "id" TEXT NOT NULL,
    "card_id" TEXT NOT NULL,
    "limit_type" "LimitType" NOT NULL,
    "value_cents" INTEGER,
    "mcc_code" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "card_spending_limits_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "accounts_external_ref_key" ON "accounts"("external_ref");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_email_key" ON "accounts"("email");

-- CreateIndex
CREATE INDEX "idx_cards_account_id" ON "cards"("account_id");

-- CreateIndex
CREATE INDEX "idx_cards_status" ON "cards"("status");

-- CreateIndex
CREATE UNIQUE INDEX "account_spending_limits_account_id_limit_type_mcc_code_key" ON "account_spending_limits"("account_id", "limit_type", "mcc_code");

-- CreateIndex
CREATE UNIQUE INDEX "card_spending_limits_card_id_limit_type_mcc_code_key" ON "card_spending_limits"("card_id", "limit_type", "mcc_code");

-- AddForeignKey
ALTER TABLE "cards" ADD CONSTRAINT "cards_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "account_spending_limits" ADD CONSTRAINT "account_spending_limits_account_id_fkey" FOREIGN KEY ("account_id") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "card_spending_limits" ADD CONSTRAINT "card_spending_limits_card_id_fkey" FOREIGN KEY ("card_id") REFERENCES "cards"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
