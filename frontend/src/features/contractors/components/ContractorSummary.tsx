import { Card } from "../../../components/ui/Card";
import { Field, FieldGrid } from "../../../components/ui/Field";
import { formatDateTime } from "../../../utils/format";
import type { PublicContractor } from "../types";

/**
 * Contractor result card.
 *
 * Discovery and assignment are client decisions, so this card shows only what a
 * client needs to identify the contractor and recognise their CRB registration:
 * the business name, the CRB Registration Number used as the discovery key, and
 * the registration detail the backend already recorded.
 *
 * Internal identifiers are deliberately not rendered. The contractor record id
 * is carried in the drill-down links instead of being printed as raw data, and
 * no internal user id, account email or storage field appears on the card.
 */
export function ContractorSummary({
  contractor,
  actions,
}: {
  contractor: PublicContractor;
  actions?: React.ReactNode;
}) {
  const lastVerified = formatDateTime(contractor.crbLastVerifiedAt);

  return (
    <Card>
      <h3 className="break-words font-serif text-lg leading-snug text-stone-900">
        {contractor.legalName}
      </h3>
      <FieldGrid className="mt-4 border-t border-stone-200 pt-4">
        <Field label="CRB Registration Number" mono>
          {contractor.crbRegistrationNumber ?? "Not provided"}
        </Field>
        <Field label="Recorded CRB status">
          {contractor.crbStatus ?? "Not checked"}
        </Field>
        <Field label="Category">{contractor.crbCategory ?? "Not provided"}</Field>
        <Field label="Contractor type">{contractor.crbType ?? "Not provided"}</Field>
        <Field label="Class">{contractor.crbClass ?? "Not provided"}</Field>
        {lastVerified ? <Field label="CRB last verified">{lastVerified}</Field> : null}
      </FieldGrid>
      {actions ? <div className="mt-4 flex flex-wrap gap-3">{actions}</div> : null}
    </Card>
  );
}