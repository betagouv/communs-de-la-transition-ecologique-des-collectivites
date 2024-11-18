import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { DatabaseService } from "@database/database.service";
import { sql } from "drizzle-orm";

@Injectable()
export class TestDatabaseService extends DatabaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  async cleanDatabase() {
    await this.database.execute(sql`TRUNCATE TABLE projects CASCADE`);
  }
}
