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

2.**Start Docker services:**

Ensure Docker is running on your machine, then start the PostgreSQL database:

```bash
pnpm db:start
```

## Running the API

```bash
pnpm start:dev
```

Once you have your API up, the swagger will be available on http://localhost:3000/api


## Testing

```bash
pnpm test
```

To run end-to-end tests:

```bash
pnpm test:e2e
```

_Note:_ Ensure that the PostgreSQL database is running via Docker when running tests.

## Continuous Integration

We have only one main branch that gets deployed on both stating and prod env.

The project uses Github Action for CI/CD. The configuration is defined in the root workflows folder. The pipeline includes:

- **Static Analysis**: Runs code formatting and lint and type checks.
- **Testing**: Runs unit and end-to-end tests.
- **Deploying**: The api is deployed automatically on staging when a PR is merged on main. To automatically deploy on prod there is a manual github workflow that needs to be triggered to create a new tag which triggers the automatic deployment


