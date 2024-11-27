import { Injectable } from "@nestjs/common";
import { DatabaseService, Tx } from "@database/database.service";
import { porteurReferents } from "@database/schema";
import { CreatePorteurReferentDto } from "@projects/dto/create-porteur-referent.dto";

@Injectable()
export class PorteurReferentsService {
  constructor(private readonly dbService: DatabaseService) {}

  async findOrCreate(
    tx: Tx,
    porteurReferent?: CreatePorteurReferentDto,
  ): Promise<string | null> {
    if (!porteurReferent) {
      return null;
    }

    const updateSet: Partial<CreatePorteurReferentDto> = {};
    if (porteurReferent.telephone)
      updateSet.telephone = porteurReferent.telephone;
    if (porteurReferent.prenom) updateSet.prenom = porteurReferent.prenom;
    if (porteurReferent.nom) updateSet.nom = porteurReferent.nom;

    const [upsertedPorteur] = await tx
      .insert(porteurReferents)
      .values(porteurReferent)
      .onConflictDoUpdate({
        target: porteurReferents.email,
        set: updateSet,
      })
      .returning();

    return upsertedPorteur.id;
  }
}
