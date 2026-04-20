# CLAUDE.md — HBS Mobile

This is the React Native (Expo) mobile companion app for **Hudson Business Solutions**, a multi-tenant construction operations platform.

## Backend

- Web app repo: `C:\dev\Hudson-Business-Solutions`
- API base URL: `https://hudson-business-solutions.com` (configured in `src/mobile/constants.ts`)
- All API requests require:
  - `Authorization: Bearer {token}` header
  - `X-Tenant-Subdomain: {subdomain}` header (used instead of subdomain-based host resolution)

## Auth Flow

1. User enters subdomain + email + password
2. `POST /api/mobile/login` → returns `token`, `user`, `tenant`
3. Token stored in `expo-secure-store` under keys in `STORAGE_KEYS`
4. Token passed on every subsequent request as Bearer header
5. On 401, session is cleared and user is sent back to login

## API Endpoints

| Method | Path | Purpose |
|--------|------|---------|
| POST | /api/mobile/login | Login → Bearer token |
| POST | /api/mobile/logout | Revoke token |
| GET | /api/me | Current user + tenant |
| GET | /api/jobs | Job list (with financials if permitted) |
| GET | /api/jobs/:id | Single job detail |
| GET | /api/timesheets/clock-in-jobs | Jobs available for clock-in (light) |
| GET | /api/timesheets | Week view with entries + active clock |
| POST | /api/timesheets/clock-in | Punch in — `{ jobId: number }` REQUIRED |
| POST | /api/timesheets/clock-out | Punch out |
| POST | /api/expenses/upload-receipt | Multipart receipt upload + OCR |
| POST | /api/expenses | Create expense |

## Project Structure

```
src/mobile/
  api/client.ts      — typed API client (createApiClient + mobileLogin/mobileLogout)
  screens/           — tab and screen components (receive all state via props)
  AppShell.tsx       — root component, owns all state, passes down to screens
  constants.ts       — API_BASE_URL, STORAGE_KEYS, EXPENSE_CATEGORIES
  types.ts           — TypeScript types matching API response shapes
  styles.ts          — all RN StyleSheet definitions
  utils.ts           — helpers (formatHours, hasPermission, buildDashboardMetrics, etc.)
app/
  (tabs)/index.tsx   — entry point, just re-exports AppShell
```

## Tech Stack

- Expo SDK 54, Expo Router, React Native 0.81
- TypeScript
- expo-secure-store for token persistence
- expo-image-picker for receipt photos

## Commands

```bash
npm start          # Start Expo dev server
npm run ios        # Run on iOS simulator
npm run android    # Run on Android emulator
```

## App Store Config

- iOS bundle ID: `com.hudsonbusinesssolutions.mobile`
- Android package: `com.hudsonbusinesssolutions.mobile`
- Use `eas build` for production builds

## UI Theme

Match the web app: navy (#1E3A5F), construction yellow (#F59E0B), white cards, clean sans-serif typography. Dark navy sidebar feel on mobile header.

## Key Rules

- All API calls are tenant-scoped via the `X-Tenant-Subdomain` header
- Never store passwords — only the Bearer token
- Job selection is REQUIRED before clock-in (enforced both client and server side)
- Employees (role = Employee) see timesheets only — no jobs, dashboard, or expenses
- Managers and Admins see everything
