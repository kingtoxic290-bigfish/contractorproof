import express from "express";
import cors from "cors";
import { env } from "./config/env";
import { apiRouter } from "./routes";
import { getHealth } from "./controllers/health.controller";
import { errorHandler } from "./middleware/errorHandler";
import { requestId } from "./middleware/requestId";

export const app = express();

app.use(requestId);
app.use(
  cors({
    origin: env.frontendUrl,
  }),
);
app.use(express.json({ limit: "2mb" }));

app.get("/health", getHealth);
app.use("/api/v1", apiRouter);

app.use(errorHandler);
