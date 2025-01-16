## Synchronisation des permissions

### 16 décembre 2024

---

### Contexte

Les services connectés gèrent les permissions d’accès à leurs données. Ces permissions sont différentes d'un service à l'autre sur la base de règles qui sont propres aux SC.

Plusieurs niveaux d'intégration des permissions peuvent être envisagés

- hypothèse 1 : Les permissions sont gérées par les services connectés et les communs ne portent pas cette responsabilité.
- hypothèse 2 : Les permissions sont gérées par les servces connectés et ils répercutent ces permissions dans une version simplifiée sur les communs.

### Décision

Le système de partage des permissions tels qu’envisagé dans l'alternative ci-dessous représente un point de complexité avec :

- la synchronisation/centralisation
- le fait que les services connectés doivent pouvoir garder la main sur leur permissions.
- l’implication sur la création de nouveaux users dans les services respectifs.
- Le ratio cout /opportunité d’introduire un tel système dès maintenant ne nous parait pas forcément justifié.

Nous suggérons que dans un premier temps que les permissions soient gérées à même le service connecté et que les communs ne portent pas cette responsabilité.

Les communs feront confiance au service appelant (via API key) qui aura déjà autorisé l’utilisateur via son propre système de permission
Lors de la création d’un projet, les autres services qui importeront / recevront ce projet via webhook associeront les permissions correspondantes dans leur propre référentiel.

### Alternatives

- LC garde une liste d’emails avec 2 niveaux de permissions (voir / éditer)
- Les services annexes sont libres d’implémenter leurs propres règles en plus, et font de leur mieux pour les synchroniser avec LC. Par exemple, si un membre de la DDT accède à un projet sur MEC visa son SIRET, MEC informe LC pour qu’il soit ajouté à la liste.

### Partcipants

- Jonathan (MEC)
- Thibaut (Tet)
- Guillaume (Recoco)
- Matthieu (LC)
