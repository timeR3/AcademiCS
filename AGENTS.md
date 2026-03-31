# Agent Instructions for AcademiCS

Welcome to the AcademiCS repository. This document provides essential information about the project's tech stack, structure, and coding standards to help you work effectively.

## Tech Stack

### Frontend
- **Framework:** React 18.2.0 (using Vite)
- **Language:** TypeScript
- **Styling:** Tailwind CSS + Radix UI (Shadcn/UI components)
- **Icons:** Lucide React
- **Forms & Validation:** React Hook Form + Zod
- **State Management:** React Context API (Auth, Course, Role)

### Backend
- **Language:** Vanilla PHP 8.x (Custom routing system)
- **Database:** MySQL (using PDO)
- **AI Integration:** Genkit + OpenAI (via `@genkit-ai/compat-oai`)

### Infrastructure
- **Hosting:** Firebase App Hosting
- **CI/CD:** Scripts defined in `package.json` for linting and verification.

## Project Structure

- `backend-php/`: PHP backend application.
  - `public/index.php`: Entry point, CORS handling, and router.
  - `routes/`: Route definitions for auth, platform, and AI settings.
- `src/`: React frontend application.
  - `components/`: Organized by role (admin, teacher, student) and shared components.
  - `context/`: Global state management.
  - `hooks/`: Custom React hooks.
  - `lib/`: Utility functions and configuration.
  - `types/`: TypeScript interfaces and types.
- `sql/`: Database management.
  - `schema/`: Table definitions.
  - `migrations/`: Database changes over time.
  - `seed/`: Initial data for development.
- `docs/`: Documentation and database schemas.

## Coding Standards

### Frontend (TypeScript/React)
- Use functional components and hooks.
- Prefer Tailwind CSS for all styling.
- Maintain strict typing with TypeScript.
- Follow the component organization (Shared vs. Role-specific).

### Backend (PHP)
- Always use `declare(strict_types=1);`.
- Use the `jsonResponse()` utility for all API outputs.
- Interact with the database via the `db()`, `one()`, `many()`, and `execSql()` helpers defined in `index.php`.
- Ensure SQL queries are optimized (refer to `ensurePerformanceIndexes` in `index.php`).

## Common Tasks & Scripts

- `npm run dev`: Start the Vite development server.
- `npm run lint:frontend`: Run ESLint on the frontend code.
- `npm run lint:php`: Run PHP linting (requires PHP in PATH).
- `npm run typecheck`: Run TypeScript compiler checks.
- `npm run verify`: Runs linting, typechecking, and a production build.

## Database
- The database schema is documented in `src/database-schema.md`.
- AI usage and costs are tracked in the `ai_usage_events` table.
