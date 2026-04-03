import { Router, type IRouter } from "express";
import healthRouter from "./health.js";
import resumeRouter from "./resume.js";
import authRouter from "./auth.js";
import resumeProfilesRouter from "./resumeProfiles.js";
import jobDescriptionsRouter from "./jobDescriptions.js";
import bulkJobsRouter from "./bulkJobs.js";
import auditLogRouter from "./auditLog.js";
import analyticsRouter from "./analytics.js";
import talentSearchRouter from "./talentSearch.js";
import agentShortlistRouter from "./agentShortlist.js";
import ragRouter from "./rag.js";

const router: IRouter = Router();

router.use(healthRouter);
router.use(resumeRouter);
router.use(authRouter);
router.use(resumeProfilesRouter);
router.use(jobDescriptionsRouter);
router.use(bulkJobsRouter);
router.use(auditLogRouter);
router.use(analyticsRouter);
router.use(talentSearchRouter);
router.use(agentShortlistRouter);
router.use(ragRouter);

export default router;
