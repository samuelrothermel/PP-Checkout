// Centralized error handling middleware
export const handleError = (err, req, res, next) => {
  console.error(err);

  // If response was already sent, delegate to default Express error handler
  if (res.headersSent) {
    return next(err);
  }

  const statusCode = err.status || err.statusCode || 500;
  const message = err.message || 'Internal Server Error';

  res.status(statusCode).send(message);
};
