import { AppError } from './AppError';

export class BusinessRuleError extends AppError {
  readonly statusCode = 422;
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.code = code;
  }
}
