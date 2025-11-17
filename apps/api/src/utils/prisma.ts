import { PrismaClient } from "@prisma/client";

// Singleton pattern for PrismaClient to avoid multiple instances
let prisma: PrismaClient | null = null;

export function getPrismaClient(): PrismaClient {
  if (!prisma) {
    prisma = new PrismaClient();
    
    // Enable WAL mode for SQLite concurrency
    // Use queryRawUnsafe since PRAGMA can return results in SQLite
    prisma.$queryRawUnsafe(`PRAGMA journal_mode=WAL;`).catch(console.error);
  }
  
  return prisma;
}

// Export the singleton instance
export const prismaClient = getPrismaClient();

