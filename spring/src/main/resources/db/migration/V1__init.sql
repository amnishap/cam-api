-- CAM Database Schema
-- Matches the Prisma schema exactly

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Accounts table
CREATE TABLE accounts (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    external_ref            VARCHAR(255) NOT NULL,
    status                  VARCHAR(20)  NOT NULL DEFAULT 'INACTIVE',
    first_name              VARCHAR(255) NOT NULL,
    last_name               VARCHAR(255) NOT NULL,
    email                   VARCHAR(255) NOT NULL,
    phone                   VARCHAR(50),
    date_of_birth           DATE,
    tax_id                  VARCHAR(50),
    kyc_status              VARCHAR(20)  NOT NULL DEFAULT 'PENDING',
    kyc_verified_at         TIMESTAMP,
    address_line1           VARCHAR(255),
    address_line2           VARCHAR(255),
    city                    VARCHAR(100),
    state                   VARCHAR(100),
    postal_code             VARCHAR(20),
    country                 VARCHAR(100),
    credit_limit_cents      BIGINT       NOT NULL DEFAULT 0,
    available_balance_cents BIGINT       NOT NULL DEFAULT 0,
    statement_balance_cents BIGINT       NOT NULL DEFAULT 0,
    currency                VARCHAR(3)   NOT NULL DEFAULT 'USD',
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT uq_accounts_external_ref UNIQUE (external_ref),
    CONSTRAINT uq_accounts_email        UNIQUE (email),
    CONSTRAINT chk_account_status       CHECK (status IN ('ACTIVE','INACTIVE','SUSPENDED','CLOSED')),
    CONSTRAINT chk_kyc_status           CHECK (kyc_status IN ('PENDING','VERIFIED','REJECTED','REQUIRES_REVIEW'))
);

-- Cards table
CREATE TABLE cards (
    id                      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id              UUID         NOT NULL,
    type                    VARCHAR(20)  NOT NULL,
    status                  VARCHAR(30)  NOT NULL DEFAULT 'PENDING_ACTIVATION',
    is_locked               BOOLEAN      NOT NULL DEFAULT false,
    last4                   VARCHAR(4)   NOT NULL,
    masked_pan              VARCHAR(25)  NOT NULL,
    network                 VARCHAR(20)  NOT NULL DEFAULT 'VISA',
    expiry_month            INT          NOT NULL,
    expiry_year             INT          NOT NULL,
    cardholder_name         VARCHAR(255) NOT NULL,
    shipping_address        JSONB,
    daily_limit_cents       BIGINT,
    monthly_limit_cents     BIGINT,
    transaction_limit_cents BIGINT,
    activated_at            TIMESTAMP,
    deactivated_at          TIMESTAMP,
    expires_at              TIMESTAMP,
    created_at              TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at              TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_cards_account FOREIGN KEY (account_id) REFERENCES accounts (id),
    CONSTRAINT chk_card_type    CHECK (type IN ('VIRTUAL','PHYSICAL')),
    CONSTRAINT chk_card_status  CHECK (status IN ('PENDING_ACTIVATION','ACTIVE','INACTIVE','SUSPENDED','CLOSED'))
);

CREATE INDEX idx_cards_account_id ON cards (account_id);
CREATE INDEX idx_cards_status     ON cards (status);

-- Account spending limits
CREATE TABLE account_spending_limits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    account_id  UUID         NOT NULL,
    limit_type  VARCHAR(20)  NOT NULL,
    value_cents BIGINT,
    mcc_code    VARCHAR(4),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_account_spending_limits_account FOREIGN KEY (account_id) REFERENCES accounts (id),
    CONSTRAINT uq_account_limit_type_mcc          UNIQUE (account_id, limit_type, mcc_code),
    CONSTRAINT chk_account_limit_type             CHECK (limit_type IN ('DAILY','MONTHLY','PER_TRANSACTION','MCC_BLOCK','MCC_ALLOW'))
);

-- Card spending limits
CREATE TABLE card_spending_limits (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    card_id     UUID         NOT NULL,
    limit_type  VARCHAR(20)  NOT NULL,
    value_cents BIGINT,
    mcc_code    VARCHAR(4),
    created_at  TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP    NOT NULL DEFAULT NOW(),

    CONSTRAINT fk_card_spending_limits_card FOREIGN KEY (card_id) REFERENCES cards (id),
    CONSTRAINT uq_card_limit_type_mcc       UNIQUE (card_id, limit_type, mcc_code),
    CONSTRAINT chk_card_limit_type          CHECK (limit_type IN ('DAILY','MONTHLY','PER_TRANSACTION','MCC_BLOCK','MCC_ALLOW'))
);
