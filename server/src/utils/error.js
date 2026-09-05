export class ApiError extends Error {
  constructor(status, message, details) {
    super(message);
    this.status = status;
    this.details = details;
  }
}

export const notFoundHandler = (req, res, next) => {
  next(new ApiError(404, `Route ${req.originalUrl} not found`));
};

export const errorHandler = (err, req, res, next) => {
  let status = err.status || 500;
  let message = err.message || "Internal server error";
  if (err.name === "CastError") {
    status = 400;
    message = "Invalid id format";
  }
  if (err.name === "ValidationError") {
    status = 400;
    message = Object.values(err.errors || {})
      .map((e) => e.message)
      .join(", ");
  }
  if (err.code === 11000) {
    status = 400;
    message = "Duplicate value: this record already exists";
  }
  if (status >= 500) console.error("ERR:", err);
  res.status(status).json({ success: false, message, details: err.details });
};