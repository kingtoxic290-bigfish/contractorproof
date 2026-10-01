import { History } from "lucide-react";
import { Card } from "../../../components/ui/Card";
import type { ProjectPassport } from "../types";

type HistoryEvent = { at: string; label: string; detail: string };

function eventsFor(passport: ProjectPassport): HistoryEvent[] {
  const events: HistoryEvent[] = [
    { at: passport.project.createdAt, label: "Project record created", detail: passport.project.name },
  ];
  for (const milestone of passport.milestones) {
    events.push({ at: milestone.createdAt, label: "Milestone recorded", detail: milestone.name });
    for (const evidence of milestone.evidence) {
      events.push({ at: evidence.createdAt, label: "Evidence record created", detail: evidence.id });
      for (const version of evidence.versions) {
        events.push({ at: version.createdAt, label: `Evidence version ${version.versionNumber} recorded`, detail: version.sha256 });
        for (const verification of version.verifications) {
          events.push({ at: verification.createdAt, label: `Verification ${verification.status}`, detail: `${verification.source} · version ${version.versionNumber}` });
        }
      }
      for (const attestation of evidence.attestations) {
        events.push({ at: attestation.createdAt, label: `Attestation ${attestation.decision}`, detail: attestation.verifierRole });
      }
    }
    for (const correction of milestone.corrections) {
      events.push({ at: correction.createdAt, label: `Correction ${correction.status}`, detail: correction.reason });
      for (const resolution of correction.resolutions) {
        events.push({ at: resolution.createdAt, label: `Correction resolution ${resolution.status}`, detail: resolution.resolution });
      }
    }
  }
  for (const variation of passport.variations) {
    events.push({ at: variation.createdAt, label: `Variation ${variation.status}`, detail: `${variation.variationReference} · ${variation.reason}` });
    for (const resolution of variation.resolutions) {
      events.push({ at: resolution.createdAt, label: `Variation resolution ${resolution.status}`, detail: resolution.decision });
    }
  }
  for (const proof of passport.blockchainProofs) {
    events.push({ at: proof.createdAt, label: `Blockchain ${proof.confirmationState.toLowerCase()} proof event`, detail: proof.eventType });
  }
  return events.sort((left, right) => left.at.localeCompare(right.at));
}

export function PassportTimeline({ passport }: { passport: ProjectPassport }) {
  const events = eventsFor(passport);
  return (
    <Card title="Record history" description="Chronological entries from timestamped project, milestone, evidence, verification, attestation, and proof records." icon={History}>
      {events.length ? (
        <ol className="divide-y divide-stone-200">
          {events.map((event, index) => (
            <li key={`${event.at}-${event.label}-${index}`} className="grid gap-1 py-3 first:pt-0 sm:grid-cols-[minmax(10rem,13rem)_1fr] sm:gap-4">
              <time dateTime={event.at} className="break-words text-xs text-stone-500">{event.at}</time>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-stone-900">{event.label}</p>
                <p className="mt-1 break-words font-mono text-xs text-stone-600">{event.detail}</p>
              </div>
            </li>
          ))}
        </ol>
      ) : <p className="text-sm text-stone-600">No dated records were found in this Passport.</p>}
    </Card>
  );
}