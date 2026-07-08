# Guide des décisions — API Collectivités

> Public : plateformes partenaires (MEC, TeT, et tout service connecté) qui veulent
> **agir** sur le référentiel partagé, pas seulement le lire.
> Spec machine : Swagger de l'instance (`/api`), section « Décisions » et « Territoires ».
> Contact été : **Jean** (voir §7).

---

## 1. Ce que ça vous apporte

Vos agents voient dans votre interface des rapprochements que l'API a calculés
(« ces deux projets sont probablement le même », « ce PCAET couvre ce projet ») : les
**décisions** vous permettent de renvoyer leur jugement au référentiel, une fois pour toutes.
Une décision est un événement **qui survit à tous les recalculs** du pipeline : ce que votre
agent confirme aujourd'hui ne sera pas défait par le prochain traitement de nuit. En retour,
vous lisez les décisions de **toutes** les plateformes sur un même projet, ce qui transforme
une donnée « probable » en donnée « tranchée par un humain ».

## 2. Le modèle mental

Cinq notions suffisent.

- **Trace** : une occurrence d'un projet réel dans **une** source (MEC, Vivier COP, Fonds Vert,
  DGCL…). Chaque trace a un `id` stable — c'est **la seule référence à persister** chez vous et
  la seule qu'une décision accepte.
- **Groupe** : l'ensemble des traces que le pipeline pense décrire **le même projet réel**.
  Un groupe n'a **pas** d'identifiant exposé : sa composition est recalculée à chaque run, donc
  rien qui le désigne n'est stable. On raisonne sur les `id` des traces, jamais sur « le groupe ».
- **Rôle** : une trace est un `projet` ou un `financement` (DGCL, Fonds Vert). Un financement
  se rattache au projet du groupe, il n'est pas un projet distinct.
- **Confiance** : `CERTAIN` (lien établi), `PROBABLE` (suggestion à confirmer), `null` (trace
  seule). C'est le pipeline qui la calcule ; vos décisions sont ce qui la fait devenir « certaine ».
- **Décision** : le jugement d'un humain sur une ou deux traces (doublon, statut, rattachement,
  correction). Append-only : on ne modifie ni ne supprime, on **révoque** en réémettant.

### Un exemple réel — la crèche Pom'Cannelle à Amiens (INSEE `80021`)

Le même projet de rénovation existe dans trois sources. Le pipeline les a regroupés en un
groupe `PROBABLE` :

| Rôle        | Source     | `id` (trace)                               | Ce qu'en dit la source                                           |
| ----------- | ---------- | ------------------------------------------ | ---------------------------------------------------------------- |
| projet      | MEC        | `019dab94-…-a538bdd8` (`externalId` 48345) | « Rénover énergétiquement la crèche Pom'Cannelle »               |
| financement | Fonds Vert | `12603143`                                 | « Rénovation énergétique de la Crèche Pom Cannelle » — _Accepté_ |
| projet      | Vivier COP | `cop_20687601`                             | même intitulé — _En instruction_                                 |

Un agent qui reconnaît qu'il s'agit bien du même dossier poste **une** décision
`doublon_confirme` entre la trace MEC et la trace Vivier COP. Au prochain rebuild, le pipeline
n'aura plus à « deviner » : le lien est acté. Entre-temps, votre décision est déjà visible de
tous dans le champ `decisions[]` du groupe (voir §3).

## 3. Démarrer en 10 minutes

Base : `https://api.collectivites.beta.gouv.fr` · En-tête : `Authorization: Bearer <VOTRE_CLÉ>`.
La clé identifie votre plateforme ; toute décision que vous postez porte automatiquement
`plateforme_source = <votre plateforme>` (le corps ne peut pas usurper une autre plateforme).

### Lire un territoire et ses décisions

```bash
curl -H "Authorization: Bearer $CLE" \
  "https://api.collectivites.beta.gouv.fr/territoires/80021/projets?limit=5"
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
          "id": "019dab94-…",
          "externalId": "48345",
          "nom": "Rénover énergétiquement la crèche Pom'Cannelle",
          "budgetPrevisionnel": 232605,
        },
        {
          "role": "financement",
          "source": "Fonds Vert",
          "id": "12603143",
          "statut": "Accepté",
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
      // Décisions ACTIVES portant sur une trace du groupe, toutes plateformes confondues.
      // Vide tant que personne n'a tranché. L'AGENT auteur n'est jamais exposé, seulement
      // la plateforme émettrice.
      "decisions": [],
    },
  ],
}
```

Deux paramètres ajoutés par ce guide :

- `?masquerObsoletes=true` (défaut `false`) : masque les groupes dont une trace a été déclarée
  obsolète (décision `projet_statut` / `obsolete`) — la vue « projets vivants » de l'ANCT.
- `decisions[]` est présent sur **chaque** groupe (tableau vide s'il n'y a rien).

### Poster une décision (corps + réponse attendue — **ne pas exécuter ici**)

Confirmer que la trace MEC et la trace Vivier COP sont le même projet :

```jsonc
// POST /decisions
{
  "typeDecision": "doublon_confirme",
  "objetAType": "projet",
  "objetAId": "019dab94-c75e-7ef8-b7ec-7971a538bdd8",
  "objetBType": "projet",
  "objetBId": "cop_20687601",
  "commentaire": "Même projet, vérifié avec la collectivité",
}
```

```jsonc
// → 201
{ "id": "77b096d7-…", "createdAt": "2026-07-08T…Z" }
```

Relire ce qui a été tranché sur un objet, ou par type :

```bash
curl -H "Authorization: Bearer $CLE" \
  "https://api.collectivites.beta.gouv.fr/decisions?objetId=019dab94-c75e-7ef8-b7ec-7971a538bdd8"
curl -H "Authorization: Bearer $CLE" \
  "https://api.collectivites.beta.gouv.fr/decisions?type=projet_statut"
```

`GET /decisions` est **cloisonné** : vous ne relisez que **vos** décisions. À l'inverse,
`decisions[]` dans la vue territoire agrège **toutes** les plateformes (sans l'auteur).

## 4. Les parcours, un par type de décision

`typeDecision` est un **vocabulaire fermé** : toute autre valeur est refusée (`400`). Chaque
type impose ses contraintes ; un champ manquant ou interdit donne un `400` nommant le champ.

| `typeDecision`        | objet A                  | objet B                                           | `verdict`                       | `payload`                                         |
| --------------------- | ------------------------ | ------------------------------------------------- | ------------------------------- | ------------------------------------------------- |
| `doublon_signale`     | `projet`\|`fiche_action` | `projet`\|`fiche_action` (requis)                 | interdit                        | libre                                             |
| `doublon_confirme`    | idem                     | requis                                            | interdit                        | libre                                             |
| `doublon_infirme`     | idem                     | requis                                            | interdit                        | libre                                             |
| `rattachement_pcaet`  | `projet`                 | `pcaet` + `objetBId` = SIREN porteur (9 chiffres) | `confirme`\|`infirme`           | libre                                             |
| `projet_statut`       | `projet`                 | interdit                                          | `valide`\|`obsolete`\|`termine` | libre                                             |
| `correction_signalee` | tout type                | interdit                                          | interdit                        | **requis** : `{ champ, valeurProposee, source? }` |

**Révocation transverse** : quel que soit le type, `verdict: "annule"` **avec** `supersedes` est
accepté et retire la décision cible sans rien affirmer (voir « Revenir sur une décision » ci-dessous).
Les lignes `annule` sont exclues de tous les effets de lecture.

**Effet immédiat vs effet au rebuild.** Toute décision est **immédiatement** lisible
(`decisions[]`, `rattachement`, `masquerObsoletes` lisent le journal en direct). En revanche,
la **composition des groupes** et la **confiance** ne changent qu'au prochain **rebuild** du
pipeline, qui consomme vos décisions. Autrement dit : le signal est instantané, la refonte du
regroupement est différée.

- **Doublons** (`doublon_signale` → `_confirme` / `_infirme`). Séquence : votre agent voit un
  groupe `PROBABLE` (ou soupçonne un rapprochement absent) → il poste la décision entre les deux
  `traces[].id`. Immédiat : la décision apparaît dans `decisions[]` des deux groupes concernés.
  Au rebuild : un `_confirme` pousse le pipeline à fusionner, un `_infirme` l'empêche de refusionner.

- **Rattachement PCAET** (`rattachement_pcaet`, `verdict` `confirme`/`infirme`). L'objet B est le
  PCAET, désigné par le **SIREN de son porteur** (`objetBType: "pcaet"`, `objetBId` = 9 chiffres) —
  reprenez le `sirenPorteur` de `plans-territoire` **lorsqu'il est un SIREN** (voir la limite PCAET en §6).
  Immédiat : `GET /projets/mec/{externalId}/plans-territoire` renvoie sur chaque PCAET un champ
  `rattachement` = `confirme` | `infirme` | `aucun`, dérivé de votre décision active la plus récente.

- **Statut de projet** (`projet_statut`, `verdict` `valide`/`obsolete`/`termine`). Immédiat :
  `?masquerObsoletes=true` retire de la liste les groupes dont une trace est `obsolete`. C'est le
  levier « vivant/mort » : il pilote l'affichage sans rien détruire dans les sources.

- **Correction signalée** (`correction_signalee`). L'agent propose une valeur pour un champ :
  `payload = { champ: "budgetPrevisionnel", valeurProposee: "150000", source?: "délibération 2026-03" }`.
  Immédiat : la proposition est journalisée et visible dans `decisions[]`. Au rebuild / en revue :
  elle alimente l'arbitrage sur la donnée de référence. Elle **ne réécrit pas** la source.

### Revenir sur une décision — la révocation `annule`

On ne modifie ni ne supprime. Pour **révoquer** une décision (revenir à « je n'ai rien dit »),
réémettez-la à l'identique avec **`verdict: "annule"`** et **`supersedes`** pointant la décision à
retirer :

```bash
curl -X POST -H "Authorization: Bearer $CLE" -H "Content-Type: application/json" \
  "https://api.collectivites.beta.gouv.fr/decisions" -d '{
    "typeDecision": "doublon_confirme",
    "objetAType": "projet", "objetAId": "019dab94-c75e-7ef8-b7ec-7971a538bdd8",
    "objetBType": "projet", "objetBId": "cop_20687601",
    "verdict": "annule",
    "supersedes": "77b096d7-…"
  }'
# → 201 { "id": "…", "createdAt": "…" }
```

`verdict: "annule"` est valide pour **tous** les types **à la seule condition** que `supersedes` soit
renseigné (sinon 400 : « annule exige supersedes »). Sa sémantique : **retirer la cible sans rien
affirmer**. C'est le SEUL moyen de lever un `doublon_signale/confirme/infirme` (dont le `verdict` est
sinon interdit).

Effets : la décision cible **et** la ligne `annule` elle-même **disparaissent de tous les effets de
lecture** (`decisions[]`, `rattachement`, filtre obsolètes) — une `annule` ne sert qu'à désactiver sa
cible. Une révocation est **contrainte** (400 sinon) : elle doit être de **votre** plateforme (vous ne
révoquez pas la décision d'un autre service) **et du même `typeDecision`** que la cible.

- **Changer d'avis** (p. ex. passer de `confirme` à `infirme`) : postez simplement la nouvelle
  décision. Sur les mêmes objets, en l'absence de `supersedes`, **la plus récente prime**.
- **Une paire de doublon est NON ordonnée** : `(A, B)` et `(B, A)` désignent **la même** paire (le
  pipeline la canonicalise). Pour révoquer, réémettez avec `annule` + `supersedes` plutôt que de
  reposter dans l'ordre inverse — plus lisible et sans ambiguïté dans `decisions[]`.

## 5. Ce qui vous appartient

L'API fournit la mécanique ; l'expérience agent est de votre ressort.

- **Quand proposer.** Sur `confiance: "PROBABLE"`, présentez un rapprochement **suggéré** à
  confirmer ; sur `"CERTAIN"`, présentez un lien **établi** ; sur `null`, ne suggérez rien. Ne
  demandez une décision que quand l'agent a la donnée pour trancher (souvent : après échange avec
  la collectivité).
- **Wording.** Parlez de « même projet » / « projets distincts » (doublons), de « couvert par le
  PCAET » (rattachement), de « projet abandonné / terminé » (statut) — pas de « cluster », pas de
  « verdict », pas d'`id` techniques à l'écran.
- **Rythme.** Une décision suffit ; inutile de la rejouer. Si l'agent hésite, laissez-le ne rien
  poster : l'absence de décision est un état valide (le pipeline garde sa suggestion).
- **Réversibilité.** Offrez un « revenir en arrière » qui réémet avec `supersedes` — l'agent ne
  doit jamais craindre de casser quelque chose de définitif.

## 6. Garanties et limites

Chaque limite est dite ici **avant** que vous ne la rencontriez.

- **`traces[].id` stables et contractuels** — sauf les traces **DGCL** (`role: "financement"`,
  sources `DGCL *`) : une partie de ces `id` changera au prochain recalcul. Ne les persistez pas,
  ne les référencez pas dans une décision.
- **Groupes et `confiance` recalculés à chaque run** : ne persistez jamais la composition d'un
  groupe. C'est la raison pour laquelle aucun identifiant de groupe n'est exposé.
- **Décisions hors du cycle de rebuild** : le journal survit à tous les traitements ; c'est là
  tout son intérêt. Vos `traces[].id` restent la bonne clé d'une exécution à l'autre.
- **Consommation au rebuild, pas à chaud.** Vos décisions sont prises en compte par le pipeline
  **au prochain rebuild**, pas instantanément dans le regroupement. La lecture (`decisions[]`,
  `rattachement`, obsolètes) est, elle, immédiate. La consommation « à chaud » du regroupement
  viendra avec l'**immatriculation** des objets (chantier en cours) ; d'ici là, raisonnez « signal
  immédiat, refonte différée ».
- **PCAET / rattachement** : la table de référence PCAET est **en production**. Le `rattachement`
  s'appuie sur le **SIREN du porteur** (`objetBType: "pcaet"`, `objetBId` = 9 chiffres) : il ne
  fonctionne donc que pour les PCAET dont le porteur est identifié par un vrai SIREN (aujourd'hui les
  fiches `source: "opendata"`). Les fiches `source: "snapshot"` exposent encore un identifiant non-SIREN
  côté `sirenPorteur` — le référentiel PCAET est en cours de normalisation côté pipeline ; d'ici là,
  `rattachement` reste `aucun` pour ces fiches et une décision `rattachement_pcaet` avec un `objetBId`
  non-SIREN est refusée (400). Par ailleurs, si la table de référence était absente, `plans-territoire`
  dégrade proprement en `pcaet: []` (pas d'erreur).
- **Cloisonnement.** `GET /decisions` ne montre que vos décisions. `decisions[]` (vue territoire)
  montre celles de toutes les plateformes **sans l'auteur** — on partage la décision, jamais l'agent.
- **`commentaire` traverse la frontière inter-plateformes.** Le `commentaire` d'une décision est exposé
  dans `decisions[]` à **toutes** les plateformes (contrairement à l'auteur, masqué). N'y mettez **aucune
  donnée personnelle** (nom, e-mail, téléphone d'un porteur) : réservez-le à une justification factuelle.

## 7. FAQ + contact

**Quelle plateforme dois-je mettre dans le corps ?** Aucune : `plateforme_source` est dérivée de
votre clé API.

**Puis-je poster une décision sur une trace DGCL ?** Non recommandé — leurs `id` ne sont pas
stables (voir §6). Attachez la décision à une trace `projet` du groupe.

**Comment annuler une décision de mon agent ?** Réémettez-la avec `verdict: "annule"` et `supersedes`
pointant la décision fautive : la cible **et** la ligne d'annulation sortent de tous les effets de
lecture. La révocation doit être de **votre** plateforme et du **même type** que la cible (400 sinon).

**Je poste `doublon_confirme` mais le groupe ne fusionne pas tout de suite. Normal ?** Oui : le
signal est immédiat (`decisions[]`), la fusion se fait au prochain rebuild (§4, §6).

**Une valeur de `typeDecision` est refusée en 400.** Le vocabulaire est fermé ; utilisez un des six
types du tableau §4. Les anciens libellés libres (`lien_confirme`, `projet_valide`…) ne sont plus acceptés.

**Contact.** Pendant l'été, adressez-vous à **Jean** pour toute question d'intégration ou tout
comportement inattendu.
