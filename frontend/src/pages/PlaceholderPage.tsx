import { EmptyState } from "../components/feedback/EmptyState";
import { PageHeader } from "../components/ui/PageHeader";

export function PlaceholderPage({
  title,
  description,
}: {
  title: string;
  description?: string;
}) {
  return (
    <section>
      <PageHeader title={title} description={description} />
      <EmptyState
        title="This module is under development."
        description="No records are shown here yet. This screen will use backend data when the module is implemented."
      />
    </section>
  );
}
