import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import resumeRouter from "./resume.js";
import authRouter from "./auth.js";
import resumeProfilesRouter from "./resumeProfiles.js";
import jobDescriptionsRouter from "./jobDescriptions.js";
import bulkJobsRouter from "./bulkJobs.js";
import auditLogRouter from "./auditLog.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(resumeRouter);
router.use(authRouter);
router.use(resumeProfilesRouter);
router.use(jobDescriptionsRouter);
router.use(bulkJobsRouter);
router.use(auditLogRouter);

export default router;
