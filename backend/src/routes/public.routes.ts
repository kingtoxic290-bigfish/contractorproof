import { Router } from "express";
import { createPublicVerification } from "../controllers/publicVerify.controller";
import { requireMultipartFile } from "../http/multipart";

export const publicRouter = Router();

publicRouter.get("/verify", (_req, res) => {
  res.json({
    status: "scaffold",
    usage: "POST /api/v1/public/verify with file and evidenceId or evidenceVersionId",
    matchMeaning:
      "MATCH means the submitted file matches the recorded evidence fingerprint. It does not mean the blockchain independently proves the underlying claim is true.",
  });
});

publicRouter.post("/verify", requireMultipartFile, createPublicVerification);
