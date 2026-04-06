import express, { type Express, type Request, type Response } from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import pinoHttp from "pino-http";
import yaml from "js-yaml";
import fs from "fs";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

import docsRouter from "./routes/docs";
app.use("/api-docs", docsRouter);

app.use("/api", router);

// Serve static assets from client/dist
const clientDistPath = path.resolve(__dirname, "../../client/dist");
app.use(express.static(clientDistPath));

// Handle client-side routing by serving index.html for non-API routes
app.get(/^(?!\/api).+/, (req: Request, res: Response) => {
  if (req.url.startsWith("/api")) {
    return;
  }
  res.sendFile(path.join(clientDistPath, "index.html"));
});

// Global error handler
app.use((err: any, req: Request, res: Response, next: any) => {
  logger.error({ err }, "Unhandled error");
  res.status(err.status || 500).json({
    error: err.message || "Internal Server Error",
  });
});

export default app;
