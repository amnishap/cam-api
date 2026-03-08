const spendingLimitItem = {
  type: 'object',
  required: ['limitType'],
  additionalProperties: false,
  properties: {
    limitType: {
      type: 'string',
      enum: ['DAILY', 'MONTHLY', 'PER_TRANSACTION', 'MCC_BLOCK', 'MCC_ALLOW'],
    },
    valueCents: { type: ['integer', 'null'], minimum: 0 },
    mccCode: { type: 'string', pattern: '^[0-9]{4}$' },
  },
};

export const setAccountLimitsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['limits'],
    additionalProperties: false,
    properties: {
      limits: {
        type: 'array',
        items: spendingLimitItem,
        minItems: 1,
      },
    },
  },
};

export const getAccountLimitsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
};

export const setCardLimitsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['limits'],
    additionalProperties: false,
    properties: {
      limits: {
        type: 'array',
        items: spendingLimitItem,
        minItems: 1,
      },
    },
  },
};

export const getCardLimitsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
};
