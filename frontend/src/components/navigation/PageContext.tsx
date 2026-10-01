import { useLocation } from "react-router-dom";
import { Breadcrumbs, buildCrumbs } from "./Breadcrumbs";
import { RecordChain, currentIndex } from "./RecordChain";

/**
 * Page context strip rendered above every authenticated page.
 *
 * It shows the trail back to a list view and where the current screen sits in
 * the record chain. It renders nothing (and no stray spacing) on screens where
 * neither applies.
 */
export function PageContext() {
  const { pathname } = useLocation();
  const showCrumbs = buildCrumbs(pathname).length > 1;
  const showChain = currentIndex(pathname) >= 0;

  if (!showCrumbs && !showChain) {
    return null;
  }

  return (
    <div className="mb-5 flex flex-col gap-2">
      {showCrumbs ? <Breadcrumbs /> : null}
      {showChain ? <RecordChain /> : null}
    </div>
  );
}