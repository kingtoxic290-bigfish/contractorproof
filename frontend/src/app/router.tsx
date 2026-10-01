import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { PublicLayout } from "../components/layout/PublicLayout";
import { GuestRoute } from "../features/auth/GuestRoute";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { RoleGate } from "../features/auth/RoleGate";
import { ContractorDetailPage } from "../features/contractors/pages/ContractorDetailPage";
import { ContractorsPage } from "../features/contractors/pages/ContractorsPage";
import { EvidencePage } from "../features/evidence/pages/EvidencePage";
import { MilestoneCreatePage } from "../features/milestones/pages/MilestoneCreatePage";
import { MilestoneDetailPage } from "../features/milestones/pages/MilestoneDetailPage";
import { MilestonesPage } from "../features/milestones/pages/MilestonesPage";
import { PassportDetailPage } from "../features/passports/pages/PassportDetailPage";
import { PassportsPage } from "../features/passports/pages/PassportsPage";
import { VerificationPage } from "../features/verification/pages/VerificationPage";
import { VERIFY_INTERNAL_ROLES } from "../features/verification/types";
import { ProjectCreatePage } from "../features/projects/pages/ProjectCreatePage";
import { ProjectDetailPage } from "../features/projects/pages/ProjectDetailPage";
import { ProjectsPage } from "../features/projects/pages/ProjectsPage";
import { DashboardPage } from "../pages/DashboardPage";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { PublicVerificationPage } from "../pages/PublicVerificationPage";
import { UnauthorizedPage } from "../pages/UnauthorizedPage";

export function AppRouter() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route
          path="/login"
          element={
            <GuestRoute>
              <LoginPage />
            </GuestRoute>
          }
        />
        <Route path="/verify" element={<PublicVerificationPage />} />
        <Route path="/public/verify" element={<Navigate to="/verify" replace />} />
        <Route path="/unauthorized" element={<UnauthorizedPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Route>

      <Route
        element={
          <ProtectedRoute>
            <AppShell />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/dashboard" replace />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/contractors" element={<ContractorsPage />} />
        <Route path="/contractors/:contractorId" element={<ContractorDetailPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route
          path="/projects/new"
          element={
            <RoleGate allow={["CONTRACTOR", "ADMIN"]}>
              <ProjectCreatePage />
            </RoleGate>
          }
        />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route
          path="/projects/:projectId/milestones/new"
          element={
            <RoleGate allow={["CONTRACTOR", "ADMIN"]}>
              <MilestoneCreatePage />
            </RoleGate>
          }
        />
        <Route path="/milestones" element={<MilestonesPage />} />
        <Route path="/milestones/:milestoneId" element={<MilestoneDetailPage />} />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route
          path="/verification"
          element={
            <RoleGate allow={VERIFY_INTERNAL_ROLES}>
              <VerificationPage />
            </RoleGate>
          }
        />
        <Route path="/passports" element={<PassportsPage />} />
        <Route path="/passports/:projectId" element={<PassportDetailPage />} />
        <Route
          path="/disputes"
          element={
            <PlaceholderPage
              title="Disputes"
              description="Dispute records that preserve the original verification event will appear here."
            />
          }
        />
        <Route
          path="/corrections"
          element={
            <PlaceholderPage
              title="Corrections"
              description="New correction events that leave the original event unchanged will appear here."
            />
          }
        />
        <Route
          path="/variations"
          element={
            <PlaceholderPage
              title="Contract variations"
              description="Linked variation events will appear here."
            />
          }
        />
        <Route
          path="/audit"
          element={
            <RoleGate allow={["AUDITOR", "ADMIN", "PROCUREMENT_OFFICER"]}>
              <PlaceholderPage
                title="Audit trail"
                description="Append-only audit records will appear here."
              />
            </RoleGate>
          }
        />
        <Route
          path="/settings"
          element={
            <PlaceholderPage
              title="Settings"
              description="Account and workspace preferences will appear here."
            />
          }
        />
        <Route path="/forbidden" element={<ForbiddenPage />} />
      </Route>

      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}
