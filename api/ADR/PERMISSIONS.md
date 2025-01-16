## Synchronisation des permissions

### 16 décembre 2024

---

### Contexte

Les communs et les services connectés doivent restés synchronisés. Les changements d'un projet Tet doivent pouvoir être répercutés dans MEC via les Communs et inversement.

Dans ce contexte il faut une mécanique de synchronisation résilient entre les 2 sans que le couplage entre les 2 ne soit rédhibitoire.

Les updates sur les projets semblent assez peu fréquentes / non critiques (on parle de données tels que le status du projet, ou le nom du porteur donc des informations qui changent rarement dans la vie du projet).

### Décision

L'équipe Tet nous a fait part de ses réserves sur le fait de fail les update/create de projets chez eux si LC n'était pas up.

On est arrivé au compromis que Tet ne devrait pas fail si LC fail, mais devrait faire son best effort pour s'assurer que la transaction passe (stratégie retry ou transactional outbox ou autre à la discrétion du service)

Le principal point à ce stade est de se dire que la validation du use case des communs reposent sur l'adoption par les services connectés. Et au stade nous sommes, ce fort couplage semble rédhibitoire.

2 mécaniques sont donc prévues :

- un endpoint d'update / création qui permet au service connecté de faire son best effort pour appliquer la donnée à la BD des communs sans couplage fort.
- un système de webhook pour notifier les autres services connectés lorsque les données sont mises à jour sur les communs

### Alternatives

Réaliser l'update sur la BD des services connectés dans la meme transaction que celle sur les communs. Ce qui revient à coupler les 2 transactions.

Cette solution garantie l'intégrité des données mais les services connectés ne peuvent se permettre d'avoir un couplage si fort au commun. (aka si la transaction fail chez les communs, l'update est en erreur sur le service connecté)

### Partcipants

- Jonathan (MEC)
- Fred (Tet)
- Thibaut (Tet)
- Matt (LC)
- Jean (LC)
