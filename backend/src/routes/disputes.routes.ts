import { Router, type RequestHandler } from "express";
import {
  createDispute,
  getDispute,
  listDisputes,
  markDisputeUnderReview,
  resolveDispute,
} from "../controllers/disputes.controller";
import { requirePermission } from "../authz/permissions";
import { authenticate } from "../middleware/authenticate";
import { HttpError } from "../middleware/errorHandler";
import { ApiError } from "../http/errors";

export const disputesRouter = Router();

function withApiErrors(middleware: RequestHandler): RequestHandler {
  return (req, res, next) => {
    middleware(req, res, (error?: unknown) => {
      if (error instanceof HttpError) {
        const status = error.statusCode;
        next(
          new ApiError(
            status,
            status === 401 ? "UNAUTHENTICATED" : "FORBIDDEN",
            status === 401 ? "authentication required" : "insufficient permission",
          ),
        );
        return;
      }
      next(error);
    });
  };
}

disputesRouter.use(withApiErrors(authenticate));
disputesRouter.get("/", withApiErrors(requirePermission("DISPUTE_READ")), listDisputes);
disputesRouter.post("/", withApiErrors(requirePermission("DISPUTE_CREATE")), createDispute);
disputesRouter.get("/:disputeId", withApiErrors(requirePermission("DISPUTE_READ")), getDispute);
disputesRouter.post("/:disputeId/review", withApiErrors(requirePermission("DISPUTE_RESOLVE")), markDisputeUnderReview);
disputesRouter.post("/:disputeId/resolutions", withApiErrors(requirePermission("DISPUTE_RESOLVE")), resolveDispute);
