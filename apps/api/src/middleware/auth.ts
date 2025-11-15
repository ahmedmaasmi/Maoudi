import { Request, Response, NextFunction } from "express";

export function apiKeyAuth(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.headers["x-api-key"];
  const expectedKey = process.env.BACKEND_API_KEY;

  if (!expectedKey) {
    return res.status(500).json({
      error: {
        code: "CONFIG_ERROR",
        message: "API key not configured",
      },
    });
  }

  if (apiKey !== expectedKey) {
    return res.status(401).json({
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid API key",
      },
    });
  }

  next();
}

