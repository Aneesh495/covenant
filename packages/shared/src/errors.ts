export type CovenantErrorCode =
  | "INVALID_INPUT"
  | "FILE_TOO_LARGE"
  | "UNSUPPORTED_MEDIA_TYPE"
  | "CORRUPT_DOCUMENT"
  | "ENCRYPTED_DOCUMENT"
  | "EXTRACTION_TIMEOUT"
  | "SCHEMA_VALIDATION_FAILED"
  | "CITATION_INVALID"
  | "SPAN_OUT_OF_BOUNDS"
  | "QUOTE_MISMATCH"
  | "FACTUAL_DRIFT"
  | "POLICY_SYNTAX_ERROR"
  | "POLICY_TYPE_ERROR"
  | "POLICY_EVALUATION_ERROR"
  | "TASK_NOT_FOUND"
  | "LEASE_EXPIRED"
  | "FENCING_TOKEN_MISMATCH"
  | "WORKSPACE_ACCESS_DENIED"
  | "DOCUMENT_NOT_FOUND"
  | "VERSION_NOT_FOUND"
  | "BLOB_NOT_FOUND"
  | "MODEL_PROVIDER_ERROR"
  | "MODEL_TIMEOUT"
  | "RATE_LIMITED"
  | "INTERNAL_ERROR";

export class CovenantError extends Error {
  public readonly code: CovenantErrorCode;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;
  public readonly retryable: boolean;

  constructor(options: {
    message: string;
    code: CovenantErrorCode;
    statusCode?: number;
    details?: Record<string, unknown>;
    retryable?: boolean;
    cause?: unknown;
  }) {
    super(options.message);
    this.name = "CovenantError";
    this.code = options.code;
    this.statusCode = options.statusCode ?? 500;
    this.details = options.details;
    this.retryable = options.retryable ?? false;
    if (options.cause) {
      this.cause = options.cause;
    }
    Object.setPrototypeOf(this, new.target.prototype);
  }

  toJSON() {
    return {
      error: {
        code: this.code,
        message: this.message,
        details: this.details,
        retryable: this.retryable,
      },
    };
  }
}

export class IngestionError extends CovenantError {
  constructor(message: string, code: CovenantErrorCode, details?: Record<string, unknown>) {
    const statusCode =
      code === "FILE_TOO_LARGE"
        ? 413
        : code === "UNSUPPORTED_MEDIA_TYPE"
        ? 415
        : code === "CORRUPT_DOCUMENT" || code === "ENCRYPTED_DOCUMENT"
        ? 422
        : 400;
    super({ message, code, statusCode, details, retryable: false });
    this.name = "IngestionError";
  }
}

export class EvidenceVerificationError extends CovenantError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      code: "CITATION_INVALID",
      statusCode: 422,
      details,
      retryable: false,
    });
    this.name = "EvidenceVerificationError";
  }
}

export class FactualDriftError extends CovenantError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      code: "FACTUAL_DRIFT",
      statusCode: 422,
      details,
      retryable: false,
    });
    this.name = "FactualDriftError";
  }
}

export class PolicyExecutionError extends CovenantError {
  constructor(message: string, code: "POLICY_SYNTAX_ERROR" | "POLICY_TYPE_ERROR" | "POLICY_EVALUATION_ERROR", details?: Record<string, unknown>) {
    super({
      message,
      code,
      statusCode: 400,
      details,
      retryable: false,
    });
    this.name = "PolicyExecutionError";
  }
}

export class TaskLeaseError extends CovenantError {
  constructor(message: string, code: "LEASE_EXPIRED" | "FENCING_TOKEN_MISMATCH", details?: Record<string, unknown>) {
    super({
      message,
      code,
      statusCode: 409,
      details,
      retryable: true,
    });
    this.name = "TaskLeaseError";
  }
}

export class WorkspaceAuthorizationError extends CovenantError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      code: "WORKSPACE_ACCESS_DENIED",
      statusCode: 403,
      details,
      retryable: false,
    });
    this.name = "WorkspaceAuthorizationError";
  }
}

export class ModelProviderError extends CovenantError {
  constructor(message: string, retryable = true, details?: Record<string, unknown>, cause?: unknown) {
    super({
      message,
      code: "MODEL_PROVIDER_ERROR",
      statusCode: 502,
      details,
      retryable,
      cause,
    });
    this.name = "ModelProviderError";
  }
}
