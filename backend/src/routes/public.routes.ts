import { Router } from "express";
import { createPublicVerification } from "../controllers/publicVerify.controller";
import { requireMultipartFile } from "../http/multipart";
import { sendData } from "../http/envelope";

export const publicRouter = Router();

publicRouter.get("/verify", (_req, res) => {
  sendData(res, {
    status: "scaffold",
    usage: "POST /api/v1/public/verify with file and evidenceId or evidenceVersionId",
    matchMeaning:
      "MATCH means the submitted file matches the fingerprint in a confirmed verification proof. It does not prove the underlying claim is true.",
  });
});

publicRouter.post("/verify", requireMultipartFile, createPublicVerification);
