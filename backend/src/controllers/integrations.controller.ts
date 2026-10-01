import type { Request, Response, NextFunction } from "express";
import { mockNestIntegrationAdapter } from "../integrations/nest/MockNestIntegrationAdapter";
import { HttpError } from "../middleware/errorHandler";

export async function lookupNest(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const reference = req.params.reference;
    if (!reference) {
      throw new HttpError(400, "reference is required");
    }
    const result = await mockNestIntegrationAdapter.lookupByReference(reference);
    res.json({
      notice: "Synthetic/demo NeST data. No live NeST API was called.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}
