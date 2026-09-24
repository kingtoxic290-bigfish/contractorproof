import { Card } from "../../../components/ui/Card";
import type { TimelineEvent } from "../types";

export function PassportTimeline({ events }: { events: TimelineEvent[] }) {
  if (events.length === 0) {
    return (
      <Card title="Timeline" description="Only events returned by implemented GET APIs are listed.">
        <p className="text-sm text-stone-600">No dated records were returned for this contractor.</p>
      </Card>
    );
  }

  return (
    <Card
      title="Timeline"
      description="Chronological records from contractor, project, milestone, and evidence GET APIs. Site handover, inspection, attestation, and blockchain events are omitted because those APIs do not return them."
    >
      <ol className="space-y-3">
        {events.map((event, index) => (
          <li key={`${event.kind}-${event.at}-${event.detail}-${index}`} className="border-l-2 border-stone-200 pl-3">
            <p className="text-xs uppercase tracking-wide text-stone-500">{event.at}</p>
            <p className="mt-1 text-sm font-medium text-stone-900">{event.label}</p>
            <p className="text-sm text-stone-600">{event.detail}</p>
          </li>
        ))}
      </ol>
    </Card>
  );
}
