import path from "path";
import { fileURLToPath } from "url";
import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.resolve(__dirname, "../../../.env");
console.log("🔍 Loading environment from:", envPath);
dotenv.config({ path: envPath });

async function main() {
  console.log("🌱 Seeding database...");
  const { db, usersTable, tenantsTable } = await import("./index");
  const { hash } = await import("bcrypt");
  const { eq } = await import("drizzle-orm");

  // 1. Create a default tenant if not exists
  const [existingTenant] = await db.select().from(tenantsTable).limit(1);
  let tenantId = existingTenant?.id;

  if (!tenantId) {
    const [newTenant] = await db.insert(tenantsTable).values({
      name: "Synesis Enterprise",
    }).returning();
    tenantId = newTenant.id;
    console.log("✅ Created tenant: Synesis Enterprise");
  }

  // 2. Create the super admin user
  const adminEmail = "admin@example.com";
  const [existingAdmin] = await db.select().from(usersTable).where(eq(usersTable.email, adminEmail));

  if (!existingAdmin) {
    const passwordHash = await hash("admin123", 10);
    await db.insert(usersTable).values({
      tenantId,
      email: adminEmail,
      name: "Super Admin",
      passwordHash,
      role: "super_admin",
    });
    console.log(`✅ Created super admin: ${adminEmail}`);
  } else {
    console.log("ℹ️ Super admin already exists.");
  }

  console.log("🏁 Seeding complete!");
  process.exit(0);
}

main().catch((err) => {
  console.error("❌ Seeding failed:", err);
  process.exit(1);
});
