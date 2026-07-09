import type { RequestHandler } from 'express';
import { HttpError } from '../utils/HttpError.js';

export const notFoundHandler: RequestHandler = (request, _response, next) => {
  next(
    new HttpError(
      404,
      'ROUTE_NOT_FOUND',
      `接口 ${request.method} ${request.path} 不存在`,
    ),
  );
};
