export const createAccountSchema = {
  body: {
    type: 'object',
    required: ['externalRef', 'firstName', 'lastName', 'email', 'creditLimitCents'],
    additionalProperties: false,
    properties: {
      externalRef: { type: 'string', minLength: 1, maxLength: 100 },
      firstName: { type: 'string', minLength: 1, maxLength: 100 },
      lastName: { type: 'string', minLength: 1, maxLength: 100 },
      email: { type: 'string', format: 'email', maxLength: 255 },
      phone: { type: 'string', maxLength: 20 },
      dateOfBirth: { type: 'string', format: 'date' },
      taxId: { type: 'string', maxLength: 50 },
      addressLine1: { type: 'string', maxLength: 255 },
      addressLine2: { type: 'string', maxLength: 255 },
      city: { type: 'string', maxLength: 100 },
      state: { type: 'string', maxLength: 100 },
      postalCode: { type: 'string', maxLength: 20 },
      country: { type: 'string', maxLength: 2, minLength: 2 },
      creditLimitCents: { type: 'integer', minimum: 0 },
      currency: { type: 'string', minLength: 3, maxLength: 3, default: 'USD' },
    },
  },
};

export const updateAccountSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    additionalProperties: false,
    minProperties: 1,
    properties: {
      phone: { type: 'string', maxLength: 20 },
      addressLine1: { type: 'string', maxLength: 255 },
      addressLine2: { type: 'string', maxLength: 255 },
      city: { type: 'string', maxLength: 100 },
      state: { type: 'string', maxLength: 100 },
      postalCode: { type: 'string', maxLength: 20 },
      country: { type: 'string', maxLength: 2, minLength: 2 },
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED'] },
      creditLimitCents: { type: 'integer', minimum: 0 },
    },
  },
};

export const updateKycSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['kycStatus'],
    additionalProperties: false,
    properties: {
      kycStatus: { type: 'string', enum: ['PENDING', 'VERIFIED', 'REJECTED', 'REQUIRES_REVIEW'] },
      notes: { type: 'string', maxLength: 500 },
    },
  },
};

export const idParamSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
};

export const listAccountsSchema = {
  querystring: {
    type: 'object',
    additionalProperties: false,
    properties: {
      status: { type: 'string', enum: ['ACTIVE', 'INACTIVE', 'SUSPENDED', 'CLOSED'] },
      kycStatus: { type: 'string', enum: ['PENDING', 'VERIFIED', 'REJECTED', 'REQUIRES_REVIEW'] },
      cursor: { type: 'string' },
      limit: { type: 'integer', minimum: 1, maximum: 100 },
    },
  },
};
