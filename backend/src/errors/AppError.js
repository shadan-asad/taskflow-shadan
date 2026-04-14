'use strict';

/**
 * AppError — an operational error with an HTTP status code and message.
 *
 * Throw this anywhere in route/controller code to produce a clean JSON
 * response with the correct status and a human-readable message, instead
 * of falling through to a generic 500.
 *
 * Example:
 *   throw new AppError(404, 'project not found');
 *   throw new AppError(403, 'only the project owner can perform this action');
 */
class AppError extends Error {
  /**
   * @param {number} statusCode   HTTP status code (e.g. 400, 403, 404)
   * @param {string} message      Human-readable message sent to the client
   */
  constructor(statusCode, message) {
    super(message);
    this.name = 'AppError';
    this.statusCode = statusCode;
    // Mark as operational so the error handler knows it's intentional
    this.isOperational = true;
    // Capture clean stack trace (V8 only)
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
