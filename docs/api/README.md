# Documentation API Collectivités

Point d'entrée de la documentation d'intégration de l'**API Collectivités** (le référentiel partagé
des projets de transition écologique des collectivités : MEC, TeT, Vivier COP, financements
DGCL/Fonds Vert, PCAET, dédupliqués). Chaque guide est écrit du point de vue de la plateforme qui
l'intègre. Trouvez le vôtre ci-dessous.

Base de l'API : `https://api.collectivites.beta.gouv.fr` · Auth : `Authorization: Bearer <clé>`
(la clé identifie la plateforme ; `plateforme_source` en est dérivée). Spec machine :
[`openapi-territoires-decisions.yaml`](./openapi-territoires-decisions.yaml) et le Swagger `/api` de
l'instance.

## Vous intégrez depuis…

### Mon Espace Collectivité (MEC)

- [**`INTEGRATION_MEC.md`**](./INTEGRATION_MEC.md) — vue territoriale DDT : lister les projets d'un
  territoire (dédupliqués), les PCAET couvrant un projet, sa qualification, et donner du feedback.
- [`classification-et-aides.md`](./classification-et-aides.md) — classification LLM des projets et
  matching d'aides.
- [`leviers-endpoint.md`](./leviers-endpoint.md) — endpoint `/qualification/leviers` (leviers SGPE).

### Territoires en Transitions (TeT)

- [**`INTEGRATION_TET.md`**](./INTEGRATION_TET.md) — vue miroir : partir d'un PCAET, lister les
  projets de son territoire, et les **rattacher** un à un (`GET /plans/{cle}/projets-territoire`).

### Transverse — toutes plateformes

- [**`GUIDE_DECISIONS.md`**](./GUIDE_DECISIONS.md) — le contrat de **décisions** (`POST /decisions`) :
  doublons, statut de projet, rattachement PCAET, correction, et la révocation par `annule`. À lire
  dès que vous écrivez dans le référentiel, quelle que soit votre plateforme.

- [**`GUIDE_QUESTIONNAIRES.md`**](./GUIDE_QUESTIONNAIRES.md) — **questionnaires, recommandations et
  ajouts manuels**. Les champs d'un questionnaire, comment une condition associe une recommandation
  aux réponses, l'`aideId` qui rend une aide **ajoutable en un clic**, et comment attacher à la main
  une aide, un service du catalogue ou un service **hors catalogue**. À lire si vous éditez le
  contenu, ou si vous l'intégrez.

### Interne / gouvernance

- [**`DOCTRINE_ACCES_DONNEES.md`**](./DOCTRINE_ACCES_DONNEES.md) — « qui voit quoi » : scopes de
  données, sources restreintes, attribution et retrait d'un accès, journalisation.

## Repères communs

- **Groupe** = un projet réel = l'ensemble de ses **traces** dans les différentes sources. Aucun
  identifiant de groupe n'est exposé (les regroupements sont recalculés à chaque run) ; la seule
  référence stable est `traces[].id`.
- **Décision** = un événement **append-only** partagé entre plateformes ; on ne modifie ni ne
  supprime, on **révoque** (`verdict: "annule"` + `supersedes`).
- **Signal immédiat, refonte différée** : vos décisions sont lisibles tout de suite (`decisions[]`,
  `rattachement`, filtre obsolètes) ; la refonte des regroupements par le pipeline intervient au
  prochain rebuild.

## Contact

Intégration cet été : **Jean** (effectif réduit en août — demandes groupées et asynchrones).
