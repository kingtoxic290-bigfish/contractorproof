export type CrbLookupResult = {
  source: "SYNTHETIC_DEMO";
  found: boolean;
  crbRegistrationNumber: string;
  crbCategory: string | null;
  crbType: string | null;
  crbClass: string | null;
  crbStatus: string | null;
  crbLastVerifiedAt: string | null;
};

export interface CrbIntegrationAdapter {
  lookupByRegistrationNumber(registrationNumber: string): Promise<CrbLookupResult>;
}
