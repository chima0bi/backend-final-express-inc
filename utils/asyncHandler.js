// Wraps an async route handler so thrown errors / rejected promises are
// forwarded to Express's error-handling middleware instead of crashing
// the process or silently hanging the request.
export const asyncHandler = (fn) => (req, res, next) => {
  Promise.resolve(fn(req, res, next)).catch(next);
};
