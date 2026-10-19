import { Injectable, NotFoundException } from "@nestjs/common";
import { asc, eq } from "drizzle-orm";
import { DatabaseService } from "@database/database.service";
import { refDepartements, refRegions } from "@database/schema";
import { DepartementQueryDto } from "./dto/departement-query.dto";
import { DepartementResponse, RegionDetailResponse, RegionResponse } from "./dto/departement-region.response";

@Injectable()
export class DepartementsRegionsService {
  constructor(private readonly dbService: DatabaseService) {}

  departements(query: DepartementQueryDto): Promise<DepartementResponse[]> {
    return this.selectDepartements()
      .where(query.codeRegion ? eq(refDepartements.codeRegion, query.codeRegion) : undefined)
      .orderBy(asc(refDepartements.code));
  }

  async departement(code: string): Promise<DepartementResponse> {
    const [departement] = await this.selectDepartements().where(eq(refDepartements.code, code));
    if (!departement) throw new NotFoundException(`Département ${code} non trouvé`);
    return departement;
  }

  regions(): Promise<RegionResponse[]> {
    return this.dbService.database
      .select({ code: refRegions.code, nom: refRegions.nom, siren: refRegions.siren })
      .from(refRegions)
      .orderBy(asc(refRegions.code));
  }

  async region(code: string): Promise<RegionDetailResponse> {
    const db = this.dbService.database;
    const [region] = await db
      .select({ code: refRegions.code, nom: refRegions.nom, siren: refRegions.siren })
      .from(refRegions)
      .where(eq(refRegions.code, code));
    if (!region) throw new NotFoundException(`Région ${code} non trouvée`);
    const departements = await db
      .select({ code: refDepartements.code, nom: refDepartements.nom, siren: refDepartements.siren })
      .from(refDepartements)
      .where(eq(refDepartements.codeRegion, code))
      .orderBy(asc(refDepartements.code));
    return { ...region, departements };
  }

  private selectDepartements() {
    return this.dbService.database
      .select({
        code: refDepartements.code,
        nom: refDepartements.nom,
        siren: refDepartements.siren,
        codeRegion: refDepartements.codeRegion,
        nomRegion: refRegions.nom,
      })
      .from(refDepartements)
      .innerJoin(refRegions, eq(refRegions.code, refDepartements.codeRegion))
      .$dynamic();
  }
}
