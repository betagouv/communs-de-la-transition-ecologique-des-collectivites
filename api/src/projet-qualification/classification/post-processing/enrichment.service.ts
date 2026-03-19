import { Injectable } from "@nestjs/common";
import { CustomLogger } from "@logging/logger.service";
import {
  THEMATIQUE_ENRICHMENT_RULES,
  SITE_ENRICHMENT_RULES,
  SITE_TO_THEMATIQUE_ENRICHMENT_RULES,
} from "../const/post-traitement";

interface ClassificationAxes {
  thematiques: Record<string, number>;
  sites: Record<string, number>;
  interventions: Record<string, number>;
}

/**
 * Service for enriching classification results with parent labels
 * When a child label is found, the parent label is added automatically
 * Also handles cross-axis enrichment (e.g., site -> thematique)
 */
@Injectable()
export class EnrichmentService {
  constructor(private readonly logger: CustomLogger) {}

  /**
   * Enrich classification results by applying parent-child rules
   * @param axes Raw validated labels for all 3 axes
   * @returns Enriched labels with parent labels added where applicable
   */
  enrich(axes: ClassificationAxes): ClassificationAxes {
    const thematiques = { ...axes.thematiques };
    const sites = { ...axes.sites };
    const interventions = { ...axes.interventions };

    // Apply thematique enrichment rules (child -> parent)
    for (const rule of THEMATIQUE_ENRICHMENT_RULES) {
      if (thematiques[rule.found] !== undefined && thematiques[rule.add] === undefined) {
        thematiques[rule.add] = thematiques[rule.found];
        this.logger.log(`Enriched thematique: "${rule.found}" → added parent "${rule.add}"`);
      }
    }

    // Apply site enrichment rules (child -> parent)
    for (const rule of SITE_ENRICHMENT_RULES) {
      if (sites[rule.found] !== undefined && sites[rule.add] === undefined) {
        sites[rule.add] = sites[rule.found];
        this.logger.log(`Enriched site: "${rule.found}" → added parent "${rule.add}"`);
      }
    }

    // Apply cross-axis enrichment (site -> thematique)
    for (const rule of SITE_TO_THEMATIQUE_ENRICHMENT_RULES) {
      if (sites[rule.siteFound] !== undefined && thematiques[rule.addThematique] === undefined) {
        thematiques[rule.addThematique] = sites[rule.siteFound];
        this.logger.log(`Cross-axis enrichment: site "${rule.siteFound}" → added thematique "${rule.addThematique}"`);
      }
    }

    return { thematiques, sites, interventions };
  }
}
