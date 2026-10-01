import type { PublicEvidence } from "../types";
import { EvidenceCard } from "./EvidenceCard";

export function EvidenceList({
  records,
  projectId,
}: {
  records: PublicEvidence[];
  projectId?: string;
}) {
  return (
    <ul className="grid gap-4">
      {records.map((record) => (
        <li key={record.id}>
          <EvidenceCard record={record} projectId={projectId} />
        </li>
      ))}
    </ul>
  );
}