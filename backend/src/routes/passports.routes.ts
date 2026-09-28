import { Router } from "express";
import { getPassport, listPassports } from "../controllers/passports.controller";
import type { Request, Response, NextFunction } from "express";
import { authenticate } from "../middleware/authenticate";
import { HttpError } from "../middleware/errorHandler";
import { ApiError } from "../http/errors";

export const passportsRouter = Router();

passportsRouter.use((req: Request, res: Response, next: NextFunction) => {
  void authenticate(req, res, (error?: unknown) => {
    if (error instanceof HttpError) {
      next(new ApiError(401, "UNAUTHENTICATED", "authentication required"));
      return;
    }
    next(error);
  });
});
passportsRouter.get("/", listPassports);
passportsRouter.get("/:projectId", getPassport);
