# Platform Test Suite

This repository now includes automated smoke tests for:

- Backend API health and role access
- Login/profile checks for all roles (admin, organizer, enterprise, visitor)
- Timezone persistence flow
- Key feature surfaces (events, orders, communications, requests)

## 1) Required environment variables

Set these for local or hosted environment testing:

```bash
IVEP_API_BASE_URL=http://127.0.0.1:8000
IVEP_FRONTEND_BASE_URL=http://127.0.0.1:3000

IVEP_ADMIN_EMAIL=...
IVEP_ADMIN_PASSWORD=...
IVEP_ORGANIZER_EMAIL=...
IVEP_ORGANIZER_PASSWORD=...
IVEP_ENTERPRISE_EMAIL=...
IVEP_ENTERPRISE_PASSWORD=...
IVEP_VISITOR_EMAIL=...
IVEP_VISITOR_PASSWORD=...
```

If any role credential is missing, role-specific tests are skipped.

## 2) Backend smoke tests (pytest)

From `backend/`:

```bash
venv\Scripts\python -m pytest -q
```

## 3) Frontend E2E smoke tests (Playwright)

From `frontend/`:

```bash
npm install
npx playwright install
npm run test:e2e
```

Optional:

```bash
npm run test:e2e:headed
npm run test:e2e:report
```

## 4) Hosted validation

Set:

- `IVEP_API_BASE_URL` to your hosted backend URL
- `IVEP_FRONTEND_BASE_URL` to your hosted frontend URL

Then run the same backend + frontend test commands to verify hosted behavior.
