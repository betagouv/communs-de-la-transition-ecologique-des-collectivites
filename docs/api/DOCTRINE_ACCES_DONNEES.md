# Doctrine d'accès aux données — v0

> Statut : **v0, à relire** (Livio, rentrée). Objet : « qui voit quoi » sur l'API Collectivités.
> Le mécanisme est **installé avant la donnée** : aucune donnée restreinte n'est en base
> aujourd'hui, le registre des sources restreintes est **vide**, aucun accès n'est donc filtré.

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

## Retrait

Le retrait est **immédiat et réversible** : retirer le scope de `data_scopes` de la ligne `services`
concernée suffit à masquer de nouveau la source à ce service dès l'appel suivant (le filtre est
recalculé à chaque requête, aucun cache persistant). Retirer une source de `RESTRICTED_SOURCES` la
rend au contraire visible de tous : à ne faire que sur décision explicite.
