# API Communs de la transition écologique des collectivités

Should you be a service connected to Les communs, here is a [detailed doc in french](CONNECTING_SERVICE.md) :

## Table of Contents

- [Prerequisites](#prerequisites)
- [Environment Setup](#environment-setup)
- [Running the Application](#running-the-application)
- [Testing](#testing)
- [Continuous Integration](#continuous-integration)

## Prerequisites

- **Node.js** version **20** or higher
- **pnpm** package manager (version **>= 9.x**)
- **Docker** and **Docker Compose** (for database setup)

## Environment Setup

1.**Set up environment variables:**

Copy the environment template. (No need of additional secrets)

```bash
  cp .env.template .env
```

2.**Install dependencies:**

```bash
pnpm install
```

3.**Start Docker services:**

Ensure Docker is running on your machine, then start the PostgreSQL database:

```bash
pnpm db:start
```

## Running the API

```bash
pnpm dev
```

Once you have your API up, the swagger will be available on http://localhost:3000/api

## Testing

We follow a three-tier test strategy:

### Test Pyramid

```
           ┌─────────────┐
           │  E2E Tests  │  ← Slowest, most expensive, full system
           │  (HTTP API) │     Docker + Database + API
           └─────────────┘
                 │
           ┌─────────────────┐
           │ Integration Tests│ ← Medium speed, external deps
           │  (Service Layer) │   Real LLM/DB but no HTTP
           └─────────────────┘
                 │
           ┌───────────────────────┐
           │    Unit Tests         │ ← Fast, isolated, mocked
           │ (Pure Logic/Mocks)    │   No external dependencies
           └───────────────────────┘
```

### Running Tests

**Unit tests** (fast, no external dependencies):

```bash
pnpm test:unit
```

**Integration tests** (requires `ANTHROPIC_API_KEY`, Python3 + anthropic module, Docker):

```bash
pnpm test:integration
```

**E2E tests** (full HTTP API with Docker):

```bash
pnpm test:e2e
```

**All tests** (complete test suite):

```bash
pnpm test:all
```

**Quick validation** (unit + script tests, default for `pnpm test`):

```bash
pnpm test
```

### Watch Mode

```bash
pnpm test:watch              # Unit tests only
pnpm test:watch:integration  # Integration tests only
```

### Coverage

```bash
pnpm test:cov  # Unit test coverage only
```

### Test Types Explained

| Type            | Speed    | External Deps    | When to Run   | Cost           |
| --------------- | -------- | ---------------- | ------------- | -------------- |
| **Unit**        | ~seconds | None (mocked)    | Every save    | Free           |
| **Integration** | ~minutes | LLM API, TestDB  | Before commit | API credits    |
| **E2E**         | ~minutes | Docker, DB, HTTP | Before merge  | Infrastructure |

**Integration tests** use TestContainers for automatic database setup/teardown, while **E2E tests** use Docker Compose with a dedicated configuration.

_Note:_ Integration and E2E tests require different database setups and can run in parallel without conflicts.

## Continuous Integration

We have only one main branch that gets deployed on both stating and prod env.

The project uses Github Action for CI/CD. The configuration is defined in the root workflows folder. The pipeline includes:

- **Static Analysis**: Runs code formatting and lint and type checks.
- **Testing**: Runs unit and end-to-end tests.
- **Deploying**: The api is deployed automatically on staging when a PR is merged on main. To automatically deploy on prod there is a manual github workflow that needs to be triggered to create a new tag which triggers the automatic deployment
