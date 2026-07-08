# Intégration MEC — vue territoriale DDT & feedback

> Public : équipe Mon Espace Collectivité (tech + produit, Sylvain). Sprint juillet 2026, POC.
> Spec machine : [`openapi-territoires-decisions.yaml`](./openapi-territoires-decisions.yaml)
> (mêmes endpoints dans le Swagger `/api` de l'instance).
> Miroir TeT de ce document : [`INTEGRATION_TET.md`](./INTEGRATION_TET.md).

## 1. L'apport — à quoi ça sert

Un agent DDT (ou une collectivité) veut voir, pour un territoire, **tous les projets de transition
écologique qui s'y rattachent**, quelle que soit la source. L'API réunit sous un même toit les
projets vus par MEC, le Vivier COP et les financements DGCL/Fonds Vert, **dédupliqués** : un projet
réel = un **groupe**, même s'il apparaît dans plusieurs sources. Pour chaque projet MEC, vous
obtenez aussi les **PCAET** qui couvrent son territoire et sa **qualification** (leviers,
thématiques, probabilité TE) calculée par le pipeline.

En retour, l'agent peut **donner son avis** — « ces deux traces sont le même projet », « ce projet
est obsolète », « ce champ est faux » — via un `POST /decisions` qui **survit aux recalculs** du
pipeline (journal append-only, partagé avec TeT). C'est le **miroir** de ce que fait TeT : là où MEC
part d'un projet et cherche ses PCAET, TeT part d'un PCAET et liste les projets de son territoire ;
les deux écrivent dans le **même journal**.

## 2. Le modèle mental

- **Trace** = une occurrence d'un projet réel dans **une** source (MEC, Vivier COP, Fonds Vert,
  DGCL…). Sa seule référence stable est `traces[].id` — la seule à persister côté MEC, la seule
  acceptée par `POST /decisions`.
- **Groupe** = un projet réel, c.-à-d. l'ensemble de ses traces. Aucun identifiant de groupe n'est
  exposé : les regroupements sont recalculés à chaque run du pipeline. On raisonne sur les
  `traces[].id`, jamais sur « le groupe ».
- **Rôle** : une trace est un `projet` ou un `financement` (DGCL, Fonds Vert). Un financement se
  rattache au projet du groupe, ce n'est pas un projet distinct.
- **Confiance** (du groupe) : `CERTAIN` (lien établi), `PROBABLE` (suggestion à confirmer), `null`
  (trace seule).
- **Décision** = un événement **append-only** (doublon, statut, rattachement PCAET, correction). On
  ne modifie ni ne supprime : pour revenir en arrière, on poste une **révocation**
  (`verdict: "annule"`, `supersedes: <id>`). Détails : [`GUIDE_DECISIONS.md`](./GUIDE_DECISIONS.md).

## 3. Démarrer en 10 min (réponses réelles, territoire d'Amiens)

```bash
BASE=https://api.collectivites.beta.gouv.fr
# La clé identifie la plateforme : POST /decisions enregistre plateforme_source = MEC
# (le corps ne peut pas se faire passer pour un autre service).
AUTH="Authorization: Bearer $MEC_API_KEY"
```

**a) Lister les projets d'un territoire.** `code` = INSEE commune (5 chiffres ou 2A/2B+3) ou SIREN
EPCI (9 chiffres, développé en ses communes membres).

```bash
curl -H "$AUTH" "$BASE/territoires/80021/projets?limit=5"
```

```jsonc
{
  "total": 40,
  "limit": 5,
  "offset": 0,
  "groupes": [
    {
      "confiance": "PROBABLE",
      "traces": [
        {
          "role": "projet",
          "source": "MEC",
          "id": "019dab94-c75e-7ef8-b7ec-7971a538bdd8",
          "externalId": "48345",
          "nom": "Rénover énergétiquement la crèche Pom'Cannelle",
          "budgetPrevisionnel": 232605,
        },
        {
          "role": "financement",
          "source": "Fonds Vert",
          "id": "12603143",
          "statut": "Accepté",
          "phase": "Réalisation",
          "budgetPrevisionnel": 232604.72,
        },
        {
          "role": "projet",
          "source": "Vivier COP",
          "id": "cop_20687601",
          "statut": "En instruction",
          "copMillesime": "2024",
          "copStatutVivier": "a_remonter",
        },
      ],
      // Décisions ACTIVES portant sur une trace du groupe, toutes plateformes, SANS l'auteur.
      "decisions": [],
    },
  ],
}
```

Query params : `sources` (CSV de `source_origine` : `MEC`, `Vivier COP`, `Fonds Vert`, `DGCL DETR`…
— ⚠ pas de source `TeT` en V1), `copMillesime` (`2024`|`2025`), `copStatutVivier` (`a_remonter`,
`a_travailler`, `hors_cop_mais_crte`, `non_remonte`), `limit` (1–200, défaut 50), `offset`,
`inclureFinancementsSeuls` (défaut `false` : masque les groupes 100 % financements),
`masquerObsoletes` (défaut `false` : masque les groupes marqués obsolètes).

**Portée des filtres et sens de `total`** :

- Les filtres (`sources`, `copMillesime`, `copStatutVivier`) portent sur les projets **du
  territoire** : un groupe est renvoyé dès qu'**au moins une** de ses traces sur le territoire
  matche. Le groupe est alors renvoyé **complet** — _toutes_ ses traces, y compris celles qui **ne
  matchent pas** le filtre (autres sources, mais aussi autres `copMillesime`/`copStatutVivier`) et
  les membres du cluster hors territoire.
- `total` = nombre de **groupes**, pas de projets : plusieurs projets matchants fusionnés dans un
  même cluster ne comptent que pour 1 (ex. réel : 29 projets Vivier COP `a_remonter` sur la CU
  d'Arras → `total` 27).

**Sémantique UX convenue** : `CERTAIN` → **lien établi** ; `PROBABLE` → **suggestion** (à confirmer
par l'agent) ; `null` → singleton. `role: "financement"` → présenter comme financement du groupe.
⚠ `budgetPrevisionnel` = montant **demandé** (coût du dossier) ; `montantAttribue` = subvention
**attribuée** (DGCL uniquement, `null` pour Fonds Vert).

**b) Les PCAET couvrant un projet.** Résout votre `externalId`, renvoie les PCAET du territoire
(référence dédupliquée : un SIREN porteur = un PCAET).

```bash
curl -H "$AUTH" "$BASE/projets/mec/181/plans-territoire"
```

```jsonc
{
  "pcaet": [
    {
      "nom": "PCAET",
      "sirenPorteur": "241700640",
      "source": "opendata",
      "presentDansTet": false,
      "tetExternalId": null,
    },
  ],
  "fichesActionSuggerees": [],
}
```

Chaque PCAET porte aussi un champ `rattachement` (`confirme`|`infirme`|`aucun`) vis-à-vis de CE
projet, dérivé du journal de décisions — voir la symétrie TeT au §4. `presentDansTet`/`tetExternalId`
sont **vides pour tous les PCAET aujourd'hui** (canal TeT non branché, cf. §6) : prévoir l'affichage
sans deep-link. `fichesActionSuggerees` : vide en V1.

**c) La qualification d'un projet** (le « GET leviers ») :

```bash
curl -H "$AUTH" "$BASE/projets/mec/48345/qualification"
```

```jsonc
{
  "externalId": "48345",
  "projetId": "019dab94-c75e-7ef8-b7ec-7971a538bdd8",
  "leviersSgpe": ["Rénovation (hors changement chaudières)", "Sobriété des bâtiments (tertiaire)"],
  "llmThematiques": [
    { "label": "Audit ou travaux de rénovation énergétique tertiaire", "score": 0.97 },
    { "label": "Sobriété énergétique", "score": 0.72 },
  ],
  "llmProbabiliteTe": 0.82,
  "llmClassifiedAt": "2026-05-06T13:00:06Z",
}
```

`404` si l'`externalId` est inconnu (projet non encore synchronisé via le webhook).

**d) Donner son feedback** = poster une décision. `objetAId`/`objetBId` = **toujours des
`traces[].id`**. Exemple : confirmer que la trace MEC et la trace Vivier COP sont le même projet.

```bash
curl -X POST -H "$AUTH" -H "Content-Type: application/json" "$BASE/decisions" -d '{
  "typeDecision": "doublon_confirme",
  "objetAType": "projet", "objetAId": "019dab94-c75e-7ef8-b7ec-7971a538bdd8",
  "objetBType": "projet", "objetBId": "cop_20687601",
  "auteur": "agent-ddtm-80", "commentaire": "Même projet, vérifié avec la collectivité"
}'
# → 201 { "id": "…", "createdAt": "…" }
```

`typeDecision` est un **vocabulaire fermé** (toute autre valeur → `400`) : `doublon_signale`,
`doublon_confirme`, `doublon_infirme`, `rattachement_pcaet`, `projet_statut`, `correction_signalee`.
Chaque type impose ses contraintes (objetB/verdict/payload) et la révocation se fait par
`verdict: "annule"` + `supersedes`. **Parcours, règles et exemples complets :
[`GUIDE_DECISIONS.md`](./GUIDE_DECISIONS.md).**

## 4. Le parcours

1. L'agent DDT ouvre un territoire → `GET /territoires/{code}/projets`.
2. L'écran liste les **groupes** ; on affiche `confiance` (lien établi / suggestion / singleton) et
   les financements comme financements du groupe. Sur un projet MEC, on peut aller chercher ses PCAET
   (`plans-territoire`) et sa qualification.
3. L'agent tranche → `POST /decisions` (doublon, statut de projet, rattachement PCAET, correction).
4. Au prochain GET, `decisions[]` porte l'historique **actif** du groupe (toutes plateformes, sans
   l'auteur). La refonte des regroupements par le pipeline, elle, intervient au prochain **rebuild**
   (signal immédiat, refonte différée).

### Ce que fait TeT de son côté (symétrie)

Le rattachement projet ↔ PCAET s'écrit et se lit **dans les deux sens**, sur le **même journal**.
Côté TeT, l'endpoint miroir part du **PCAET** et liste les projets de son territoire :
`GET /plans/{cle}/projets-territoire` (`cle` = SIREN porteur ou plan_id), avec par groupe le même
champ `rattachement` (`confirme`|`infirme`|`suggere`|`aucun`). Un rattachement coché depuis TeT
(`POST /decisions`, `rattachement_pcaet`) est **immédiatement visible ici**, et réciproquement — même
décision. Détails : [`INTEGRATION_TET.md`](./INTEGRATION_TET.md).

## 5. Ce qui vous appartient (et ce qu'il ne faut pas persister)

| Donnée                                              | Stabilité                                                                                                                                                                                                                                                                                                                                                                       |
| --------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `traces[].id` (UUID/ID objet)                       | **Stable et contractuel** — seule référence à persister côté MEC (et la seule acceptée par `POST /decisions`). **Exception : les traces DGCL** (`role: "financement"`, sources `DGCL *`) ne sont **pas contractuelles** — ne jamais les persister ni les référencer dans une décision (une partie changera au prochain recalcul ; réévaluation à la rentrée selon le deal DGCL) |
| `traces[].externalId`                               | Stable (c'est votre propre id)                                                                                                                                                                                                                                                                                                                                                  |
| Composition des groupes, `confiance`, `decisions[]` | **Recalculées / dérivées** à chaque lecture — ne jamais persister ; c'est pourquoi aucun identifiant de groupe n'est exposé                                                                                                                                                                                                                                                     |
| `copMillesime`, `copStatutVivier`, leviers, `llm*`  | Stables entre deux livraisons DREAL/référentiel                                                                                                                                                                                                                                                                                                                                 |

Vous êtes propriétaire de **vos décisions** (`plateforme_source = MEC`, dérivée de la clé). Vous ne
révoquez que les vôtres ; `GET /decisions?objetId=…` (ou `?type=…`) ne renvoie que celles de MEC. La
vue territoriale (`decisions[]`) agrège toutes les plateformes mais **jamais l'agent auteur** (PII).

## 6. Garanties & limites

- **Vivier COP** : Hauts-de-France uniquement (millésimes 2024 atténuation+biodiv, 2025 adaptation) ;
  ~10 % des lignes portent un rattachement territorial `needs_review` côté pipeline.
- **PCAET** : la référence (`pcaet_reference`) est **en production** — 558 PCAET, tous
  `source: "opendata"` (ADEME). Couverture cible une fois pleinement alimentée : **50,7 %** des
  projets MEC. `presentDansTet`/`tetExternalId` sont vides pour l'ensemble des 558 PCAET (canaux
  snapshot/live TeT non branchés, [issue #497](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/497))
  → pas de deep-link TeT pour l'instant.
- **Regroupements** : les groupes reflètent l'état de la déduplication ; des doublons intra-MEC
  (~6 200 connus) apparaissent comme des groupes distincts tant qu'ils ne sont pas fusionnés — d'où
  l'intérêt de vos décisions `doublon_*`.
- **Journal append-only** : pas d'`UPDATE`/`DELETE`. Revenir sur une décision = `verdict: "annule"`
  - `supersedes` (les révocations sont exclues de toutes les lectures).

## 7. Pour la suite — 4 étapes côté MEC

1. **Nommer un interlocuteur technique + un interlocuteur produit** côté MEC (point de contact du POC).
2. **Valider le flow sur les 5 EPCI POC** (ci-dessous) : lister un territoire → afficher groupes,
   PCAET, qualification → poster une décision → la revoir dans `decisions[]`.
3. **Implémenter `POST /decisions`** derrière un feature flag (prévu à la rentrée — le contrat est
   figé dès maintenant, cf. [`GUIDE_DECISIONS.md`](./GUIDE_DECISIONS.md)).
4. **Bilan d'usage commun à la rentrée** : volumétrie des décisions, qualité des regroupements,
   décision d'élargissement au-delà des 5 EPCI.

### Les 5 EPCI POC

| EPCI                         | SIREN (= `code` de l'endpoint territoires) |
| ---------------------------- | ------------------------------------------ |
| CU d'Arras                   | `200033579`                                |
| CC de la Haute Saintonge     | `200041523`                                |
| CA Pornic Agglo Pays de Retz | `200067346`                                |
| Nantes Métropole             | `244400404`                                |
| CA Valenciennes Métropole    | `245901160`                                |

## Contact

Questions d'intégration cet été : **Jean** (l'équipe API Collectivités est en effectif réduit en
août — privilégier des demandes groupées et asynchrones). Sémantique des décisions :
[`GUIDE_DECISIONS.md`](./GUIDE_DECISIONS.md).
