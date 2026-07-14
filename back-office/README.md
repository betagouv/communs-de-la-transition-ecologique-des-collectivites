# Back-office

Outil interne de **lecture et de simulation** pour les questionnaires, les recommandations et les
services numériques. Il n'écrit rien.

## Ce qu'il est, et ce qu'il n'est pas

C'est un **test**. Il est conçu pour être jeté.

- **Aucune dépendance de l'API vers ce dossier.** Rien dans `api/` ne l'importe, ne le construit,
  ne le sert. `rm -rf back-office/` + retirer la ligne du `pnpm-workspace.yaml` : l'API repart à
  l'identique. C'est la contrainte qui a dicté tout le reste.
- **Pas de CORS ouvert côté API.** Le serveur de dev Vite relaie `/api/*` vers l'API (voir
  `vite.config.ts`). Le navigateur ne voit qu'une origine, il n'y a donc rien à autoriser côté
  serveur — et donc rien à défaire.
- **Les types sont recopiés**, pas importés (`src/types.ts`). C'est le prix assumé de
  l'indépendance : un fichier à tenir à jour, contre zéro couplage à démêler.

Côté API, la surface est le module `api/src/admin/` — lui aussi additif et supprimable (`rm -rf
src/admin` plus **une** ligne dans `app.module.ts`).

Ces endpoints sont **volontairement absents du document OpenAPI** : celui-ci est le contrat servi
aux plateformes partenaires, et y publier l'admin ferait traverser la frontière à ce qu'on garde
de notre côté (conditions, classifications d'éligibilité, curation). C'est aussi pourquoi
`src/types.ts` est recopié à la main : sans schéma publié, il n'y a rien à générer.

## Lancer

L'API doit tourner. Puis :

```bash
cp .env.template .env    # ajuster VITE_API_TARGET si l'API n'est pas sur :3000
pnpm --filter @les-communs/back-office dev
```

La **clé d'administration** (`SERVICE_MANAGEMENT_API_KEY`) est demandée à l'ouverture. Elle vit en
`sessionStorage` et disparaît avec l'onglet : elle n'est ni dans un `.env`, ni dans le bundle, ni
dans le dépôt.

## Pourquoi un curseur de seuil

`/admin/simuler` renvoie **tous** les candidats avec leur score, jamais seulement les retenus.
Rejouer la sélection à un autre seuil est donc de l'arithmétique côté navigateur, sans rappel
réseau : on voit l'effet d'un réglage **avant** de le figer dans le code.

`motifAuSeuil()` dans `src/types.ts` doit rester la copie exacte de `motifDe()` dans
`api/src/admin/admin.service.ts`. Si les deux divergent, l'écran ment sur ce que ferait la vraie
API — ce qui est pire que pas d'écran du tout.

## Simuler sur un projet réel, jamais fictif

L'écran demande l'**id d'un projet existant**. Un projet composé à la main dit ce qu'on veut
entendre : il porte une classification trop propre et trop riche, et les scores qu'il produit sont
flatteurs. C'est précisément ce piège qui a produit un faux diagnostic sur le seuil des services.
