import { Injectable } from "@nestjs/common";
import { Tx } from "@database/database.service";
import { communes } from "@database/schema";
import { inArray } from "drizzle-orm";

@Injectable()
export class CommunesService {
  async findOrCreateMany(tx: Tx, inseeCodes: string[]) {
    const existingCommunes = await tx
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
      const newCommunes = await tx
        .insert(communes)
        .values(newInseeCodes.map((inseeCode) => ({ inseeCode })))
        .returning();

      return [...existingCommunes, ...newCommunes];
    }

    return existingCommunes;
  }
}
