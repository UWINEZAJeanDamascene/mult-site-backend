# Lilstock - Multi-Site Stock Management System

A role-based stock management system with automatic synchronization between site-level records (no price) and main stock (with pricing), plus auto-calculated derived views for used and remaining materials.

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              SITES LAYER                                     │
│                    Site Managers — Record Only, No Price                   │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────────────────┐ │
│  │   Site 1    │  │   Site 2    │  │              Site N+                │ │
│  │ • Receive   │  │ • Receive   │  │         (Dynamically Created)       │ │
│  │ • Use       │  │ • Use       │  │      Auto-linked to Main Stock      │ │
│  │ • No Price  │  │ • No Price  │  │                                     │ │
│  └──────┬──────┘  └──────┬──────┘  └─────────────────┬───────────────────┘ │
│         │                │                          │                     │
│         └────────────────┼──────────────────────────┘                     │
│                          │                                                │
│                    Auto Sync ──► Immediate, Read-Only from Site            │
└──────────────────────────┼────────────────────────────────────────────────┘
                           │
                           ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                             MAIN STOCK LAYER                                 │
│            Main Stock Manager — Full Access + Price Management              │
├─────────────────────────────────────────────────────────────────────────────┤
│  ┌─────────────────────────────────────────────────────────────────────────┐│
│  │  Stores: material | site source | qty received | qty used | price       ││
│  │          total value (computed) | date | status | notes              ││
│  └─────────────────────────────────────────────────────────────────────────┘│
│         │                           │                           │            │
│         ▼                           ▼                           ▼            │
│  ┌───────────────┐         ┌───────────────┐         ┌───────────────────┐   │
│  │  Edit Site    │         │  Direct       │         │  Auto Adjustment  │   │
│  │  Records      │         │  Records      │         │  Trigger           │   │
│  │  • Add Price  │         │  • Non-site   │         │  • Updates All     │   │
│  │  • Verify Qty │         │  • Full Price │         │  • Simultaneous    │   │
│  └───────┬───────┘         └───────┬───────┘         └───────────────────┘   │
│          │                          │                                        │
│          └──────────────────────────┼────────────────────────────────────────┘
│                                     │
│          Connected Feature Splits the View                                   │
│                                     │
│     ┌─────────────────┐    ┌─────────────────────┐                           │
│     │  USED MATERIALS │    │  REMAINING MATERIALS│                           │
│     │     VIEW        │    │        VIEW         │                           │
│     ├─────────────────┤    ├─────────────────────┤                           │
│     │ • All consumed  │    │ • Current balance   │                           │
│     │ • Aggregated    │    │ • Received - Used   │                           │
│     │ • Site filter   │    │ • Price valuation   │                           │
│     └─────────────────┘    └─────────────────────┘                           │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Features

- **Role-Based Access Control (RBAC)**: Site managers (scoped to their sites) and Main stock managers (full access)
- **Auto-Sync**: Site records automatically sync to main stock on save
- **Auto-Adjustment**: Any stock movement triggers simultaneous updates to all derived views
- **Real-time Updates**: WebSocket notifications for all stock changes
- **Derived Views**: Automatic calculation of used materials and remaining materials with price valuation
- **Dynamic Sites**: Main stock managers can create sites on demand, immediately available for assignment

## Tech Stack

- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Prisma ORM
- **Real-time**: WebSocket (ws library)
- **Auth**: JWT with bcryptjs
- **Testing**: Jest with Supertest

## Quick Start

### Prerequisites

- Node.js 18+
- PostgreSQL 14+

### Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Set up environment variables**:
   ```bash
   cp .env.example .env
   # Edit .env with your database credentials
   ```

3. **Database setup**:
   ```bash
   # Ensure PostgreSQL is running
   npx prisma migrate dev
   npx prisma db seed
   ```

4. **Generate Prisma client**:
   ```bash
   npx prisma generate
   ```

5. **Start development server**:
   ```bash
   npm run dev
   ```

The API will be available at `http://localhost:3000` and WebSocket at `ws://localhost:3001`.

### Default Login

After seeding:
- **Email**: `admin@lilstock.com`
- **Password**: `admin123`

## API Endpoints

### Authentication
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| POST | `/api/auth/login` | Login | Public |
| POST | `/api/auth/register` | Create user | Main stock manager only |
| GET | `/api/auth/me` | Get current user | Authenticated |
| POST | `/api/auth/change-password` | Change password | Authenticated |

### Sites
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/sites` | List sites | Authenticated (scoped) |
| POST | `/api/sites` | Create site | Main stock manager |
| PUT | `/api/sites/:id` | Update site | Main stock manager |
| DELETE | `/api/sites/:id` | Delete site | Main stock manager |
| POST | `/api/sites/:id/assign` | Assign manager | Main stock manager |
| DELETE | `/api/sites/:id/assign/:userId` | Remove manager | Main stock manager |

### Site Records (Site Manager Layer)
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/site-records` | List records | Site-scoped |
| GET | `/api/site-records/:id` | Get record | Site-scoped |
| POST | `/api/site-records` | Create record | Own sites only |
| PUT | `/api/site-records/:id` | Update record | Own records only |
| DELETE | `/api/site-records/:id` | Delete record | Own records / Main manager |

### Main Stock
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/main-stock` | List all records | Main stock manager |
| GET | `/api/main-stock/:id` | Get record | Main stock manager |
| POST | `/api/main-stock` | Create direct record | Main stock manager |
| PUT | `/api/main-stock/:id` | Update record (add price) | Main stock manager |
| DELETE | `/api/main-stock/:id` | Delete record | Main stock manager |
| GET | `/api/main-stock/pending-pricing/all` | Records needing price | Main stock manager |
| POST | `/api/main-stock/bulk-price` | Bulk price update | Main stock manager |

### Views
| Method | Endpoint | Description | Access |
|--------|----------|-------------|--------|
| GET | `/api/views/used` | Used materials view | Main stock manager |
| GET | `/api/views/used/:material` | Single material used | Main stock manager |
| GET | `/api/views/remaining` | Remaining materials view | Main stock manager |
| GET | `/api/views/remaining/:material` | Single material remaining | Main stock manager |
| GET | `/api/views/summary` | Combined summary | Main stock manager |
| POST | `/api/views/recalculate` | Force view recalc | Main stock manager |

### Health Check
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/health` | API and database health status |

## Database Schema

### Core Tables
- `User` - Authentication and roles
- `Site` - Construction sites
- `SiteAssignment` - Many-to-many user-site assignments
- `SiteRecord` - Site-level records (no price)
- `MainStockRecord` - Central inventory with pricing
- `UsedMaterialView` - Aggregated consumption view
- `RemainingMaterialView` - Balance and valuation view
- `StockMovementLog` - Audit trail

### Auto-Adjustment Flow

```
Site Record Created
        │
        ▼
Sync to Main Stock (price = null)
        │
        ▼
Process Stock Movement
        │
        ├──► Update Used Materials View
        │      (aggregate consumption)
        │
        └──► Update Remaining Materials View
               (calculate balance + valuation)
        │
        ▼
WebSocket Broadcast
```

## Role Permissions

### Site Manager
- ✅ Create/read/update/delete own site records
- ✅ View own assigned sites only
- ❌ No access to main stock screens
- ❌ No access to other sites' data
- ❌ No access to pricing fields

### Main Stock Manager
- ✅ Full CRUD on all records
- ✅ Create/manage sites
- ✅ Add/edit pricing on any record
- ✅ View all derived views
- ✅ Manage user assignments
- ✅ Create direct (non-site) records

## WebSocket Events

| Event | Payload | Description |
|-------|---------|-------------|
| `SITE_RECORD_CREATED` | `{ siteRecord, mainStockRecord }` | New record from site |
| `SITE_RECORD_UPDATED` | `{ siteRecord, mainStockRecord }` | Updated site record |
| `MAIN_STOCK_UPDATED` | `{ mainStockRecord }` | Direct record change |
| `VIEWS_UPDATED` | `{ updatedCount }` | Views recalculated |
| `CONNECTED` | `{ message }` | Connection confirmation |

## Testing

```bash
# Run tests
npm test

# Run with coverage
npm run test:coverage

# Watch mode
npm run test:watch
```

## Scripts

```bash
# Development
npm run dev

# Build
npm run build

# Production
npm start

# Database
npm run db:migrate    # Run migrations
npm run db:push       # Push schema changes
npm run db:seed       # Seed initial data
npm run db:studio     # Open Prisma Studio

# Linting
npm run lint
```

## Project Structure

```
src/
├── __tests__/          # Test files
├── config/             # Database & app config
├── middleware/           # Auth & RBAC middleware
├── routes/              # API route handlers
│   ├── auth.ts
│   ├── sites.ts
│   ├── siteRecords.ts
│   ├── mainStock.ts
│   └── views.ts
├── services/            # Business logic
│   └── autoAdjustment.ts
├── types/               # TypeScript types
├── utils/               # Auth utilities
├── websocket/           # WebSocket server
└── index.ts            # App entry point

prisma/
├── schema.prisma       # Database schema
└── seed.ts            # Seed script
```

## License

MIT
