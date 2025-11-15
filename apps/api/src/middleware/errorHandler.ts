import { Request, Response, NextFunction } from "express";
import { createErrorResponse } from "../utils/errors";

export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  next: NextFunction
) {
  const errorResponse = createErrorResponse(err);
  const statusCode =
    err && typeof err === "object" && "statusCode" in err
      ? (err.statusCode as number)
      : 500;

  console.error("Error:", {
    error: err,
    path: req.path,
    method: req.method,
    timestamp: new Date().toISOString(),
  });

  res.status(statusCode).json(errorResponse);
}

