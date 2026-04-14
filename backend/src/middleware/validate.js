'use strict';

/**
 * Zod validation middleware factory.
 *
 * Usage:
 *   router.post('/path', validate(MyZodSchema), controller)
 *
 * On failure, throws a ZodError (caught by errorHandler → 400).
 * On success, replaces req.body with the parsed (type-safe) data.
 */
function validate(schema) {
  return (req, res, next) => {
    try {
      req.body = schema.parse(req.body);
      next();
    } catch (err) {
      next(err); // forwarded to errorHandler
    }
  };
}

module.exports = validate;
