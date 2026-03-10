// Global setup for referentiel integration tests.
// Uses a local PostgreSQL instead of TestContainers (which requires Docker).
// Creates a dedicated test database, runs migrations, then tears down after all tests.

import "tsconfig-paths/register";
import { execSync } from "child_process";

const TEST_DB = "referentiel_test";
const DATABASE_URL = `postgresql://dev:dev@localhost:5432/${TEST_DB}`;

export default async function globalSetup() {
  console.log("Setting up local PostgreSQL for referentiel tests...");

  // Recreate test database
  try {
    execSync(`PGPASSWORD=dev psql -h localhost -U dev -d postgres -c "DROP DATABASE IF EXISTS ${TEST_DB};"`, {
      stdio: "pipe",
    });
  } catch {
    // Ignore if database doesn't exist
  }

  try {
    execSync(`PGPASSWORD=dev psql -h localhost -U dev -d postgres -c "CREATE DATABASE ${TEST_DB};"`, {
      stdio: "pipe",
    });
  } catch {
    // Database might already exist
  }

  process.env.DATABASE_URL = DATABASE_URL;

  // Run migrations
  console.log("Running database migrations...");
  execSync("pnpm db:migrate:drizzle", {
    env: { ...process.env, DATABASE_URL },
    stdio: "inherit",
    cwd: process.cwd(),
  });
  console.log("Migrations completed");

  // Redis: try to start a container, fall back to a local Redis or mock
  try {
    const { GenericContainer } = await import("testcontainers");
    const redisContainer = await new GenericContainer("redis:7-alpine").withExposedPorts(6379).start();
    (global as Record<string, unknown>).__REDIS_TESTCONTAINER__ = redisContainer;
    process.env.REDIS_URL = `redis://${redisContainer.getHost()}:${redisContainer.getMappedPort(6379)}`;
    console.log("Redis container started");
  } catch {
    // Fall back to localhost Redis (may or may not be running)
    process.env.REDIS_URL = "redis://localhost:6379";
    console.log("Redis container not available, using localhost:6379");
  }
}
