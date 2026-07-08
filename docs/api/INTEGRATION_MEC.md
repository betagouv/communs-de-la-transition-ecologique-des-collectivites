# Intégration MEC — vue territoriale DDT & décisions

> Public : équipe MEC (Sylvain). Sprint juillet 2026, POC lecture seule + contrat de feedback.
> Spec machine : [`openapi-territoires-decisions.yaml`](./openapi-territoires-decisions.yaml)
> (les mêmes endpoints sont aussi dans le Swagger `/api/projets` de l'instance).

## Auth

Comme les autres endpoints : `Authorization: Bearer <MEC_API_KEY>`. La clé identifie la
plateforme — `POST /decisions` enregistre automatiquement `plateforme_source = MEC`
(le body ne peut pas se faire passer pour un autre service).

## Stabilité — à lire avant de persister quoi que ce soit

| Donnée | Stabilité |
|---|---|
| `traces[].id` (UUID/ID objet) | **Stable et contractuel** — c'est la seule référence à persister côté MEC (et la seule acceptée par `POST /decisions`). **Exception : les ids des traces DGCL** (`role: "financement"`, sources `DGCL *`) ne sont **pas contractuels** — ne jamais les persister ni les référencer dans une décision (une partie changera au prochain recalcul du pipeline ; réévaluation à la rentrée selon le deal DGCL) |
| `traces[].externalId` | Stable (c'est votre propre id) |
| Composition des groupes, `confiance` | **Recalculées à chaque run du pipeline** — ne jamais persister ; c'est pourquoi aucun identifiant de groupe n'est exposé |
| `copMillesime`, `copStatutVivier`, leviers | Stables entre deux livraisons DREAL/référentiel |

## 1. `GET /territoires/{code}/projets`

`code` = INSEE commune (5 chiffres) ou SIREN EPCI (9 chiffres, résolu en communes membres).

Query params : `sources` (CSV de `source_origine` : `MEC`, `Vivier COP`, `Fonds Vert`, `DGCL DETR`…
— ⚠ pas de source `TeT` en V1 : les fiches action TeT ne sont pas exposées dans cette vue),
`copMillesime` (`2024`|`2025`), `copStatutVivier` (`a_remonter`, `a_travailler`,
`hors_cop_mais_crte`, `non_remonte`), `limit` (1–200, défaut 50), `offset`,
`inclureFinancementsSeuls` (défaut `false` : les groupes composés uniquement de
financements DGCL/Fonds Vert sont masqués).

```bash
curl -H "Authorization: Bearer $MEC_API_KEY" \
  "$BASE/territoires/80021/projets?sources=Vivier%20COP&copMillesime=2024&limit=5"
```

Réponse : liste de **groupes**. Un groupe = les traces d'un même projet réel dans les
différentes sources (regroupement par la déduplication du pipeline).

```json
{
  "total": 23, "limit": 5, "offset": 0,
  "groupes": [
    {
      "confiance": "PROBABLE",
      "traces": [
        { "role": "projet", "source": "MEC", "id": "019dab93-…", "externalId": "51285",
          "nom": "…", "statut": "En cours", "phase": "Opération", "budgetPrevisionnel": 150000,
          "copMillesime": null, "copStatutVivier": null },
        { "role": "projet", "source": "Vivier COP", "id": "cop_20675265", "externalId": null,
          "nom": "…", "statut": "En instruction", "copMillesime": "2024", "copStatutVivier": "a_remonter" },
        { "role": "financement", "source": "DGCL DSIL", "id": "dgcl-…",
          "budgetPrevisionnel": 1308903, "montantAttribue": 150000 }
      ]
    },
    { "confiance": null, "traces": [ { "role": "projet", "source": "Vivier COP", "…": "…" } ] }
  ]
}
```

**Sémantique UX convenue** :
- `confiance: "CERTAIN"` → afficher comme **lien établi** entre les traces ;
- `"PROBABLE"` → afficher comme **suggestion** (à confirmer par l'agent → `POST /decisions`) ;
- `null` → singleton (une seule trace connue).
- `role: "financement"` (DGCL DETR/DSIL/DPV, Fonds Vert) : à présenter comme financement
  du projet du groupe, pas comme un projet distinct. ⚠ `budgetPrevisionnel` = montant **demandé**
  (coût du dossier) ; `montantAttribue` = subvention réellement attribuée (DGCL uniquement,
  null pour Fonds Vert).
- Les filtres sélectionnent les projets **du territoire** ; le groupe renvoyé contient
  ensuite *toutes* les traces du projet réel, y compris d'autres sources.

## 2. `GET /projets/mec/{externalId}/plans-territoire`

Résout votre `externalId`, renvoie les PCAET couvrant les communes du projet
(référentiel dédupliqué : un SIREN porteur = un PCAET).

```bash
curl -H "Authorization: Bearer $MEC_API_KEY" "$BASE/projets/mec/181/plans-territoire"
```

```json
{ "pcaet": [ { "nom": "PCAET …", "sirenPorteur": "241700640",
               "presentDansTet": false, "tetExternalId": null, "source": "opendata" } ],
  "fichesActionSuggerees": [] }
```

⚠️ `presentDansTet`/`tetExternalId` : le deep-link TeT n'est possible que pour les plans
connus de l'API TeT (~1/3 des cas) — prévoir l'affichage sans lien.
`fichesActionSuggerees` : vide en V1 (bonus à venir).

## 3. `GET /projets/mec/{externalId}/qualification`

Le « GET leviers » : qualification calculée par le pipeline.

```json
{ "externalId": "51285", "projetId": "019dab95-…",
  "leviersSgpe": ["Rénovation (hors changement chaudières)"],
  "llmThematiques": [ { "label": "…", "score": 0.95 } ],
  "llmProbabiliteTe": 0.9, "llmClassifiedAt": "2026-05-02T…" }
```

`404` si l'`externalId` est inconnu (projet non encore synchronisé via le webhook).

## 4. `POST /decisions` — le contrat de feedback

Journal **append-only** : chaque validation/infirmation d'un agent (DDT, collectivité)
est un événement qui **survit aux recalculs du pipeline**. Implémentation côté MEC prévue
à la rentrée — le contrat est figé dès maintenant.

```bash
curl -X POST -H "Authorization: Bearer $MEC_API_KEY" -H "Content-Type: application/json" \
  "$BASE/decisions" -d '{
    "typeDecision": "lien_confirme",
    "objetAType": "projet", "objetAId": "019dab93-f4cc-7641-8bd6-3f69a44c49f3",
    "objetBType": "projet", "objetBId": "cop_20675265",
    "verdict": "confirme",
    "auteur": "agent-ddtm-59",
    "commentaire": "Même projet, confirmé avec la collectivité"
  }'
# → 201 { "id": "77b096d7-…", "createdAt": "2026-07-07T…" }
```

Règles :
- `objetAId`/`objetBId` = **toujours les `traces[].id`** (jamais un identifiant de groupe,
  qui n'existe d'ailleurs pas dans l'API) ;
- `typeDecision` libre mais convenu : `lien_confirme`, `lien_infirme`, `doublon_signale`,
  `projet_valide`, `projet_obsolete`, `rattachement_pcaet` ;
- pas de modification/suppression : pour revenir sur une décision, poster un nouvel
  événement avec `supersedes: "<uuid de la décision révoquée>"` (le pipeline apprendra à les
  consommer — un lien `infirme` ne sera pas recréé) ;
- `GET /decisions?objetId=<id>` pour relire les décisions d'un objet — **chaque service ne
  voit que ses propres décisions** (filtrées sur la plateforme authentifiée).

## Cadrage POC PCAET — 5 EPCI (feature flag côté MEC)

| EPCI | SIREN (= `code` de l'endpoint territoires) |
|---|---|
| CU d'Arras | `200033579` |
| CC de la Haute Saintonge | `200041523` |
| CA Pornic Agglo Pays de Retz | `200067346` |
| Nantes Métropole | `244400404` |
| CA Valenciennes Métropole | `245901160` |

## Limites connues V1

- Vivier COP : Hauts-de-France uniquement (millésimes 2024 atténuation+biodiv, 2025 adaptation) ;
  ~10 % des lignes portent un rattachement territorial `needs_review` côté pipeline.
- PCAET : la table de référence (`pcaet_reference`) est un livrable du chantier T4 déployé
  séparément ; tant qu'elle n'est pas en production, `plans-territoire` renvoie `pcaet: []`
  (pas d'erreur — dégradation propre). Couverture cible une fois livrée : 50,7 % des projets
  MEC. Canal TeT-live exclu (bug d'ingestion webhook, issue #497).
- Les groupes reflètent l'état de la déduplication : des doublons intra-MEC (~6 200 connus
  côté MEC) apparaissent comme des groupes distincts tant qu'ils ne sont pas fusionnés.
