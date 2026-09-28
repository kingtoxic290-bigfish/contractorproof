# ContractorProof — Frontend Status

## Task 2 state: Authentication and typed API client integrated

The frontend is now aligned to the actual backend authentication contract and uses a centralized typed API client built around the existing `/api/v1` base, bearer-token flow, and backend error envelope expectations.

### Authentication and API integration

- Verified login, registration, and current-user flows against the real backend routes in `POST /auth/login`, `POST /auth/register`, and `GET /auth/me`.
- Preserved the backend JWT model and session semantics without introducing a second auth architecture.
- Centralized request creation, bearer-header injection, JSON parsing, and error handling in the shared API client.
- Added session restoration and expired-session cleanup through the auth provider and unauthorized listener flow.
- Kept route protection working through the existing React Router guards and current auth status model.

### Error handling and API semantics

- Added/reused structured API error handling for 401, 403, 404, validation, and network failures.
- Kept password and secrets out of the frontend environment and did not introduce any backend credential exposure.
- Preserved backend authorization as the source of truth; frontend role checks remain navigation/UI helpers only.

---

## Task 1 state: Design system and app shell established

The frontend now has a stronger foundational layout and visual system while preserving the existing route structure and current auth architecture. No backend APIs or routes were changed in this task.

### Design system improvements

- Restrained enterprise palette centered on stone, slate, and deep teal accents.
- Consistent typography hierarchy with serif page headings and clear sans-serif body text.
- Consistent spacing and card styling across the main shell and reusable primitives.
- Standardized status treatment for verification states using semantic labeling and visible color + indicator treatment.
- Reusable `Button`, `Card`, `PageHeader`, `Section`, `Panel`, and `DataTable` patterns.

### Application shell improvements

- Updated the authenticated shell with a full-width page container, header, responsive navigation, branded sidebar copy, and stronger page framing.
- Kept the current router and role-aware navigation structure intact.
- Improved mobile navigation and focus/keyboard accessibility.
- Added a more explicit public layout for verification and unauthenticated entry points.

### Current limitations

- The shell is a presentation foundation only; no live dashboard or feature data integration has been added.
- Placeholder screens remain placeholder screens, but their empty-state presentation is now consistent with the design system.
- Task 2 will handle the actual frontend auth and API-client integration work.

---

## Baseline audit summary

This audit covers the current React + Vite frontend in `frontend/` before any redesign work begins. The objective is to establish a truthful baseline of what is implemented, what is wired to the backend, and what remains placeholder behavior.

## Frontend structure

### App shell and routing

- `frontend/src/app/App.tsx` boots `BrowserRouter` and wraps routes in `AppProviders`.
- `frontend/src/app/router.tsx` defines the route tree.
- Public routes include:
  - `/login`
  - `/verify`
  - `/public/verify` redirect to `/verify`
  - `/unauthorized`
- Protected routes include:
  - `/`
  - `/dashboard`
  - `/contractors` and `/contractors/:contractorId`
  - `/projects` and `/projects/:projectId`
  - `/milestones`
  - `/evidence`
  - `/verification`
  - `/passports` and `/passports/:contractorId`
  - `/disputes`
  - `/corrections`
  - `/variations`
  - `/audit`
  - `/settings`
  - `/forbidden`

### Existing pages

- `frontend/src/pages/LoginPage.tsx`
  - Exists and supports login / registration form flows.
  - Uses the auth hook and shows role-based account creation.
  - Links to the public verification page.
- `frontend/src/pages/DashboardPage.tsx`
  - Exists and reports API health only.
  - Uses placeholder cards and empty states instead of real project/evidence data.
- `frontend/src/pages/PublicVerificationPage.tsx`
  - Exists but is explicitly under development.
  - Displays explanatory text, not a working public verification flow.
- `frontend/src/pages/PlaceholderPage.tsx`
  - Used for dispute / correction / variation / audit / settings placeholder screens.
- `frontend/src/pages/ForbiddenPage.tsx` and `UnauthorizedPage.tsx`
  - Exist for auth error states.

### Feature pages and routed modules

- Contractors:
  - `frontend/src/features/contractors/pages/ContractorsPage.tsx`
  - `frontend/src/features/contractors/pages/ContractorDetailPage.tsx`
- Projects:
  - `frontend/src/features/projects/pages/ProjectsPage.tsx`
  - `frontend/src/features/projects/pages/ProjectDetailPage.tsx`
- Milestones:
  - `frontend/src/features/milestones/pages/MilestonesPage.tsx`
- Evidence:
  - `frontend/src/features/evidence/pages/EvidencePage.tsx`
- Verification:
  - `frontend/src/features/verification/pages/VerificationPage.tsx`
- Passports:
  - `frontend/src/features/passports/pages/PassportsPage.tsx`
  - `frontend/src/features/passports/pages/PassportDetailPage.tsx`

These modules exist as feature folders, but the current application state still relies on placeholder content and a partial implementation model.

## Existing components

### Layout

- `frontend/src/components/layout/AppShell.tsx`
- `frontend/src/components/layout/Header.tsx`
- `frontend/src/components/layout/PublicLayout.tsx`
- `frontend/src/components/layout/Sidebar.tsx`
- `frontend/src/components/layout/MobileNav.tsx`

### Navigation

- `frontend/src/components/navigation/RoleAwareNav.tsx`
- `frontend/src/components/navigation/navConfig.ts`

### UI primitives

- `frontend/src/components/ui/Button.tsx`
- `frontend/src/components/ui/Card.tsx`
- `frontend/src/components/ui/PageHeader.tsx`
- `frontend/src/components/ui/StatusBadge.tsx`

### Feedback states

- `frontend/src/components/feedback/EmptyState.tsx`
- `frontend/src/components/feedback/ErrorState.tsx`
- `frontend/src/components/feedback/LoadingState.tsx`

The styling system is already structured around reusable cards, badges, headers, and empty/loading/error patterns, which provides a workable design foundation for later tasks.

## Existing API client and auth

### API client

- `frontend/src/services/api/client.ts`
  - Centralizes fetch behavior.
  - Reads `VITE_API_ORIGIN` and builds the `/api/v1` base.
  - Adds bearer token when present.
  - Parses backend error envelopes.
  - Clears session token and triggers unauthorized logout handling on `401`.

### Auth flow

- `frontend/src/features/auth/AuthContext.tsx`
  - Provides session state, login, logout, register, and role checks.
  - Restores existing session from saved token.
  - Hooks unauthorized responses back to the auth state.
- `frontend/src/services/api/auth.ts`
  - Wraps `/auth/login`, `/auth/register`, and `/auth/me`.
- `frontend/src/utils/session.ts`
  - Local session token storage helper.

This auth layer is the strongest existing frontend implementation and is already aligned to the backend auth endpoints.

## Styling system

- `frontend/src/styles/index.css` uses Tailwind base, components, and utilities.
- The app uses a restrained neutral palette with serif headings and a professional enterprise feel.
- The project already adopts a design direction aligned to a serious evidence platform, with proper focus styles and a clear subtitle baseline.

## Frontend tests

The frontend has a broad existing test suite under `frontend/src/tests/` and feature-level tests in the `features/*` folders, including:

- login flow
- protected route behavior
- verification flow
- evidence flow
- projects route and milestones route behavior
- passports flow
- contractor API wrappers
- auth/verification hooks

Examples include:

- `frontend/src/tests/login.test.tsx`
- `frontend/src/tests/protected-route.test.tsx`
- `frontend/src/tests/verification.test.tsx`
- `frontend/src/tests/navigation.test.tsx`
- `frontend/src/features/passports/api/passportsApi.test.ts`
- `frontend/src/features/projects/api/projectsApi.test.ts`
- `frontend/src/features/evidence/api/evidenceApi.test.ts`

## Broken or incomplete UX baseline

### Placeholder or unfinished screens

The current implementation still contains placeholder screens for real business modules, including:

- dispute page
- correction page
- variation page
- audit page
- settings page

These screens are intentionally blank placeholders and are not yet backed by real backend records.

### Unimplemented public verification flow

The public verification page is not functional. It explains the desired behavior but does not submit data, calculate SHA-256, or compare against the backend public verification route.

### Dashboard is not data-backed

`DashboardPage.tsx` only checks API health and then shows empty states. It does not call real project, evidence, verification, or passport APIs. It makes it clear that the record lists are not yet connected.

### Protected route structure exists but many pages are not yet populated

The route tree is present, but many screens are placeholders and do not yet embody the evidence story described by the backend contract. The app currently resembles a shell with scaffolding rather than a full product demonstration.

## API integration status

### API client status

- Auth is implemented and connected to backend endpoints.
- The base API client is centralized and suitable for typed feature APIs.
- There is no broad, consistent end-to-end feature integration yet for dashboard, evidence, verification, passport, and dispute flows.

### Backend alignment status

The frontend is on the right architectural path:

- Uses React Router for page separation.
- Uses a protected route gate for authentication.
- Uses a central API client and auth state.
- Uses environment variable `VITE_API_ORIGIN` as the route convention.

However, the actual demonstration task remains largely unimplemented. The foundation exists, but the end-to-end evidence flow is not yet connected to the real backend APIs.

## High-level audit conclusion

The frontend is in an early but organized scaffold phase. It has:

- an app shell,
- protected/public route separation,
- a working session auth model,
- a central API client,
- reusable UI primitives,
- test coverage for the existing auth and route behavior.

It does not yet have:

- a complete dashboard over live backend records,
- a working public verification flow,
- real evidence verification UX,
- blockchain/attestation presentation,
- a finished contractor passport story,
- end-to-end evidence-to-proof narrative matching the backend contract.

This is an appropriate starting baseline for Task 1, which is to establish a consistent design system and app shell without redesigning the backend or inventing unsupported functionality.
