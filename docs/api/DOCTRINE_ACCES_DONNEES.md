# Doctrine d'accès aux données — v0

> Statut : **v0, à relire** (Livio, rentrée). Objet : « qui voit quoi » sur l'API Collectivités.
> Le mécanisme est **installé avant la donnée** : pour `/territoires`, le registre des sources
> restreintes est **vide**, aucun accès n'y est filtré. Pour `/consultation/v1` (base consolidée),
> un registre distinct est **actif depuis octobre 2026** (voir « Base consolidée » ci-dessous).

## Pourquoi

L'ouverture DGCL rendra accessibles des dossiers **non financés**, dont la publication est à la
**discrétion des préfets**. Toute donnée n'est pas librement rediffusable : « qui voit quoi »
devient une question de premier ordre. On implémente le contrôle d'accès **maintenant**, à vide,
pour pouvoir affirmer — quand la donnée arrivera — que « le contrôle d'accès est déjà en production ».

## Mécanisme (résumé technique)

- Chaque **source** de projet peut être déclarée restreinte dans un registre applicatif
  (`RESTRICTED_SOURCES` : `source_origine` → **scope** requis). Vide aujourd'hui.
- Chaque **service** appelant peut détenir des **scopes** : colonne `public.services.data_scopes`
  (`text[]`, défaut `{}`).
- À chaque appel de l'endpoint territorial, on résout les scopes du service appelant : un projet
  dont la source est restreinte n'apparaît que si le service porte le scope requis. Le filtrage
  s'applique aux **projets-graines** et aux **membres de cluster** (une source restreinte ne fuit
  pas via un regroupement mixte). **Fail-closed** : sans scope connu, aucune source restreinte n'est
  visible.

## Qui est « service de l'État »

Un service connecté est un partenaire authentifié par **clé API** (en variable d'environnement),
identifié par un `serviceType` : `MEC`, `TeT`, `DashboardTE`, `Recoco`, `UrbanVitaliz`, `SosPonts`,
`FondVert`. L'attribution du statut « service de l'État » habilité à voir une source restreinte est
une **décision d'administration** (pas un acquis technique) : elle se matérialise par l'ajout du
scope correspondant au service (ci-dessous).

## Attribution d'un scope — procédure

Le scope est résolu **par NOM** : `services.name` doit être **égal au `serviceType`** du service
appelant. `public.services` est le **catalogue du widget** (services découvrables), **pas** la couche
d'authentification — d'où deux points d'attention :

1. **Écart constaté (prod, juillet 2026)** : la plupart des partenaires API n'ont **pas** de ligne
   dans `public.services`. Sur les 7 `serviceType`, seul **`UrbanVitaliz`** correspond exactement à
   un `name` du catalogue ; `SosPonts` ≈ « SOS Ponts » (libellé différent) ; `MEC`, `TeT`,
   `DashboardTE`, `Recoco`, `FondVert` sont **absents**. Tant qu'aucune source n'est restreinte,
   c'est sans effet. **Avant** d'exposer de la donnée restreinte, il faudra soit créer/renommer les
   lignes `services` correspondantes (éventuellement `is_listed=false` pour ne pas polluer le widget),
   soit déplacer les scopes vers la couche d'auth. À trancher avec Livio.
2. **Octroi** : pour habiliter un service `X` à une source de scope `s`, ajouter `s` à
   `data_scopes` de la ligne `services` dont `name = 'X'` (via migration ou script d'admin
   versionné — **jamais** de DDL/DML manuel en prod). Déclarer en parallèle la source dans
   `RESTRICTED_SOURCES` (`source_origine` → `s`).

## Journalisation

Chaque appel authentifié est déjà tracé dans `public.api_requests` (`serviceName` = `serviceType`
appelant, `endpoint`, `statusCode`, horodatage). L'accès à une source restreinte est donc **auditable**
a posteriori par service et par endpoint, sans dispositif supplémentaire. (Aucune donnée personnelle
de porteur n'est journalisée à ce niveau.)

## Engagement de non-republication

L'octroi d'un scope vaut **accès en lecture pour l'usage métier du service**, pas droit de
**rediffusion**. Un service habilité s'engage à ne pas republier ni exposer à des tiers les données
d'une source restreinte au-delà de son périmètre d'usage convenu. Cet engagement conditionne
l'octroi et figure dans la convention d'accès du service.

## Base consolidée (`/consultation/v1`)

Même mécanisme, autre table et **registre distinct** : `CONSOLIDATED_RESTRICTED_SOURCES`
(`api/src/security/restricted-sources.ts`), indexé sur `data_projets_consolides.projets_sources.source`.
Distinct de `RESTRICTED_SOURCES` pour ne pas masquer à `/territoires` (TeT) ses propres fiches.

Deux verrous indépendants, tous deux **fail-closed** (sans ligne `services`, aucun scope) :

1. **Niveau d'ouverture.** Par défaut, un appelant ne reçoit que les lignes `ouvert` et
   `public_sans_licence`. Les lignes `interne` (CRTE, Fonds Vert et DGCL internes…) sont réservées aux
   services de l'État porteurs du scope **`interne_etat`** (`CONSOLIDATED_INTERNAL_SCOPE`). Le champ
   `ouverture` reste exposé dans chaque projet comme indication de republication.
2. **Accord du propriétaire de la source** (relation source × destinataire) : registre ci-dessous.

- **Règle anti-fuite** : une ligne est exclue dès qu'elle est `interne` pour un appelant sans
  `interne_etat`, ou qu'**une** de ses traces vient d'une source restreinte pour lui (une ligne fusionnée
  porte des champs de chacune de ses traces). Le filtre s'applique avant le regroupement des doublons et
  la pagination, et à tous les agrégats (`/synthese`, `/collectivites`) : une ligne exclue ne prête à son
  groupe ni comptage, ni provenance, ni financement.
- **Habilitations (13/10/2026)** : `Turgot` porte `interne_etat` (migration `0057_turgot_interne_etat`,
  ligne `services` non listée dans le widget). Aucun autre service ne le porte.
- **Registre V0 (13/10/2026)** :

  | Source                                          | Scope requis              | Statut                  |
  | ----------------------------------------------- | ------------------------- | ----------------------- |
  | `fiches-projets`                                | `tet`                     | TeT : refusé            |
  | `communs-pvd`, `communs-acv`, `villages-avenir` | `anct_contractualisation` | ANCT : à négocier, gelé |
  | `communs-vivier-cop`                            | `cop`                     | COP : gelé              |

  Toute autre source est servie, dans la limite du niveau d'ouverture de l'appelant (CRTE et Fonds Vert
  internes compris pour un porteur d'`interne_etat`). Un accord obtenu se
  traduit par le retrait de la source du registre (tous les appelants) ou par l'octroi du scope à un
  service (procédure ci-dessus).

## Retrait

Le retrait est **immédiat et réversible** : retirer le scope de `data_scopes` de la ligne `services`
concernée suffit à masquer de nouveau la source à ce service dès l'appel suivant (le filtre est
recalculé à chaque requête, aucun cache persistant). Retirer une source de `RESTRICTED_SOURCES` la
rend au contraire visible de tous : à ne faire que sur décision explicite.
