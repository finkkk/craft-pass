import type { ErrorRequestHandler } from 'express';
import { env } from '../config/env.js';
import { HttpError } from '../utils/HttpError.js';

function isInvalidJsonError(error: unknown): error is SyntaxError {
  return (
    error instanceof SyntaxError &&
    'status' in error &&
    error.status === 400 &&
    'body' in error
  );
}

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _request,
  response,
  _next,
) => {
  let statusCode = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = '服务器内部错误';
  let details: unknown;

  if (error instanceof HttpError) {
    statusCode = error.statusCode;
    code = error.code;
    message = error.message;
    details = error.details;
  } else if (isInvalidJsonError(error)) {
    statusCode = 400;
    code = 'INVALID_JSON';
    message = '请求体不是有效的 JSON';
  }

  if (statusCode >= 500 && !(error instanceof HttpError)) {
    console.error('未处理的请求错误', {
      requestId: response.locals.requestId,
      error,
    });
  }

  response.status(statusCode).json({
    error: {
      code,
      message:
        statusCode >= 500 && env.nodeEnv === 'production'
          ? '服务器内部错误'
          : message,
      requestId: response.locals.requestId,
      ...(details === undefined ? {} : { details }),
    },
  });
};
