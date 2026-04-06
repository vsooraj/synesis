import { Router, type IRouter } from "express";
import { eq } from "drizzle-orm";
import { db, tenantsTable, usersTable } from "@workspace/db";
import { generateToken, hashPassword, comparePassword } from "../lib/jwt.js";
import { requireAuth, requireRole, type AuthRequest } from "../middleware/auth.js";
import { logAction } from "../lib/audit.js";

const router: IRouter = Router();

router.post("/auth/register", async (req, res): Promise<void> => {
  const { email, name, password, tenantName } = req.body;
  if (!email || !name || !password || !tenantName) {
    res.status(400).json({ error: "email, name, password, and tenantName are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const [tenant] = await db.insert(tenantsTable).values({ name: tenantName }).returning();
  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    tenantId: tenant.id,
    email,
    name,
    passwordHash,
    role: "super_admin",
  }).returning();

  const token = generateToken({ userId: user.id, tenantId: tenant.id, email: user.email, role: user.role });
  await logAction(tenant.id, user.id, "REGISTER", "user", user.id, { email });
  res.status(201).json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId } });
});

router.post("/auth/login", async (req, res): Promise<void> => {
  const { email, password } = req.body;
  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const [user] = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await comparePassword(password, user.passwordHash);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = generateToken({ userId: user.id, tenantId: user.tenantId, email: user.email, role: user.role });
  await logAction(user.tenantId, user.id, "LOGIN", "user", user.id, { email });
  res.json({ token, user: { id: user.id, email: user.email, name: user.name, role: user.role, tenantId: user.tenantId } });
});

router.get("/auth/me", requireAuth, async (req: AuthRequest, res): Promise<void> => {
  const [user] = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    tenantId: usersTable.tenantId,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.id, req.user!.userId));

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }
  res.json(user);
});

router.get("/auth/users", requireAuth, requireRole("super_admin", "hr_admin"), async (req: AuthRequest, res): Promise<void> => {
  const users = await db.select({
    id: usersTable.id,
    email: usersTable.email,
    name: usersTable.name,
    role: usersTable.role,
    tenantId: usersTable.tenantId,
    createdAt: usersTable.createdAt,
  }).from(usersTable).where(eq(usersTable.tenantId, req.user!.tenantId));
  res.json(users);
});

router.post("/auth/users/invite", requireAuth, requireRole("super_admin", "hr_admin"), async (req: AuthRequest, res): Promise<void> => {
  const { email, name, password, role } = req.body;
  if (!email || !name || !password) {
    res.status(400).json({ error: "email, name, and password are required" });
    return;
  }

  const existing = await db.select().from(usersTable).where(eq(usersTable.email, email));
  if (existing.length > 0) {
    res.status(409).json({ error: "Email already registered" });
    return;
  }

  const passwordHash = await hashPassword(password);
  const [user] = await db.insert(usersTable).values({
    tenantId: req.user!.tenantId,
    email,
    name,
    passwordHash,
    role: role || "employee",
  }).returning();

  await logAction(req.user!.tenantId, req.user!.userId, "INVITE_USER", "user", user.id, { email, role });
  res.status(201).json({ id: user.id, email: user.email, name: user.name, role: user.role });
});

router.put("/auth/users/:id/role", requireAuth, requireRole("super_admin"), async (req: AuthRequest, res): Promise<void> => {
  const userId = parseInt(req.params.id);
  const { role } = req.body;
  const validRoles = ["super_admin", "hr_admin", "hiring_manager", "employee", "recruiter"];
  if (!validRoles.includes(role)) {
    res.status(400).json({ error: "Invalid role" });
    return;
  }

  const [updated] = await db.update(usersTable)
    .set({ role })
    .where(eq(usersTable.id, userId))
    .returning();

  if (!updated) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  await logAction(req.user!.tenantId, req.user!.userId, "UPDATE_ROLE", "user", userId, { newRole: role });
  res.json({ id: updated.id, email: updated.email, role: updated.role });
});

export default router;
