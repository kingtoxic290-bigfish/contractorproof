export type NestLookupResult = {
  source: "SYNTHETIC_DEMO";
  found: boolean;
  nestTenderReference: string | null;
  nestContractReference: string | null;
  ocid: string | null;
  procuringEntity: string | null;
  contractStatus: string | null;
  contractStartDate: string | null;
  contractEndDate: string | null;
};

export interface NestIntegrationAdapter {
  lookupByReference(reference: string): Promise<NestLookupResult>;
}
