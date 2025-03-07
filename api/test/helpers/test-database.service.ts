import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { sql } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";

@Injectable()
export class TestDatabaseService extends DatabaseService {
  constructor(configService: ConfigService) {
    super(configService);
  }

  async cleanDatabase() {
    await this.database.execute(sql`          
          TRUNCATE TABLE projets_to_collectivites CASCADE;
          TRUNCATE TABLE projets CASCADE;
          TRUNCATE TABLE collectivites CASCADE;
          TRUNCATE TABLE services CASCADE;
         `);
  }
}
