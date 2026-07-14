# Guide des questionnaires, recommandations et ajouts manuels

Pour les personnes qui **éditent le contenu** (partenaires, agents Communs) et pour les
plateformes qui **l'intègrent** (MEC, TET…).

---

## 1. Qu'est-ce qu'un questionnaire

Un questionnaire est proposé à une collectivité **sur un projet donné**, quand ce projet
correspond à ce qu'il traite. Ses réponses déclenchent des **recommandations** — des actions
concrètes, avec leurs financements et leurs ressources.

Il vit **en base**, et s'édite depuis le **back-office**. Les JSON du dépôt
(`api/src/questionnaires/content/`) ne sont plus qu'un **amorçage** (`pnpm seed:questionnaires`),
comme le CSV DINUM l'est pour le catalogue de services.

> **Conséquence à connaître.** Le contenu n'est plus relu en PR. La validation à l'écriture est
> désormais le seul filet — et elle est stricte (§6). Un questionnaire cassé ne peut pas être
> enregistré, mais un questionnaire **médiocre**, si.

---

## 2. Le document, champ par champ

```jsonc
{
  "sourceNom": "AtoutBiodiv",          // le partenaire qui fournit le contenu

  "banniere": {
    "icone": "🌿",                     // facultatif
    "titre": "Optimisez le potentiel biodiversité de votre projet de place ou de centre-bourg",
    "sousTitre": "Désimperméabilisation, végétalisation, corridors — identifiez les actions adaptées"
  },

  "questions": [ /* §3 */ ],
  "recommandations": [ /* §4 */ ],
  "etiquettesRequises": { /* §5 */ }
}
```

**Le titre doit nommer la nature du projet** (« …de votre projet **de place ou de centre-bourg** »).
Une collectivité doit reconnaître son projet dans le bandeau, sinon elle ne comprend pas pourquoi
on le lui propose.

`version` **n'est pas à fournir** : elle s'incrémente à chaque enregistrement. Elle n'invalide
rien — voir §7.

---

## 3. Les questions

```jsonc
{
  "id": "part-estimee-des-espaces-exterieurs",   // stable : les réponses y sont attachées
  "type": "choix-unique",                        // seul type supporté à ce jour
  "intitule": "Quelle part d'espaces extérieurs dans votre projet ?",
  "options": [
    {
      "id": "importante-plus-de-50",             // stable, comme l'id de question
      "libelle": "Importante — plus de 50 %",
      "signal": "favorable",                     // favorable | vigilance | neutre
      "aide": "Comptez les abords, parkings et cheminements.",   // facultatif
      "feedback": {                              // facultatif : réaction immédiate
        "ton": "success",                        // success | warning | info
        "message": "Excellent : c'est là que se joue l'essentiel du gain biodiversité."
      }
    }
  ]
}
```

**Les `id` sont des clés, pas des libellés.** Les réponses des collectivités y sont attachées, et
les conditions des recommandations les citent. Changer un `id`, c'est **détacher les réponses
existantes** — elles ne sont pas détruites, mais elles cessent d'être lues (§7). Changez le
`libelle` autant que vous voulez ; touchez à l'`id` en connaissance de cause.

`signal` et `feedback` sont **de l'affichage** : ils ne décident de rien côté serveur.

---

## 4. Les recommandations, et comment les associer aux réponses

```jsonc
{
  "id": "haies",                       // clé locale ; l'id exposé est « questionnaire:<slug>:haies »
  "icone": "🌳",                       // facultatif
  "titre": "Planter des haies bocagères",
  "description": "Une haie d'essences locales constitue un corridor écologique…",
  "engagement": "faible",              // texte libre : l'effort demandé

  "condition": { "question": "part-estimee-des-espaces-exterieurs",
                 "parmi": ["importante-plus-de-50", "moyenne-20-50"] },

  "financements": [ /* §4.2 */ ],
  "ressources":   [ /* §4.3 */ ]
}
```

### 4.1 La condition — c'est elle qui associe la reco aux réponses

Deux formes, et **deux seulement** :

| Forme | Sens |
|---|---|
| `{ "question": "<id>", "parmi": ["<idOption>", …] }` | sort **si** la collectivité a répondu l'une de ces options |
| `true` | **inconditionnelle** — sort dès que le questionnaire est *entamé* |

Même `true` ne sort **pas** tant que le questionnaire est `non_commence` : une recommandation qui
s'afficherait avant toute réponse n'aurait rien à recommander.

> **Le garde-fou qui vous sauvera.** Une condition qui pointe une question ou une option
> **inexistante** est refusée à l'enregistrement (400), avec le nom du fautif. Sans ce refus,
> l'erreur serait **indétectable** : la recommandation ne s'afficherait simplement jamais, et
> personne ne saurait pourquoi.

**Il n'y a pas de « et », pas de « ou », pas d'imbrication.** Pour une règle composée, écrivez
deux recommandations. C'est délibéré : un mini-langage de conditions serait vite illisible pour
qui édite, et impossible à valider correctement.

### 4.2 Les financements — et l'`aideId` qui rend l'aide **ajoutable**

```jsonc
{
  "icone": "🌿",
  "libelle": "Fonds vert — Renaturation des espaces publics",
  "description": "Financement direct de la désimperméabilisation des places communales.",
  "url": "https://aides-territoires.beta.gouv.fr/aides/…",
  "aideId": 165809                    // ← FACULTATIF, mais c'est LUI qui compte
}
```

**`aideId` est l'identifiant Aides-territoires.** Quand il est présent, MEC peut proposer
**« ajouter cette aide au projet »** en un clic, sans que l'agent ait à la retrouver.

**Ne le mettez que si le financement désigne une aide PRÉCISE.** Beaucoup désignent une *famille*
(« Fonds vert », « DETR ») et leur `url` est une **recherche**, pas une fiche. En inventer un
enverrait une collectivité vers la mauvaise aide.

Trois choses à savoir, et elles comptent :

1. **On ne peut pas vérifier à l'enregistrement qu'un id existe.** Aides-territoires ne sait pas
   récupérer une aide par son identifiant. On ne valide donc que la **forme** (entier positif).
2. **Un id valide peut légitimement échouer à l'ajout.** L'aide doit être disponible sur le
   **territoire du projet** : une aide d'Agence de l'Eau Adour-Garonne renverra un 400 pour une
   commune bretonne. **Ce n'est pas un bug, c'est le territoire.**
3. **Les identifiants pourrissent.** Une aide recréée pour une nouvelle édition (Fonds vert 2025 →
   2026) change d'id. Un `aideId` codé en dur se périmera — vérifiez-le à chaque campagne.

**Comment trouver un `aideId`** : ouvrez la fiche de l'aide sur `aides-territoires.beta.gouv.fr`.
Si l'URL est une recherche (`?text=…`), c'est qu'il n'y a pas d'aide précise : laissez `aideId`
absent.

### 4.3 Les ressources

```jsonc
{
  "icone": "📄",
  "source": "OFB",
  "nom": "Guide de plantation de haies bocagères",
  "description": "Essences locales, densités, entretien.",   // facultatif
  "url": "https://…"
}
```

Purement informatif : aucun effet sur la sélection.

---

## 5. Quand le questionnaire est-il proposé ? — les étiquettes requises

```jsonc
"etiquettesRequises": {
  "thematiques":   [],
  "sites":         ["Place ou centre-bourg"],
  "interventions": []
}
```

**Le projet doit porter TOUTES ces étiquettes**, avec une confiance ≥ **0,80** dans sa
classification. C'est un **critère**, pas un score : la place l'est, ou elle ne l'est pas.

**Toutes**, et non au moins une. Sur le questionnaire « panneaux solaires sur école »
(thématique *Agrivoltaïsme…* **et** lieu *Ecole*), l'école seule attraperait n'importe quel projet
d'école, et le solaire seul n'importe quelle installation photovoltaïque. **C'est la conjonction
qui définit le questionnaire.**

> **Le piège le plus dangereux, et il est contre-intuitif.** Un questionnaire qui n'exige
> **aucune** étiquette serait proposé à **tous les projets de France** — une conjonction vide est
> *vraie*. L'API refuse de l'enregistrer.

Les étiquettes appartiennent à des **taxonomies fermées** (138 thématiques, 59 lieux, 15 modalités). Le back-office ne propose que des valeurs valides : **une coquille y est impossible**.
Par l'API, elle est refusée (400) — parce qu'une étiquette mal orthographiée ferait que le
questionnaire n'est **jamais** proposé, sans le moindre message.

**Restez étroit.** Une version antérieure élargissait chaque questionnaire aux thématiques
connexes (« Végétalisation d'espaces publics »…) : le questionnaire « salle des fêtes » remontait
sur des projets qui n'en étaient pas. **Un questionnaire mal déclenché est pire qu'un
questionnaire absent** — il demande à une collectivité de répondre à des questions qui ne la
concernent pas.

---

## 6. Éditer

**Depuis le back-office** (recommandé) : onglet *Questionnaires*. Les étiquettes se choisissent
dans la taxonomie ; le contenu s'édite en JSON. Les refus de l'API s'affichent en clair.

**Par l'API** :

```
PUT /admin/questionnaires/<slug>        Authorization: Bearer <clé d'administration>
DELETE /admin/questionnaires/<slug>
GET /admin/taxonomies                   → les 138 / 59 / 15 étiquettes valides
```

`PUT`, pas `PATCH` : on envoie **le document entier**. Un `PATCH` champ par champ autoriserait des
états incohérents entre deux appels — une condition enregistrée avant la question qu'elle vise.

**Tout est revalidé avant écriture.** Un écart est un **400 qui nomme le fautif** :

| Refusé | Pourquoi |
|---|---|
| Aucune étiquette requise | serait proposé à **tous** les projets |
| Étiquette hors taxonomie | ne serait **jamais** proposé, sans message |
| Condition sur une question ou une option inexistante | la recommandation ne s'afficherait **jamais** |
| Deux questions, deux options ou deux recos de même `id` | la réponse de la collectivité serait ambiguë |
| Une question sans option | sans réponse possible |

**Supprimer un questionnaire n'efface pas les réponses** : elles cessent d'être lues. Recréé sous
le même slug, il les retrouve.

---

## 7. Ce qui arrive aux réponses quand on édite

**Rien de destructeur.** `version` s'incrémente, mais les réponses déjà données ne sont ni
migrées, ni effacées :

- une réponse à une question **supprimée** est **ignorée à la lecture** ;
- une réponse pointant une option **disparue** est ignorée de même ;
- **toutes les autres survivent.**

La ligne stockée n'est même pas réécrite tant que la collectivité ne repasse pas un `PUT`.

Supprimer une question ne détruit donc pas les autres réponses. **Mais changer un `id` équivaut à
supprimer** : l'ancienne réponse devient orpheline.

---

## 8. Ajouter une aide ou un service à la main

Quand le moteur rate quelque chose qu'un humain sait, on l'attache au projet — avec un **message**
qui dit pourquoi.

### 8.1 Une aide

```
POST /projets/:projetId/aides/ajouts        Authorization: Bearer <clé de plateforme>

{ "aideId": 165809,
  "message": "Recommandée par la DDT lors du COPIL du 12/03",   // facultatif
  "auteur": "j.dupont" }                                        // facultatif
```

**L'aide doit être disponible sur le territoire du projet — sinon 400.** Ce n'est pas une
formalité : une aide n'est persistée **nulle part** (elle est rechargée depuis Aides-territoires à
chaque lecture, filtrée par territoire), et Aides-territoires **ne sait pas** la retrouver par son
id. Une aide hors périmètre produirait donc un ajout que la lecture ne saurait **jamais** résoudre
— invisible, sans le moindre message. On refuse là où on peut encore l'expliquer.

**Il n'existe pas d'aide « hors catalogue ».** Une aide n'existe que dans Aides-territoires : hors
de là, aucune autorité ne la valide.

Si l'aide est **clôturée ou dépubliée** plus tard, elle **cesse simplement de s'afficher**. C'est
voulu : mieux vaut ne rien montrer que d'envoyer une collectivité candidater à une aide morte.

### 8.2 Un service du catalogue

```
POST /projets/:projetId/services/ajouts

{ "slug": "benefriches", "message": "Confirmé en réunion" }
```

Le slug doit exister (**404** sinon). **On ne recopie rien** : sa fiche reste la source de vérité
et continuera d'évoluer (logo, description, lien).

### 8.3 Un service **hors catalogue** — un outil local, un service pas encore benchmarké

```
POST /projets/:projetId/services/ajouts

{ "service": {
    "nom": "Cadastre solaire de la métropole",                    // requis, ≤ 300
    "description": "Estime le potentiel photovoltaïque…",         // requis, ≤ 2000
    "url": "https://cadastre-solaire.exemple.fr",                 // facultatif
    "libelleLien": "Ouvrir le cadastre",                          // facultatif
    "operateur": "Métropole",                                     // facultatif
    "logoUrl": "https://…"                                        // facultatif
  },
  "message": "Outil local, pas au benchmark DINUM" }
```

**Pourquoi c'est possible pour un service et pas pour une aide.** Le catalogue de services est **le
nôtre** : un service qui n'y figure pas **existe quand même**, et personne d'autre que vous ne peut
le décrire — **vous êtes la source**, il n'y a aucune autorité extérieure à tenir en phase.

`slug` **et** `service` ensemble → **400** (lequel afficherait-on ?). Ni l'un ni l'autre → **400**.

Sa classification reste **inconnue** : `categories` et `thematiques` sortent **vides**. On ne les
invente pas, et on ne vous les demande pas — les thématiques ne servent qu'à *sélectionner* un
service, et ici la sélection est déjà faite. **Par vous.**

### 8.4 Retirer

```
DELETE /projets/:projetId/ajouts/:decisionId
```

**Révocation, pas suppression** : le journal est *append-only*. La trace de ce qui a été fait, et
défait, subsiste. Une plateforme ne peut retirer que **ses propres** ajouts (404 sinon).

### 8.5 Ce que la plateforme reçoit

Rien de nouveau à appeler : les ajouts remontent **fondus** dans `GET /aides?projetId=` et
`GET /projets/:id/services`, **en tête**, et **ils échappent au seuil** — quelqu'un les a
délibérément mis là.

```jsonc
"ajoutManuel": {
  "decisionId": "018f2c4a-…",       // à fournir pour retirer
  "message": "Recommandée par la DDT lors du COPIL",
  "plateforme": "MEC",
  "date": "2026-07-14T09:12:33.201Z",
  "horsCatalogue": true             // services seulement, et seulement si vrai
}
```

**Les ajouts sont cloisonnés par plateforme.** Un ajout fait au nom de MEC n'apparaît pas pour TET.
La plateforme est **déduite de la clé d'API**, jamais du corps de requête : un service ne peut pas
se faire passer pour un autre.

Un objet à la fois **retenu par le moteur et ajouté à la main** n'apparaît **qu'une fois**, avec sa
marque. Le dédoublonnage se fait côté API — sinon chaque consommateur devrait le refaire, et
finirait par l'oublier.

---

## 9. Depuis le back-office

Le back-office fait tout ce qui précède, plus la **simulation** : coller l'identifiant d'un projet
réel, et voir **ce que l'API renvoie vraiment** — aides, services, questionnaires, recommandations.
Rien n'y est recalculé : ce sont les mêmes fonctions qui servent MEC.

Il permet aussi d'ajouter une aide ou un service **au nom d'une plateforme** (`POST /admin/ajouts/…`),
puisqu'il porte la clé d'administration et n'est aucune plateforme.

> Le back-office **tourne en local** et vise l'API indiquée par `VITE_API_TARGET` — l'en-tête
> affiche laquelle (`STAGING`, `local`, `⚠ PRODUCTION`). Vérifiez-la avant d'éditer.
