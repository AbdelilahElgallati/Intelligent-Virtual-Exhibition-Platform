# Playwright E2E Test Suite

This directory contains a complete end-to-end test suite for the Intelligent Virtual Exhibition Platform.

## Structure

- `admin/`: Tests for platform administration
- `organisateur/`: Tests for event organization
- `exposant/`: Tests for booth/stand management
- `visiteur/`: Tests for event attendees
- `auth/`: Login, logout, and registration tests
- `flows/`: Multi-role business process flows (E2E)
- `fixtures/`: Test data and users
- `helpers/`: Reusable logic for UI and API interactions

## Setup

1.  **Install dependencies**:
    ```bash
    npm install @playwright/test dotenv axios
    ```

2.  **Environment Variables**:
    Create a `.env.test` file based on `.env.test.template`:
    ```bash
    cp .env.test.template .env.test
    ```

3.  **Run tests**:
    ```bash
    # Run all tests
    npm run test

    # Run specific role tests
    npm run test:admin
    npm run test:visitor

    # Run in UI mode
    npm run test:ui
    ```

## Reports

- HTML Report: `playwright-report/index.html`
- JSON Results: `test-results/results.json`
- Screenshots and videos are saved on failure.
