import { Injectable, OnModuleDestroy } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { Pool } from "pg";
import { drizzle, NodePgQueryResultHKT } from "drizzle-orm/node-postgres";
import * as schema from "./schema";
import { PgTransaction } from "drizzle-orm/pg-core";
import { ExtractTablesWithRelations } from "drizzle-orm";

export type Schema = typeof schema;
export type Database = ReturnType<typeof drizzle<Schema>>;
export type Tx = PgTransaction<
  NodePgQueryResultHKT,
  Schema,
  ExtractTablesWithRelations<Schema>
>;

@Injectable()
export class DatabaseService implements OnModuleDestroy {
  private readonly pool: Pool;
  private readonly db: Database;

  constructor(private configService: ConfigService) {
    this.pool = new Pool({
      connectionString: this.configService.getOrThrow("DATABASE_URL"),
    });
    this.db = drizzle(this.pool, { schema });
  }

  get database(): Database {
    if (!this.db) {
      throw new Error("Database not initialized");
    }
    return this.db;
  }

  async onModuleDestroy() {
    await this.pool?.end();
  }
}
