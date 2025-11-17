import { Router, Request, Response } from "express";
import { prismaClient } from "../utils/prisma";

const router = Router();

router.get("/", async (req: Request, res: Response) => {
  let databaseStatus = "disconnected";

  try {
    await prismaClient.$queryRaw`SELECT 1`;
    databaseStatus = "connected";
  } catch (error) {
    console.error("Database health check failed:", error);
  }

  res.json({
    status: "ok",
    database: databaseStatus,
    timestamp: new Date().toISOString(),
  });
});

export default router;

