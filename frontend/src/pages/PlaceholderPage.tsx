import { Construction } from "lucide-react";
import { EmptyState } from "../components/feedback/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";

/**
 * Screen for a module the service does not expose yet.
 *
 * It states plainly that no records are shown and that the service does not
 * currently return data for this area. It never implies that an empty list means
 * a record is absent from the system.
 */
export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <section>
      <PageHeader title={title} description={description} icon={Construction} />
      <EmptyState
        title="This module is not available yet."
        description="The service does not currently return records for this area, so nothing is shown here. No records have been created, removed or assessed."
      />
    </section>
  );
}