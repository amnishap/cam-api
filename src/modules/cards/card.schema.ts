export const createCardSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['type', 'cardholderName'],
    additionalProperties: false,
    properties: {
      type: { type: 'string', enum: ['VIRTUAL', 'PHYSICAL'] },
      cardholderName: { type: 'string', minLength: 1, maxLength: 100 },
      network: { type: 'string', enum: ['VISA', 'MASTERCARD', 'AMEX', 'DISCOVER'] },
      shippingAddress: {
        type: 'object',
        required: ['line1', 'city', 'state', 'postalCode', 'country'],
        additionalProperties: false,
        properties: {
          line1: { type: 'string', maxLength: 255 },
          line2: { type: 'string', maxLength: 255 },
          city: { type: 'string', maxLength: 100 },
          state: { type: 'string', maxLength: 100 },
          postalCode: { type: 'string', maxLength: 20 },
          country: { type: 'string', minLength: 2, maxLength: 2 },
        },
      },
      dailyLimitCents: { type: 'integer', minimum: 0 },
      monthlyLimitCents: { type: 'integer', minimum: 0 },
      transactionLimitCents: { type: 'integer', minimum: 0 },
    },
  },
};

export const updateCardSchema = {
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
      cardholderName: { type: 'string', minLength: 1, maxLength: 100 },
      dailyLimitCents: { type: ['integer', 'null'], minimum: 0 },
      monthlyLimitCents: { type: ['integer', 'null'], minimum: 0 },
      transactionLimitCents: { type: ['integer', 'null'], minimum: 0 },
    },
  },
};

export const cardIdParamSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
};

export const lockCardSchema = cardIdParamSchema;
export const unlockCardSchema = cardIdParamSchema;

export const replaceCardSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: {
      id: { type: 'string', format: 'uuid' },
    },
  },
  body: {
    type: 'object',
    required: ['reason'],
    additionalProperties: false,
    properties: {
      reason: {
        type: 'string',
        enum: ['LOST', 'STOLEN', 'FRAUD', 'DAMAGED'],
      },
    },
  },
};
