export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public resource?: string,
    public code?: string,
  ) {
    super(message);
    this.name = "ApiError";
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isForbidden(): boolean {
    return this.status === 403;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  get isUnprocessable(): boolean {
    return this.status === 422;
  }

  get isRateLimited(): boolean {
    return this.status === 429;
  }

  get isNotImplemented(): boolean {
    return this.status === 501;
  }

  get isUnavailable(): boolean {
    return this.status === 503;
  }
}

export function userFacingError(error: unknown, fallback: string): string {
  if (error instanceof ApiError) {
    if (error.isNotImplemented) {
      return "This information is not available from the API yet.";
    }
    if (error.isNotFound) {
      return "The requested record was not found.";
    }
    if (error.isForbidden) {
      return "You do not have permission to view this information.";
    }
    if (error.isUnauthorized) {
      return "You need to sign in to view this information.";
    }
    if (error.isConflict) {
      return "This request conflicts with an existing record.";
    }
    if (error.isUnprocessable) {
      return "The server could not accept this information.";
    }
    if (error.isRateLimited) {
      return "Too many requests. Please try again later.";
    }
    if (error.isUnavailable) {
      return "The service is temporarily unavailable.";
    }
    if (error.status === 400) {
      return error.message || "The request was not valid.";
    }
    return error.message || fallback;
  }
  if (error instanceof TypeError) {
    return "We couldn't reach the server. Please try again.";
  }
  return fallback;
}
