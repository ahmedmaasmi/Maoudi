import { Router, Request, Response } from "express";
import { geocode } from "../services/geocode";
import { AppError } from "../utils/errors";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  const query = req.query.q as string;

  if (!query) {
    throw new AppError("MISSING_QUERY", "Query parameter 'q' is required", 400);
  }

  try {
    const result = await geocode(query);
    res.json(result);
  } catch (error) {
    if (error instanceof Error) {
      throw new AppError("GEOCODE_ERROR", error.message, 500);
    }
    throw error;
  }
});

export default router;

