export const createTransactionSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  body: {
    type: 'object',
    required: ['type', 'amountCents'],
    additionalProperties: false,
    properties: {
      cardId:           { type: 'string', format: 'uuid' },
      type:             { type: 'string', enum: ['PURCHASE', 'REFUND', 'PAYMENT', 'FEE', 'ADJUSTMENT'] },
      amountCents:      { type: 'integer', minimum: 1 },
      currency:         { type: 'string', minLength: 3, maxLength: 3 },
      merchantName:     { type: 'string', maxLength: 200 },
      merchantCategory: { type: 'string', minLength: 4, maxLength: 4 },
      description:      { type: 'string', maxLength: 500 },
      settleImmediately:{ type: 'boolean' },
    },
  },
};

export const listTransactionsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  querystring: {
    type: 'object',
    properties: {
      status:  { type: 'string', enum: ['PENDING', 'SETTLED', 'DECLINED', 'REVERSED'] },
      type:    { type: 'string', enum: ['PURCHASE', 'REFUND', 'PAYMENT', 'FEE', 'ADJUSTMENT'] },
      cardId:  { type: 'string', format: 'uuid' },
      from:    { type: 'string' },
      to:      { type: 'string' },
      cursor:  { type: 'string' },
      limit:   { type: 'integer', minimum: 1, maximum: 100, default: 20 },
    },
  },
};

export const listCardTransactionsSchema = {
  params: {
    type: 'object',
    required: ['id'],
    properties: { id: { type: 'string', format: 'uuid' } },
  },
  querystring: listTransactionsSchema.querystring,
};
