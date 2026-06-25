import path from "node:path";
import { PrismaClient } from "@/generated/prisma/client";
import { PrismaLibSql } from "@prisma/adapter-libsql";

// Prisma 7 はドライバアダプタ必須。ローカルMVPは libsql(SQLite) を使用。
// SQLite ファイルは <project>/prisma/dev.db。env で上書き可能（Postgres移行時はアダプタ差替え）。
function resolveUrl(): string {
  const fromEnv = process.env.DATABASE_URL;
  if (fromEnv && fromEnv.startsWith("file:")) {
    // 相対パスはプロジェクトルート基準に正規化
    const raw = fromEnv.slice("file:".length).replace(/^\.\//, "");
    if (raw.startsWith("/") || /^[A-Za-z]:/.test(raw)) return `file:${raw}`;
    return `file:${path.join(process.cwd(), raw).replace(/\\/g, "/")}`;
  }
  return `file:${path.join(process.cwd(), "prisma", "dev.db").replace(/\\/g, "/")}`;
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function createPrisma(): PrismaClient {
  const adapter = new PrismaLibSql({ url: resolveUrl() });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
