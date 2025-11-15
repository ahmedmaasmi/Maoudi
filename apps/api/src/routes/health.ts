import { Router, Request, Response } from "express";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

router.get("/", async (req: Request, res: Response) => {
  let databaseStatus = "disconnected";

  try {
    await prisma.$queryRaw`SELECT 1`;
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

