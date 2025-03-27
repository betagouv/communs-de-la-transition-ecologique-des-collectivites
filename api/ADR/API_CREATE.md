## API Create des communs

### 26 mars 2025

---

### Contexte

L'api des communs propose 2 endpoints au niveau des projets :

- un endpoint de création de projet via un POST
- un endpoint d'update de projet via un PATCH

Sur la création d'un projet, Les communs renvoie une erreur 409 si un projet existe deja avec un externalId correspondant à la primaryKey du service l'ayant crée.

Cette logique implique donc que les services connectés doivent savoir si le projet existe ou pas. Ce qui peut créer de la friction/gestion logique supplémentaire quand un service broadcast par un webhook les updates/création (comme dans le cas de Tet)

Dans le cas ou pour une raison inconnue (perte de connexion, crash du service) la création est faite dans les communs maisque le service connecté n'arrive pas à récupérer l'id, on se retrouve dans un cas de conflit à gérer ou il y a une désynchro entre les 2 BD.

### Décision

Afin de rendre cette logique plus simple pour les services connectés, nous avons décidé de rendre la route de création idempotent avec un upsert.
Si le projet existe déjà, on le met à jour, sinon on le crée.

Ca permet de simplifier la logique que les services connectés ont à gérer et par la même occasion de résoudre les cas de désynchro mentionnés ci-haut.

A ce jour la logique de l'update est identique à celle de la création ce qui nous permet de mutualiser les 2.

Pour le moment, nous gardons aussi le endpoint d'update via un PATCH pour les services qui pourraient en avoir besoin.

### Alternatives

Garder la logique de création en renvoyant l'id du projet avec la 409

Le service connecté aurait alors l'id des communs pour le mettre à jour dans leur BD. Mais c'est de la logique en plus côté client.

### Partcipants

- Sylvain (MEC)
- Thibaut (Tet)
- Matt (LC)
