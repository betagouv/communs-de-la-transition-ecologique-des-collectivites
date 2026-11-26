# AGENTS.md

Règles de travail pour tout agent de code (Claude Code, opencode / Albert Code, Codex…) et pour
les humains qui travaillent avec eux sur ce dépôt. Ce fichier prime sur les habitudes par défaut
de l'outil. En cas de doute sur une donnée, une action en production ou une décision qui engage
les partenaires : **s'arrêter et demander au mainteneur**.

## 1. Le produit

**API Projets Collectivités** (historiquement « Les communs de la transition écologique des
collectivités »), service beta.gouv.fr / DINUM. Deux objectifs :

- « Dites-le nous une fois » : un projet saisi sur une plateforme est disponible sur les autres.
- Rendre les services numériques découvrables depuis la page projet de chaque plateforme (widget).

Consommateurs :

- **Plateformes partenaires**, authentifiées par clé API et identifiées par un `serviceType`
  (MEC, TeT, DashboardTE, Recoco, UrbanVitaliz, SosPonts, FondVert, Turgot, SGPE).
- **Widget** `@betagouv/les-communs-widget`, embarqué dans MEC et TeT, qui appelle l'API depuis le
  navigateur de l'usager, **sans clé**.
- **Services de l'État** habilités à la base consolidée (`/consultation/v1`), selon
  `docs/api/DOCTRINE_ACCES_DONNEES.md`.

Grands domaines de l'API : projets (v1, v2), services et widget, consultation (base consolidée et
export), référentiel territorial (communes, EPCI, Banatic), territoires et décisions,
classification LLM des projets (jobs BullMQ), aides (Aides-territoires), analytics (Matomo).

## 2. Carte du dépôt

| Dossier                                      | Contenu                                                                                         |
| -------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `api/`                                       | NestJS 11, Drizzle ORM, PostgreSQL, Redis + BullMQ, Sentry. Sert aussi les pages annexes.       |
| `api/drizzle/`                               | Migrations SQL numérotées + `meta/_journal.json`.                                               |
| `api/scripts/`                               | Scripts d'exploitation (seed, imports, exports, création de clés). Certains tournent en cron.   |
| `api/test/`                                  | Tests e2e (HTTP), helpers, configs Jest. Les tests unitaires sont à côté du code (`*.spec.ts`). |
| `api/ADR/`, `docs/`                          | Décisions d'architecture, guides d'intégration et doctrines (`docs/api/`).                      |
| `widget/`                                    | Paquet npm du widget (React, Vite, DSFR, Vitest, changesets).                                   |
| `widget-sandbox/`                            | Bac à sable de démo du widget.                                                                  |
| `statistics-dashboard/`, `ressources-pages/` | Pages React servies par l'API.                                                                  |
| `back-office/`                               | Back-office interne de test ; l'API n'en dépend pas.                                            |
| `bench/`                                     | Expérimentations Python (classification). Hors production.                                      |

Production : Scalingo. **Staging** est déployé automatiquement à chaque fusion sur `main` ;
**la prod** l'est par un workflow GitHub déclenché à la main (bump de version, tag, push Scalingo).
Les migrations s'appliquent au déploiement (`Procfile` : `postdeploy`). Jobs planifiés :
`cron.json`.

## 3. Commandes

Node 22, pnpm 10 via Corepack. **pnpm uniquement** (npm et yarn sont bloqués).

```bash
corepack enable
pnpm install
pnpm prepare          # installe les hooks git : .npmrc a ignore-scripts=true, rien ne le fait à ta place
```

| Action                    | Commande                                                                                                 |
| ------------------------- | -------------------------------------------------------------------------------------------------------- |
| API en dev                | `pnpm dev:api` (base locale : `pnpm --filter api db:start`)                                              |
| Types + lint + format     | `pnpm --filter api validate` (lancé aussi par le hook pre-commit, sur tous les paquets)                  |
| Lint seul                 | `pnpm --filter api lint` (**applique `--fix`** : il modifie des fichiers)                                |
| Tests unitaires + scripts | `pnpm --filter api test` (**Docker requis** : le setup global lance Postgres et Redis en testcontainers) |
| Tests d'intégration       | `pnpm --filter api test:integration` (Docker, `ANTHROPIC_API_KEY`, Python 3 + `anthropic`)               |
| Tests e2e                 | `pnpm --filter api test:e2e` (Docker Compose dédié, ports 5433 et 6380)                                  |
| Comme la CI               | lint, `type-check`, `pnpm build:ressources-pages`, migrations, `pnpm --filter api test:ci`               |
| Widget                    | `pnpm --filter @betagouv/les-communs-widget validate`, puis `… exec vitest run`                          |

Un test ciblé : `pnpm --filter api test:unit --testPathPatterns <motif>`. Un motif passé seul,
sans l'option, ne filtre rien : toute la suite tourne.

## 4. Processus : écriture, revue, contre-revue

Tout changement de code passe par ce cycle. Les rôles sont distincts même quand un seul outil
les joue.

- **Auteur** : l'agent principal. Il cadre, implémente (ou délègue l'implémentation), trie la
  revue, corrige et ouvre la PR.
- **Implémenteur** (facultatif) : sous-agent à qui l'on confie un changement déjà spécifié
  (spec, fichiers, critères d'acceptation). Il s'arrête et pose la question si la spec est ambiguë.
- **Relecteur** : un agent **qui n'a pas écrit le changement**, lancé dans un contexte neuf, en
  lecture seule sur les fichiers suivis. Le modèle le plus capable disponible.
- **Mainteneur** (humain) : tranche les décisions, approuve et fusionne les PR, déclenche la prod.

### 4.1 Cadrer

1. Lire l'issue, ce fichier, la doc et les ADR concernés.
2. Tâche non triviale (migration, contrat d'API public, sécurité ou habilitations, logique sur
   plusieurs modules, conception incertaine) : écrire un plan court et le faire valider par le
   mainteneur **avant** de coder. Les plans de travail vont dans `claudedocs/` (ignoré par git).
3. Branche depuis `origin/main` à jour : `<type>/<sujet-court>` (`feat/…`, `fix/…`, `docs/…`).
   Si une autre session travaille déjà dans le checkout, utiliser un `git worktree`.

### 4.2 Écrire

1. **TDD** pour la logique métier et les endpoints : un test qui échoue d'abord, puis le minimum
   pour le faire passer, puis le refactor. Un correctif de bug commence par un test qui reproduit
   le bug.
2. Rester dans le périmètre demandé ; pas de refactor opportuniste ni de reformatage de code voisin.
3. Avant la revue : `validate` et les tests pertinents passent. Routes HTTP touchées : e2e
   concernés. Migration : test de migration (voir §6). Résultats réels notés, échecs cités ;
   ce qui n'a pas été lancé est dit « non testé ».

### 4.3 Revue indépendante

**Périmètre** : code applicatif, migrations, scripts planifiés ou lancés contre la prod,
dépendances, config de prod et CI (`.github/workflows/`, `Procfile`, `cron.json`, `.npmrc`,
`pnpm-workspace.yaml`, variables d'environnement). **Hors périmètre** : docs, assets seuls,
`bench/`, scripts ponctuels lancés à la main hors prod (vérifier leur sortie à la place).
PR mixte : revue limitée au code et à la config.

Le relecteur ne voit pas la conversation : son brief doit se suffire à lui-même.

```text
Tu es relecteur indépendant d'un changement sur l'API Projets Collectivités (NestJS, Drizzle,
PostgreSQL ; monorepo pnpm). Tu n'as pas écrit ce code et tu ne dois rien à son auteur : trouve
ce qui est réellement faux avant la fusion.
- Règles du dépôt : AGENTS.md ; doc concernée : <chemins>.
- Diff : <worktree ou chemin>, `git diff origin/main...HEAD` (ou PR #<n>).
- Ce que fait le changement, fichier par fichier : <résumé>.
- Décisions déjà prises, à ne pas rediscuter : <liste>.
- Commandes utiles : <tests, lint, lancement>. Fichiers jetables : <dossier ignoré par git>.
Ne modifie aucun fichier suivi ; ne committe, ne pousse et ne fusionne rien.
Prouve plutôt que soupçonner : lance les tests, écris un test jetable, exerce l'API.
Cherche : comportements faux et cas limites, régressions chez les appelants et consommateurs
(partenaires, widget déjà déployé), invariants et contrats cassés, état et concurrence, sécurité
et données (habilitations, fuite de lignes restreintes), migrations, config et build de prod,
tests absents ou inopérants, accessibilité si UI. Pas de remarques de style.
Rapport : remarques numérotées, la plus grave d'abord, chacune avec gravité
(bloquant / significatif / mineur), `chemin:ligne`, défaut, scénario d'échec concret,
vérifiée (comment) ou soupçonnée (pourquoi), piste de correction. Puis : ce que tu as vérifié
et trouvé sain, ce que tu n'as pas pu vérifier.
```

Avec Claude Code, utiliser les agents `implementer` et `reviewer` (et le skill `revue`) s'ils sont
installés ; sinon un sous-agent généraliste avec ce brief. Avec un autre outil, son mécanisme de
sous-agent ou une session neuve. Si possible, un modèle au moins aussi capable que celui de l'auteur.

### 4.4 Trier

Ne rien appliquer à l'aveugle. Pour chaque remarque : la vérifier dans le code, puis la classer
**corrigée**, **rejetée** (faux positif, hors périmètre, contraire à une décision : dire pourquoi)
ou **reportée** (dire où elle est notée). Toute remarque bloquante ou significative vérifiée se
corrige avant fusion, avec un test qui aurait attrapé le défaut quand c'est possible.

### 4.5 Corriger

Dans des commits distincts de ceux d'origine. Relancer `validate` et les tests.

### 4.6 Contre-revue

Seulement si des remarques bloquantes ou significatives ont été corrigées.

- Reprendre **le même relecteur** (il garde son contexte) avec le diff des corrections
  (`git diff <sha-avant-corrections>..HEAD`) et les remarques rejetées avec leur motif. À défaut,
  un relecteur neuf avec le brief initial, le premier rapport et le diff des corrections.
- Il statue sur chaque remarque (corrigée / partiellement / non corrigée, preuve à l'appui), puis
  relit le diff des corrections comme un nouveau changement.
- Nouvelles remarques bloquantes ou significatives : corriger, puis une vérification ciblée.
  Pas de troisième cycle complet sans en parler au mainteneur.

### 4.7 PR et fusion

- Titre au format Conventional Commits, en français. Corps en sections : **Contexte**,
  **Changements**, **Tests** (commandes et résultats réels), **Revue** (une ligne par remarque :
  corrigée avec le commit, rejetée avec le motif, reportée avec l'endroit ; ce que la contre-revue
  a trouvé), **Après fusion** ou **Après déploiement** (actions manuelles restantes).
- CI verte avant de demander la revue humaine.
- **Un agent ne fusionne jamais une PR et ne déclenche jamais le déploiement de prod.**

## 5. Règles non négociables

**Secrets et données**

- Aucun secret dans le code ni dans les messages ; toute nouvelle variable documentée dans
  `api/.env.template` (ou le `.env.template` du paquet). `gitleaks` tourne au pre-commit.
- Jamais de données de production en dev, en test ou dans les fixtures : données synthétiques.
- RGPD : minimisation des données personnelles, aucun traceur tiers non consenti. Jamais de
  vérification TLS désactivée dans le code.
- Habilitations (`services.data_scopes`) : uniquement par migration ou script d'admin versionné,
  **jamais** de DDL ou DML manuel en prod (doctrine d'accès). Décider qui est habilité revient au
  mainteneur, pas à l'agent.
- Toute entrée externe est non fiable : validation des DTO (`class-validator`), SQL paramétré
  (Drizzle ou `sql` tagué), jamais de concaténation. Les données issues de Matomo ou du payload de
  `/analytics/trackEvent` ne sont jamais rendues en HTML (`dangerouslySetInnerHTML`, `innerHTML`).

**Production**

- Aucune action qui modifie la prod ou le staging (`scalingo env-set`, restart, scale, deploy,
  écriture en base, script lancé contre la prod) sans l'accord explicite du mainteneur pour
  cette action précise.
- Lecture de la base de prod seulement sur demande, par tunnel, en transaction en lecture seule
  (`PGOPTIONS="-c default_transaction_read_only=on"`), `SELECT` uniquement. Copies locales de logs
  ou d'extractions supprimées après usage.

**Git**

- Jamais de commit direct sur `main`, jamais de `push --force` sur une branche partagée, jamais
  de `--no-verify` ni de `HUSKY=0` en local.
- Ne pas modifier `api/package.json#version` ni `api/CHANGELOG.md` : la release les gère.
- Dépôt public : aucun lien vers une session ou un artefact d'outil d'IA, ni trailer d'outil,
  dans les commits et les PR.

**Dépendances**

- pnpm uniquement. Toute nouvelle dépendance est justifiée (maintenance, poids, alternative
  standard), en version exacte, publiée depuis au moins 14 jours (pnpm refuse déjà sous 7 jours).
- Ajouter un paquet à `onlyBuiltDependencies` (scripts d'installation autorisés) se justifie dans
  la PR.

## 6. Conventions

**Langues** : code, identifiants et commentaires en anglais. Messages de commit, issues, titres
et corps de PR en français. Les guides de `docs/api/` sont en français.

**Commits** : Conventional Commits en français, portée = module (`feat(consultation): …`,
`fix(db): …`). Le sujet commence par une minuscule (commitlint `subject-case` le refuse sinon).
Commits atomiques. Les commits `chore(release): x.y.z` sont créés par la CI.

**API**

- Un module NestJS par domaine. Swagger à jour (décorateurs) pour toute route exposée.
- Erreurs au format `{ statusCode, message, errorInstanceId? }` (`GlobalExceptionFilter`).
- Routes à clé derrière `ApiKeyGuard` ; routes appelées par le widget marquées `@Public()` : le
  widget n'a pas de clé, ne jamais les mettre derrière la garde. Les sécuriser côté serveur
  (validation, limitation de débit).
- Un changement de réponse s'applique immédiatement aux widgets et partenaires déjà déployés :
  le traiter comme un changement de contrat.

**Base de données**

- Tables en `snake_case` au pluriel, colonnes en `snake_case`, jointures `table1_to_table2`, FK
  `<table>_id`, index `idx_<table>_<colonne>` ; Drizzle mappe en camelCase. Clés primaires
  uuidv7.
- Migrations **écrites à la main** (`pnpm db:generate` est cassé, voir §7) : fichier
  `api/drizzle/NNNN_description.sql` avec un commentaire d'en-tête en français qui explique le
  pourquoi, séparateurs `--> statement-breakpoint`, entrée ajoutée à `meta/_journal.json` avec
  l'index suivant et un `when` strictement supérieur au précédent (`migrations-journal.spec.ts`
  le vérifie).
- Ré-exécutable quand c'est possible (`IF NOT EXISTS`, `ON CONFLICT`). Une migration publiée ne
  se modifie jamais. Drizzle n'a pas de migration descendante : pour toute migration destructive,
  le SQL de retour arrière figure dans la PR.
- Branches parallèles : après rebase sur `main`, renuméroter sa migration si l'index est pris.

**Interfaces** : DSFR obligatoire (`@codegouvfr/react-dsfr`), RGAA / WCAG 2.1 AA, accessibilité
testée sur tout changement d'UI.

**Widget** : publié sur npm depuis `widget/` (changesets, `pnpm release`). Les consommateurs
épinglent leur version : un changement du widget n'atteint la prod qu'après leur montée de
version. Changement cassant : prévenir les équipes MEC et TeT à l'avance et documenter la
migration.

## 7. Pièges connus

- **`pnpm db:generate` échoue** (snapshot `drizzle/meta/0037_snapshot.json` malformé) ;
  `drizzle-kit migrate` fonctionne. Écrire les migrations à la main (§6).
- **Deux migrations au même index** : drizzle-kit saute en silence celle dont le `when` n'est pas
  postérieur à la dernière appliquée (incident 0057/0058).
- **Schémas ETL** (`schema_commun_v2`…) : construits par l'ETL, pas par les migrations. Absents du
  staging et de la base de test. Une route qui les lit fait 500 en staging et marche en prod :
  protéger la lecture par `to_regclass(...)` et dégrader en 404 ou en liste vide.
- **Variables d'env Scalingo** : une valeur modifiée (`env-set` ou tableau de bord) n'est prise en
  compte qu'après redémarrage de l'app ; vérifier la date des conteneurs avec `scalingo ps`.
- **La prod peut avoir des semaines de retard sur `main`** : avant d'analyser un incident,
  comparer `scalingo deployments` au `git log origin/main`, puis chercher la signature exacte de
  l'erreur dans les logs avant de l'attribuer à un commit.
- **E2E après un échec** : `test:e2e` ne s'arrête pas proprement quand un test échoue ; relancer
  `pnpm --filter api test:e2e:stop` avant de recommencer, certains tests ne sont pas idempotents
  sur une base réutilisée.
- **Lint** : `pnpm --filter api lint` réécrit les fichiers (`--fix`) ; relire le diff après.
- **Dater une ligne sans `created_at`** : les 48 premiers bits d'un uuidv7 sont l'horodatage en ms.

## 8. Où écrire

- Rapports, analyses, plans de travail : `claudedocs/` (ignoré par git). Brouillons :
  `scratch/`. Supprimer les fichiers temporaires en fin de tâche.
- Doc durable : `docs/api/` (guides, doctrines), `api/ADR/` (décisions d'architecture).
- Scripts d'exploration personnels : jamais versionnés tels quels. Hors dépôt, ou dans un dossier
  ajouté à `.gitignore` et à `api/.prettierignore`, comme ceux de `api/scripts/` déjà listés.

Ce fichier se maintient par PR. Quand une correction révèle un piège durable, proposer de
l'ajouter au §7, en une ligne sur le symptôme et la parade.
