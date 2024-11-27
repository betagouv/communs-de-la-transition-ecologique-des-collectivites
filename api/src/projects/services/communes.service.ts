import { Injectable } from "@nestjs/common";
import { DatabaseService } from "@database/database.service";
import { communes } from "@database/schema";
import { inArray } from "drizzle-orm";

@Injectable()
export class CommunesService {
  constructor(private readonly dbService: DatabaseService) {}

  async findOrCreateMany(inseeCodes: string[]) {
    const existingCommunes = await this.dbService.database
      .select()
      .from(communes)
      .where(inArray(communes.inseeCode, inseeCodes));

    const existingInseeCodes = new Set(
      existingCommunes.map((c) => c.inseeCode),
    );
    const newInseeCodes = inseeCodes.filter(
      (code) => !existingInseeCodes.has(code),
    );

    if (newInseeCodes.length > 0) {
      const newCommunes = await this.dbService.database
        .insert(communes)
        .values(newInseeCodes.map((inseeCode) => ({ inseeCode })))
        .returning();

      return [...existingCommunes, ...newCommunes];
    }

    return existingCommunes;
  }
}
