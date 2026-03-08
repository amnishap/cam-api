import { AppError } from './AppError';

export class ValidationError extends AppError {
  readonly statusCode = 422;
  readonly code = 'VALIDATION_ERROR';

  constructor(message: string) {
    super(message);
  }
}
