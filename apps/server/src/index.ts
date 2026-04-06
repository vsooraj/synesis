import app from "./app";
import { logger } from "./lib/logger";
import { db, usersTable, tenantsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { hashPassword } from "./lib/jwt";

const rawPort = process.env["PORT"];

if (!rawPort) {
  throw new Error(
    "PORT environment variable is required but was not provided.",
  );
}

const port = Number(rawPort);

if (Number.isNaN(port) || port <= 0) {
  throw new Error(`Invalid PORT value: "${rawPort}"`);
}

async function startServer() {
  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.email, "admin@example.com"));
    if (existing.length === 0) {
      let [tenant] = await db.select().from(tenantsTable).limit(1);
      if (!tenant) {
        [tenant] = await db.insert(tenantsTable).values({ name: "Default Org" }).returning();
      }
      const passwordHash = await hashPassword("admin123");
      await db.insert(usersTable).values({
        email: "admin@example.com",
        name: "Super Admin",
        passwordHash,
        role: "super_admin",
        tenantId: tenant.id
      });
      logger.info("Default admin user created: admin@example.com");
    }
  } catch (error) {
    logger.error({ err: error }, "Failed to seed admin user");
  }

  app.listen(port, (err) => {
    if (err) {
      logger.error({ err }, "Error listening on port");
      process.exit(1);
    }
    logger.info({ port }, "Server listening");
  });
}

startServer();
