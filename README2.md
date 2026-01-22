
# CronoX_v2

CronoX_v2 is a modern, client-side application that provides a marketplace for experts and buyers to connect for paid sessions. It is built with React, TypeScript, and Vite, and it uses Tailwind CSS with `shadcn/ui` for a consistent and accessible design.

## High-Level Architecture

The project is a single-page application (SPA) with a component-based architecture. It uses `react-router-dom` for client-side routing and `@tanstack/react-query` for managing server state. The global state, such as user roles and authentication, is managed using React's Context API.

## Directory Structure

```
/
├── public/
│   ├── favicon.ico
│   ├── placeholder.svg
│   └── robots.txt
├── src/
│   ├── components/
│   │   ├── layout/
│   │   │   ├── Footer.tsx
│   │   │   └── Navbar.tsx
│   │   ├── ui/
│   │   │   ├── *.tsx (reusable UI components)
│   │   │   └── use-toast.ts
│   │   └── NavLink.tsx
│   ├── contexts/
│   │   └── RoleContext.tsx
│   ├── hooks/
│   │   ├── use-mobile.tsx
│   │   └── use-toast.ts
│   ├── lib/
│   │   └── utils.ts
│   ├── pages/
│   │   ├── AuthEntry.tsx
│   │   ├── CreateSession.tsx
│   │   ├── Dashboard.tsx
│   │   ├── Earnings.tsx
│   │   ├── Index.tsx
│   │   ├── Marketplace.tsx
│   │   ├── MySessions.tsx
│   │   ├── NotFound.tsx
│   │   ├── Profile.tsx
│   │   ├── SignIn.tsx
│   │   └── SignUp.tsx
│   ├── test/
│   │   ├── example.test.ts
│   │   └── setup.ts
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   └── vite-env.d.ts
├── .gitignore
├── README.md
├── bun.lockb
├── components.json
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── postcss.config.js
├── tailwind.config.ts
├── tsconfig.app.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
└── vitest.config.ts
```

## Installation and Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/CronoX_v2.git
   ```
2. **Install dependencies:**
   ```bash
   npm install
   ```

## Environment Variables and Configuration

The project does not require any environment variables to run. The configuration is managed through the following files:

- `vite.config.ts`: Vite configuration
- `tailwind.config.ts`: Tailwind CSS configuration
- `tsconfig.json`: TypeScript configuration

## How to Run the Project

- **Frontend:**
  ```bash
  npm run dev
  ```
- **Backend:**
  ```bash
  npm run backend
  ```

## Backend API

The backend is a service-oriented Node.js application using Express and TypeScript.

### Services

- **Users**: Manages users and professionals.
- **Marketplace**: Manages time tokens and orders.
- **Scheduling**: Manages bookings and sessions.
- **Payments**: Manages payments.
- **Pricing**: Implements the AI pricing pipeline.
- **Metrics**: Ingests time-series productivity and biometric data.
- **Auditing**: Manages audit logs.

### TimeToken Lifecycle

The `TimeToken` entity follows a strict state machine to manage its lifecycle from creation to consumption. State transitions are atomic and can only be performed by the Marketplace Service.

**States:**

- `drafted`: The initial state of a token after being minted by a professional. It is not yet visible on the marketplace.
- `listed`: The token is visible on the marketplace and can be purchased by a buyer.
- `purchased`: The token has been purchased by a buyer and is no longer listed on the marketplace.
- `consumed`: The time slot has been used.
- `cancelled`: The token has been cancelled by the professional or an admin.

**State Transitions:**

```
drafted -> listed
drafted -> cancelled
listed -> purchased
listed -> cancelled
purchased -> consumed
purchased -> cancelled
```

**Events:**

The system emits events for key lifecycle transitions:

- `TokenMinted`: When a new token is created.
- `TokenPurchased`: When a token is purchased.
- `TokenConsumed`: When a token is consumed.


### Authentication and Authorization

The backend uses JSON Web Tokens (JWT) for authentication. To access protected endpoints, you must include an `Authorization` header with a valid JWT in the format `Bearer <token>`.

#### Roles

- `buyer`: Can purchase time tokens and book sessions.
- `professional`: Can create time tokens.
- `admin`: Can access all resources, including audit logs.

### API Endpoints

A full API specification will be provided separately. Here is a summary of the available endpoints:

- `POST /api/auth/register`: Register a new user.
- `POST /api/auth/login`: Log in and receive a JWT.
- `GET /api/users`: Get all users (requires authentication).
- `GET /api/users/:id`: Get a user by ID (requires authentication).
- `GET /api/users/professionals`: Get all professionals.
- `GET /api/users/professionals/:id`: Get a professional by ID.
- `GET /api/marketplace/tokens`: Get all listed time tokens.
- `GET /api/marketplace/tokens/:id`: Get a single time token by ID.
- `POST /api/marketplace/tokens/mint`: Mint a new time token (requires authentication, professional role).
- `POST /api/marketplace/tokens/:id/list`: List a time token on the marketplace (requires authentication, professional role).
- `POST /api/marketplace/tokens/:id/purchase`: Purchase a time token (requires authentication, buyer role).
- `POST /api/marketplace/tokens/:id/consume`: Consume a time token (requires authentication, professional or admin role).
- `POST /api/marketplace/tokens/:id/cancel`: Cancel a time token (requires authentication, professional or admin role).
- `GET /api/marketplace/orders`: Get all orders for the authenticated user.
- `POST /api/scheduling/bookings`: Create a new booking (requires authentication, buyer role).
- `GET /api/scheduling/bookings`: Get all bookings for the authenticated user.
- `GET /api/scheduling/sessions`: Get all sessions for the authenticated user.
- `POST /api/scheduling/sessions/:id/start`: Start a session (requires authentication, professional or admin role).
- `POST /api/scheduling/sessions/:id/end`: End a session (requires authentication, professional or admin role).
- `GET /api/payments`: Get all payments for the authenticated user.
- `POST /api/pricing/calculate`: Calculate a deterministic price for a professional (requires authentication).
- `POST /api/metrics`: Ingest a new metric (requires authentication).
- `GET /api/auditing`: Get all audit logs (requires authentication, admin role).

## Core Features and Workflows

- **User Roles:** The application supports two user roles: `buyer` and `professional`.
- **Authentication:** A simple role-based authentication system is implemented using React Context.
- **Marketplace:** A marketplace where professionals can list their sessions and buyers can book them.
- **Dashboard:** A personalized dashboard for both buyers and professionals to manage their sessions and track their activity.
- **Session Creation:** Professionals can create and manage their session offerings.

## Cron Jobs, Schedulers, or Automation

There are no cron jobs, schedulers, or automation in this project.

## Dependencies and Requirements

- **Node.js:** v16 or higher
- **npm:** v8 or higher

## Notes for Developers and Maintainers

- The project uses `shadcn/ui` for its component library. To add new components, you can use the `shadcn-ui` CLI.
- The project uses `@tanstack/react-query` for server state management. It is recommended to use this library for all data fetching.
- The project uses `eslint` for linting. Please run `npm run lint` before committing your changes.
- The project uses `vitest` for testing. Please run `npm run test` to run the tests.
