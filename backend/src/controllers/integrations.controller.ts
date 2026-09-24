import type { Request, Response, NextFunction } from "express";
import { mockCrbIntegrationAdapter } from "../integrations/crb/MockCrbIntegrationAdapter";
import { mockNestIntegrationAdapter } from "../integrations/nest/MockNestIntegrationAdapter";
import { HttpError } from "../middleware/errorHandler";

export async function lookupCrb(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const registrationNumber = req.params.registrationNumber;
    if (!registrationNumber) {
      throw new HttpError(400, "registrationNumber is required");
    }
    const result = await mockCrbIntegrationAdapter.lookupByRegistrationNumber(
      registrationNumber,
    );
    res.json({
      notice: "Synthetic/demo CRB data. No live CRB API was called.",
      ...result,
    });
  } catch (error) {
    next(error);
  }
}

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
