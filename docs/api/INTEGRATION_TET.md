# Intégration TeT — rattacher les projets d'un territoire à un PCAET

> Public : équipe Territoires en Transitions (tech + produit). Sprint juillet 2026, POC.
> Spec machine : [`openapi-territoires-decisions.yaml`](./openapi-territoires-decisions.yaml)
> (mêmes endpoints dans le Swagger `/api` de l'instance).
> Miroir MEC de ce document : [`INTEGRATION_MEC.md`](./INTEGRATION_MEC.md).

## 1. L'apport — à quoi ça sert

Un porteur de PCAET (EPCI) veut savoir **quels projets de son territoire relèvent de son plan**, et
les **rattacher** un à un. L'API réunit sous un même toit les projets vus par MEC, le Vivier COP et
les financements DGCL/Fonds Vert, **dédupliqués** (un projet réel = un groupe, même s'il apparaît
dans plusieurs sources). Vous interrogez un PCAET par le **SIREN de son porteur**, vous recevez les
projets des communes couvertes, et pour chacun un état de **rattachement** à _ce_ PCAET
(`confirme` / `infirme` / `suggere` / `aucun`). Le geste « je coche ce projet dans mon PCAET » est un
`POST /decisions` : il **survit aux recalculs** du pipeline (journal append-only, partagé avec MEC).

C'est le **miroir** de ce que fait MEC : là où MEC part d'un projet et cherche ses PCAET
(`GET /projets/mec/{externalId}/plans-territoire`), TeT part d'un PCAET et liste les projets de son
territoire (`GET /plans/{cle}/projets-territoire`). Les deux écrivent dans le **même journal** de
rattachements — un rattachement coché côté TeT est visible côté MEC, et réciproquement.

## 2. Le modèle mental

- **PCAET** = une fiche de référence identifiée par le **SIREN de son porteur** (clé stable). La
  référence (`schema_commun_v2.pcaet_reference`) compte aujourd'hui **558 PCAET**, tous issus du
  canal _opendata_ (ADEME). Un PCAET couvre une liste de **communes** (INSEE).
- **Groupe** = un projet réel, c.-à-d. l'ensemble de ses **traces** dans les différentes sources
  (MEC, Vivier COP, financements). Aucun identifiant de groupe n'est exposé : les clusters sont
  recalculés à chaque run. La seule référence stable est `traces[].id`.
- **Rattachement** (par groupe, vis-à-vis du PCAET interrogé) :
  - `confirme` / `infirme` — une **décision humaine** (la vôtre, ou celle de MEC) l'affirme ;
  - `suggere` — **pas** de décision, mais le pipeline a marqué une trace du groupe comme opération
    PCAET : un candidat à confirmer ;
  - `aucun` — ni décision, ni signal.
- **Décision** = un événement **append-only**. On ne modifie ni ne supprime : pour revenir sur un
  rattachement, on poste une **révocation** (`verdict: "annule"`, `supersedes: <id>`). Voir
  [`GUIDE_DECISIONS.md`](./GUIDE_DECISIONS.md).

## 3. Démarrer en 10 min (réponses réelles, territoire de Nantes Métropole)

```bash
BASE=https://api.collectivites.beta.gouv.fr
# Clé API TeT à provisionner (plateforme_source = TeT, dérivée de la clé) — cf. étape 1 du §7.
AUTH="Authorization: Bearer $TET_API_KEY"
```

**a) Lister les projets du territoire d'un PCAET.** `cle` = SIREN du porteur (ici Nantes Métropole,
`244400404`) **ou** un `plan_id` de la référence (opendata/snapshot/live) — les deux résolvent la
même fiche.

```bash
curl -H "$AUTH" "$BASE/plans/244400404/projets-territoire?limit=200"
```

```jsonc
{
  "pcaet": { "sirenPorteur": "244400404", "nom": "PCAET de Nantes Métropole", "source": "opendata" },
  "total": 490,
  "limit": 200,
  "offset": 0,
  "groupes": [
    {
      "confiance": "PROBABLE",
      "traces": [
        {
          "role": "projet",
          "source": "MEC",
          "id": "019b9e2f-5dda-7877-a6d5-13f526e05513",
          "externalId": "3138",
          "nom": "Rénovation énergétique du COSEC…",
          "statut": "En cours",
          "phase": "Opération",
          "budgetPrevisionnel": 3776713,
        },
        {
          "role": "financement",
          "source": "Fonds Vert",
          "id": "11629149",
          "nom": "Rénovation énergétique du complexe sportif…",
          "budgetPrevisionnel": 1232940,
        },
      ],
      "decisions": [],
      "rattachement": "suggere", // signal pipeline : à confirmer
    },
    {
      "confiance": null,
      "traces": [
        {
          "role": "projet",
          "source": "MEC",
          "id": "019b0d22-166b-7082-bdb5-2d7e86ca6bdc",
          "externalId": "2164",
          "nom": "Création d'un parc éolien off shore",
          "statut": "En cours",
        },
      ],
      "decisions": [],
      "rattachement": "aucun",
    },
  ],
}
```

Query params (identiques à `GET /territoires/{code}/projets`) : `sources` (CSV de `source_origine`),
`copMillesime` (`2024`|`2025`), `copStatutVivier`, `limit` (1–200, défaut 50), `offset`,
`inclureFinancementsSeuls` (défaut `false`), `masquerObsoletes` (défaut `false`).

**b) Cocher un projet dans le PCAET** = poster une décision de rattachement. `objetAId` = la
`traces[].id` du projet ; `objetBId` = le **SIREN porteur** ; `objetBType` = `pcaet`.

```bash
curl -X POST -H "$AUTH" -H "Content-Type: application/json" "$BASE/decisions" -d '{
  "typeDecision": "rattachement_pcaet",
  "objetAType": "projet", "objetAId": "019b0d22-166b-7082-bdb5-2d7e86ca6bdc",
  "objetBType": "pcaet",  "objetBId": "244400404",
  "verdict": "confirme",
  "auteur": "agent-tet-44", "commentaire": "Rattaché depuis TeT"
}'
# → 201 { "id": "…", "createdAt": "…" }
```

**c) Le revoir marqué.** Le même GET renvoie désormais `"rattachement": "confirme"` pour ce groupe
(vérifié de bout en bout contre la prod : `aucun → confirme → aucun`).

**d) Décocher** = révoquer, jamais supprimer :

```bash
curl -X POST -H "$AUTH" -H "Content-Type: application/json" "$BASE/decisions" -d '{
  "typeDecision": "rattachement_pcaet",
  "objetAType": "projet", "objetAId": "019b0d22-166b-7082-bdb5-2d7e86ca6bdc",
  "objetBType": "pcaet",  "objetBId": "244400404",
  "verdict": "annule", "supersedes": "<id de la décision à révoquer>"
}'
```

Clé inconnue → `404` explicite : `PCAET introuvable pour la clé « 000000000 » (attendu : SIREN du
porteur — 9 chiffres — ou un plan_id de la référence).`

## 4. Le parcours

1. L'agent TeT ouvre le PCAET de son EPCI → `GET /plans/{siren}/projets-territoire`.
2. L'écran liste les groupes ; on met en avant les `suggere` (candidats) et les `confirme` (déjà
   rattachés). Un groupe ↔ un projet réel ; on affiche `confiance` (CERTAIN = lien établi,
   PROBABLE = suggestion, null = singleton) et les financements comme financements du groupe.
3. L'agent coche/décoche → `POST /decisions` (`rattachement_pcaet`, `confirme`/`infirme`, ou
   `annule` pour revenir en arrière).
4. Au prochain GET, le `rattachement` du groupe reflète la décision. `decisions[]` porte l'historique
   actif (toutes plateformes, sans l'auteur — cloisonnement PII).

### Ce que fait MEC de son côté

MEC part du **projet** : `GET /projets/mec/{externalId}/plans-territoire` liste les PCAET couvrant
les communes du projet, avec le **même** champ `rattachement`. Un rattachement posté depuis TeT est
donc immédiatement visible côté MEC (journal partagé), et inversement. Détails :
[`INTEGRATION_MEC.md`](./INTEGRATION_MEC.md).

## 5. Ce qui vous appartient (et ce qu'il ne faut pas persister)

| Donnée                                               | Stabilité                                                                                                                                                                                                       |
| ---------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pcaet.sirenPorteur`                                 | **Stable et contractuel** — c'est la clé du PCAET, la seule à persister et à référencer dans une décision (`objetBId`)                                                                                          |
| `traces[].id`                                        | **Stable et contractuel** — seule référence de projet à persister (`objetAId`). **Exception : les traces DGCL** (`role: "financement"`, sources `DGCL *`) ne sont **pas** contractuelles — ne pas les persister |
| `traces[].externalId`                                | Stable côté MEC (leur id) ; ne concerne pas TeT                                                                                                                                                                 |
| `plan_id_*` (opendata/snapshot/live)                 | **Instables** — bougent d'un run à l'autre. Acceptés en entrée (`cle`) par commodité, jamais à persister ni à référencer                                                                                        |
| Composition des groupes, `confiance`, `rattachement` | **Recalculés / dérivés** à chaque lecture — ne pas persister ; relire l'API                                                                                                                                     |

Vous êtes propriétaire de **vos décisions** (`plateforme_source = TeT`, dérivée de la clé). Vous ne
révoquez que les vôtres ; `GET /decisions?objetId=…` ne renvoie que celles de TeT. La vue
territoriale (`decisions[]`) agrège toutes les plateformes mais **jamais l'agent auteur**.

## 6. Garanties & limites

- **Couverture PCAET** : cible **50,7 %** des projets une fois la référence pleinement alimentée.
  Aujourd'hui la référence est nourrie par le **seul canal opendata** (ADEME) : 558 PCAET, tous
  `source: "opendata"`.
- **Deep-links TeT indisponibles pour l'instant** : les canaux _snapshot_ et _live_ de TeT ne sont
  pas encore alimentés → `tet_external_id` est vide pour l'ensemble des 558 PCAET, donc pas de lien
  profond vers TeT. Débloqué par le correctif du webhook plans (voir étape 4 du §7).
- **`suggere` = signal indicatif**, pas une vérité : dérivé de `pcaet_operation_inscrite` (pipeline).
  Une décision humaine prime **toujours** sur le signal.
- **Journal append-only** : pas d'`UPDATE`/`DELETE`. Revenir sur une décision = `verdict: "annule"`
  - `supersedes` (les pierres tombales sont exclues de toutes les lectures).
- **`total` vs page** : `total` est le nombre de groupes du territoire ; paginez avec `limit`/`offset`
  (Nantes : 490 groupes).
- **Pas de source `TeT` côté projets** : les fiches action TeT ne sont pas (encore) exposées comme
  traces ; seul le rattachement PCAET circule dans les deux sens.

## 7. Pour la suite — 5 étapes côté TeT

1. **Nommer un interlocuteur technique + un interlocuteur produit** côté TeT (point de contact du POC).
2. **Valider le flow sur les 5 EPCI POC** (ci-dessous) : lister → cocher → revoir marqué → décocher.
3. **Consommer l'endpoint** `GET /plans/{cle}/projets-territoire` et **poster les rattachements**
   (`POST /decisions`, `rattachement_pcaet`).
4. **Corriger le webhook plans** qui ingère des plans **sans SIREN ni communes** (notre
   [issue #497](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/497))
   — débloque **~la moitié** de la couverture PCAET manquante et les deep-links TeT.
5. **Bilan d'usage commun à la rentrée** : volumétrie des rattachements, qualité des `suggere`,
   décision d'élargissement au-delà des 5 EPCI.

### Les 5 EPCI POC

| EPCI                         | SIREN (= `cle`) |
| ---------------------------- | --------------- |
| CU d'Arras                   | `200033579`     |
| CC de la Haute Saintonge     | `200041523`     |
| CA Pornic Agglo Pays de Retz | `200067346`     |
| Nantes Métropole             | `244400404`     |
| CA Valenciennes Métropole    | `245901160`     |

## Contact

Questions d'intégration cet été : **Jean** (l'équipe API Collectivités est en effectif réduit en
août — privilégier des demandes groupées et asynchrones). Sémantique des décisions :
[`GUIDE_DECISIONS.md`](./GUIDE_DECISIONS.md).
