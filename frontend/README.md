# IVEP Frontend - Week 1 Foundation

This is the visitor-facing frontend for the Intelligent Virtual Exhibition Platform (IVEP).

## Getting Started

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Installation
```bash
cd frontend
npm install
```

### Configuration
1. Copy `.env.example` to `.env` (or `.env.local`):
   ```bash
   cp .env.example .env.local
   ```
2. Ensure `NEXT_PUBLIC_API_URL` points to your running backend (default: `http://127.0.0.1:8000`).

### Running the Application
```bash
npm run dev
```
The application will be available at `http://localhost:3000`.

## Features (Week 2)
- **Visitor Dashboard**: View joined events, personalized recommendations, and notifications.
- **Event Details**: Real-time participation status (NOT_JOINED, PENDING, APPROVED, REJECTED) and registration logic.
- **Notifications**: Panel with mark-as-read functionality and unread counts.
- **API Client**: Centralized, typed API client with JWT token handling and 401 redirection.

## Features (Week 1)
- **Foundation**: Next.js 14 App Router, Tailwind CSS design system, API utilities.
- **Visitor Pages**: Responsive Landing Page, Events List (with search/filters), and Event Details.
- **Authentication Base**: Login and Register pages, JWT-enabled AuthContext, and Protected Route helper.
- **API Integration**: Ready to connect with the FastAPI backend.

## Project Structure
- `src/app`: App Router pages and layouts.
- `src/components`: UI components, shared layout elements, and feature-specific components.
- `src/context`: React Context for global state (e.g., Authentication).
- `src/services`: API service layers for business logic.
- `src/types`: TypeScript type definitions.
- `src/lib`: Shared utilities and configuration.
