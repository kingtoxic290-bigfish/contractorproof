import { Navigate, Route, Routes } from "react-router-dom";
import { AppShell } from "../components/layout/AppShell";
import { PublicLayout } from "../components/layout/PublicLayout";
import { GuestRoute } from "../features/auth/GuestRoute";
import { ProtectedRoute } from "../features/auth/ProtectedRoute";
import { RoleGate } from "../features/auth/RoleGate";
import { CorrectionsPage } from "../features/corrections/pages/CorrectionsPage";
import { CORRECTION_PAGE_ROLES } from "../features/corrections/types";
import { DisputesPage } from "../features/disputes/pages/DisputesPage";
import { DISPUTE_PAGE_ROLES } from "../features/disputes/types";
import { ContractorDetailPage } from "../features/contractors/pages/ContractorDetailPage";
import { ContractorPassportPage } from "../features/contractors/pages/ContractorPassportPage";
import { ContractorsPage } from "../features/contractors/pages/ContractorsPage";
import { EvidencePage } from "../features/evidence/pages/EvidencePage";
import { MilestoneCreatePage } from "../features/milestones/pages/MilestoneCreatePage";
import { MilestoneDetailPage } from "../features/milestones/pages/MilestoneDetailPage";
import { MilestoneReviewPage } from "../features/milestones/pages/MilestoneReviewPage";
import { MilestonesPage } from "../features/milestones/pages/MilestonesPage";
import { PassportDetailPage } from "../features/passports/pages/PassportDetailPage";
import { PassportsPage } from "../features/passports/pages/PassportsPage";
import { VerificationPage } from "../features/verification/pages/VerificationPage";
import { VERIFICATION_PAGE_ROLES } from "../features/verification/types";
import { ProjectCreatePage } from "../features/projects/pages/ProjectCreatePage";
import { ProjectDetailPage } from "../features/projects/pages/ProjectDetailPage";
import { ProjectsPage } from "../features/projects/pages/ProjectsPage";
import { DashboardPage } from "../pages/DashboardPage";
import { ForbiddenPage } from "../pages/ForbiddenPage";
import { LandingPage } from "../pages/LandingPage";
import { LoginPage } from "../pages/LoginPage";
import { NotFoundPage } from "../pages/NotFoundPage";
import { PlaceholderPage } from "../pages/PlaceholderPage";
import { PublicVerificationPage } from "../pages/PublicVerificationPage";
import { UnauthorizedPage } from "../pages/UnauthorizedPage";

export function AppRouter() {
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
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
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/contractors" element={<ContractorsPage />} />
        <Route
          path="/contractors/me/passport"
          element={
            <RoleGate allow={["CONTRACTOR"]}>
              <ContractorPassportPage />
            </RoleGate>
          }
        />
        <Route path="/contractors/:contractorId" element={<ContractorDetailPage />} />
        <Route path="/contractors/:contractorId/passport" element={<ContractorPassportPage />} />
        <Route path="/projects" element={<ProjectsPage />} />
        <Route
          path="/projects/new"
          element={
            <RoleGate allow={["CLIENT", "ADMIN"]}>
              <ProjectCreatePage />
            </RoleGate>
          }
        />
        <Route path="/projects/:projectId" element={<ProjectDetailPage />} />
        <Route
          path="/projects/:projectId/milestones/new"
          element={
            <RoleGate allow={["CLIENT", "ADMIN"]}>
              <MilestoneCreatePage />
            </RoleGate>
          }
        />
        <Route path="/milestones" element={<MilestonesPage />} />
        <Route path="/milestones/:milestoneId" element={<MilestoneDetailPage />} />
        <Route
          path="/milestones/:milestoneId/review"
          element={
            <RoleGate allow={["CLIENT", "ADMIN"]}>
              <MilestoneReviewPage />
            </RoleGate>
          }
        />
        <Route path="/evidence" element={<EvidencePage />} />
        <Route
          path="/verification"
          element={
            <RoleGate allow={VERIFICATION_PAGE_ROLES}>
              <VerificationPage />
            </RoleGate>
          }
        />
        <Route path="/passports" element={<PassportsPage />} />
        <Route path="/passports/:projectId" element={<PassportDetailPage />} />
        <Route
          path="/disputes"
          element={
            <RoleGate allow={DISPUTE_PAGE_ROLES}>
              <DisputesPage />
            </RoleGate>
          }
        />
        <Route
          path="/corrections"
          element={
            <RoleGate allow={CORRECTION_PAGE_ROLES}>
              <CorrectionsPage />
            </RoleGate>
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
