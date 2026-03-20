# ⏳ CronoX

[![Tech Stack](https://img.shields.io/badge/Stack-React%20%7C%20Node%20%7C%20Postgres-blue)](https://github.com/AKhutwad-git/CronoX)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Build Status](https://img.shields.io/badge/Build-Passing-brightgreen)](#)
[![Version](https://img.shields.io/badge/Version-2.0.0-orange)](#)

**CronoX** is a high-performance, full-stack time-token marketplace. It empowers professionals to tokenize their expertise into tradable time units, allowing buyers to seamlessly purchase, book, and conduct high-value sessions in a secure, audited environment.

---

## 📖 Description

In the modern gig economy, "time" is the most valuable currency. CronoX solves the expert monetization problem by providing a robust platform where:
- **Professionals** can "mint" time tokens, set dynamic pricing, and manage their availability.
- **Buyers** can discover top-tier experts, purchase tokens, and book synchronous sessions.

The platform handles the entire lifecycle: from token issuance and marketplace listing to secure payment processing and session auditing.

---

## 🚀 Features

- **Time-Token Marketplace**: Experts list specialized time units as tradable tokens.
- **Lifecycle Management**: Complete flow from Token Minting → Purchase → Booking → Session Completion.
- **Enterprise-Grade Auth**: JWT-based authentication with fine-grained Role-Based Access Control (RBAC).
- **Automated Payments**: Integrated with **Stripe** for secure transactions and automated session settlements.
- **Audit Logging**: Immutable records for every critical action (auth, payments, state shifts).
- **Modular Backend**: Clean architecture with decoupled services for scalability (Marketplace, Scheduling, Payments, etc.).
- **Real-time Metrics**: Dynamic pricing engine based on performance metrics and engagement.

---

## 🛠️ Tech Stack

### Frontend
- **Framework**: [React 18](https://reactjs.org/) with [Vite](https://vitejs.dev/)
- **Language**: [TypeScript](https://www.typescriptlang.org/)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/) & [Shadcn UI](https://ui.shadcn.com/)
- **State Management**: [TanStack Query (React Query)](https://tanstack.com/query/latest)
- **Animations**: [Framer Motion](https://www.framer.com/motion/)
- **Charts**: [Recharts](https://recharts.org/)

### Backend
- **Runtime**: [Node.js](https://nodejs.org/)
- **Framework**: [Express.js](https://expressjs.com/)
- **ORM**: [Prisma](https://www.prisma.io/)
- **Database**: [PostgreSQL](https://www.postgresql.org/)
- **Authentication**: JWT (JSON Web Tokens) & Bcrypt.js
- **Payments**: [Stripe SDK](https://stripe.com/docs/api)

---

## 📂 Project Structure

```bash
CronoX/
├── backend/                # Node.js + Express Backend
│   ├── prisma/            # Database Schema & Migrations
│   └── src/
│       ├── services/      # Modular Business Logic
│       │   ├── auditing/  # Immutable Activity Logs
│       │   ├── marketplace/ # Token Minting & Trading
│       │   ├── payments/  # Stripe Integration
│       │   ├── pricing/   # Dynamic Pricing Engine
│       │   ├── scheduling/# Booking & Sessions
│       │   └── users/     # Auth & Profile Management
│       ├── middleware/    # Auth, Role-Check, Error Handlers
│       └── index.ts       # Server Entry Point
├── public/                 # Static Assets (Logos, Icons)
├── src/                    # Vite + React Frontend
│   ├── components/        # UI Components (Shadcn)
│   ├── contexts/          # Global State & Auth Providers
│   ├── hooks/             # Functional Logic Hooks
│   ├── pages/             # View Components
│   └── lib/               # API Clients & Utilities
├── package.json            # Project Metadata & Scripts
└── tailwind.config.ts      # Design System Configuration
```

---

## ⚙️ Installation

1. **Clone the Repository**
   ```bash
   git clone https://github.com/AKhutwad-git/CronoX.git
   cd CronoX
   ```

2. **Install Dependencies**
   ```bash
   npm install
   cd backend && npm install
   cd ..
   ```

3. **Database Setup**
   Ensure you have a PostgreSQL instance running, then:
   ```bash
   cd backend
   npx prisma migrate dev
   npx prisma generate
   cd ..
   ```

---

## ▶️ Usage

### Start Development Servers

You can run both the frontend and backend simultaneously from the root directory:

```bash
# Run Frontend (Vite)
npm run dev

# Run Backend (Express)
npm run backend
```

- **Frontend**: [http://localhost:5173](http://localhost:5173)
- **Backend API**: [http://localhost:3000](http://localhost:3000)

---

## 🔐 Environment Variables

Create a `.env` file in the `backend/` directory:

```env
DATABASE_URL="postgresql://user:password@localhost:5432/cronox"
JWT_SECRET="your_super_secure_jwt_secret"
STRIPE_SECRET_KEY="sk_test_..."
PORT=3000
NODE_ENV="development"
```

Create a `.env` file in the root directory for the frontend:

```env
VITE_API_BASE_URL="http://localhost:3000"
```

---

## 📸 Screenshots / Demo

| Dashboard View | Marketplace Listings | Session Booking |
| :--- | :--- | :--- |
| ![Dashboard](https://placehold.co/600x400/1e293b/white?text=CronoX+Pro+Dashboard) | ![Marketplace](https://placehold.co/600x400/1e293b/white?text=Time-Token+Marketplace) | ![Sessions](https://placehold.co/600x400/1e293b/white?text=Session+Lifecycle+Management) |

---

## 🧪 Testing

CronoX uses **Vitest** for unit and integration testing.

```bash
# Run Frontend Tests
npm run test

# Run Backend Tests
cd backend && npm run test
```

---

## 🤝 Contributing

1. Fork the Project.
2. Create your Feature Branch (`git checkout -b feature/AmazingFeature`).
3. Commit your Changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the Branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

## 📜 License

Distributed under the **MIT License**. See `LICENSE` for more information.

---

## 👤 Author

**CronoX Team** - Akas Khutwad(https://github.com/AKhutwad-git)

---

> [!TIP]
> **Production Tip**: Always ensure `NODE_ENV` is set to `production` and all secrets are managed via a secure Vault in live environments.
