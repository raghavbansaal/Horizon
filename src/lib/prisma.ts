import { Prisma, PrismaClient } from "@prisma/client";

type GlobalPrisma = {
  prismaPrimary?: PrismaClient;
  prismaSecondary?: PrismaClient;
  prismaProxy?: PrismaClient;
};

const globalForPrisma = globalThis as unknown as GlobalPrisma;

const primaryUrl = process.env.DATABASE_URL || process.env.DIRECT_URL;
const secondaryUrl =
  process.env.DATABASE_URL && process.env.DIRECT_URL && process.env.DATABASE_URL !== process.env.DIRECT_URL
    ? process.env.DIRECT_URL
    : undefined;

const createClient = (url?: string) =>
  new PrismaClient(url ? { datasources: { db: { url } } } : undefined);

const primaryClient = globalForPrisma.prismaPrimary ?? createClient(primaryUrl);
if (!globalForPrisma.prismaPrimary) globalForPrisma.prismaPrimary = primaryClient;

const getSecondaryClient = () => {
  if (!secondaryUrl) return undefined;
  if (!globalForPrisma.prismaSecondary) {
    globalForPrisma.prismaSecondary = createClient(secondaryUrl);
  }
  return globalForPrisma.prismaSecondary;
};

function isConnectivityError(error: unknown): boolean {
  if (
    error instanceof Prisma.PrismaClientInitializationError ||
    (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P1001")
  ) {
    return true;
  }
  if (error instanceof Error) {
    return (
      error.message.includes("Can't reach database server") ||
      error.message.includes("Connection terminated unexpectedly")
    );
  }
  return false;
}

function withFailover<T extends object>(target: T, getAltTarget: () => T | undefined): T {
  return new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);

      if (typeof value === "function") {
        return async (...args: unknown[]) => {
          try {
            return await value.apply(obj, args);
          } catch (error) {
            if (!isConnectivityError(error)) throw error;
            const alt = getAltTarget();
            if (!alt) throw error;
            const altFn = Reflect.get(alt as object, prop);
            if (typeof altFn !== "function") throw error;
            return await altFn.apply(alt, args);
          }
        };
      }

      if (value && typeof value === "object") {
        return withFailover(value as object, () => {
          const alt = getAltTarget();
          if (!alt) return undefined;
          const altValue = Reflect.get(alt as object, prop);
          return altValue && typeof altValue === "object" ? (altValue as object) : undefined;
        });
      }

      return value;
    },
  }) as T;
}

export const prisma =
  globalForPrisma.prismaProxy ??
  withFailover(primaryClient, () => getSecondaryClient()) as PrismaClient;

if (!globalForPrisma.prismaProxy) globalForPrisma.prismaProxy = prisma;