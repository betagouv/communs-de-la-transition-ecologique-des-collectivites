# Présentation du Widget des services

## Contexte

Un des outils développé et maintenu par les Communs est le **widget de présentation des services liés**

Ce widget permet de prendre les informations d'un projet (via notre base de données) et de présenter les services pertinents en fonction du contexte de ce projet.

![widget.png](widget.png)

## Plateformes intégrants le widget

Pour le moment, nous testons le widget sur les plateformes Territoires en transition (sur la vue fiche action) et dans mon espace collectivité sur la vue projet.

## Sélection et présentation des services

Les services présentés sont pour l'instant sélectionnés par l'équipe des communs (pour tester la proposition de valeur). À terme, nous souhaitons que ce soit l'écosystème qui sélectionne et valide les services présentés.

Vous pouvez retrouver la liste complète des services présentés sur [la démo du widget](https://les-communs-transition-ecologique-api-staging.osc-fr1.scalingo.io/sandbox/)

Sur cette démo, tous les services sont présentés peu importe le contexte. Les services sont soient :

- publiés : ces services ont été validés et sont présentés aux utilisateurs
- non publié : ces services ne sont pas encore validés et sont simplement référencés dans la démo pour visualisation

## Logique d'affichage des services

Les services sont choisis sur la base de 3 critères :

- l'avancement du projet (idée / étude / opération)
- les compétences (référentiel M57) ou les leviers de la TE associés.
- A VENIR : l'implantation territoriale du projet. (sur une collectivité ou territoire spécifique).

Nous pouvons fournir la liste des services et les critères associés à la demande.

Pour la suite, nous mettrons à disposition dans la démo qui listent tous les services, les contextes d'affichage pour chaque service afin d'en faciliter la lecture

## Guide pour la présentation du contenu

Principalement nous avons besoin pour une intégration de base de :

- du nom du service (1)
- d'un sous titre (2) (reco : entre 50 et 100 caractères)
- d'une description (3) (tronqué à 400 caractères sur desktop et 200 sur mobile)
- d'une url de redirection + un label pour le CTA (optionnel si CTA par défaut) (4)
- un logo (5)

![contenu-service.png](contenu-service.png)

Voici la liste complète des services que nous avons integré à date : https://les-communs-transition-ecologique-api-staging.osc-fr1.scalingo.io/sandbox/

## Intégration des services

Il y a plusieurs niveaux d’intégration possible dans le widget, par example :

- **une intégration simple** : un simple lient vers une page spécifique du service recensé (par exemple pour les communautés d’Expertise Territoire)
- **une intégration iframe** : un service recensé met à disposition un iframe qui s'affiche en fonction des paramètres de projet qu’on lui passe dans l’url (exemple Facilitact, Bénéfriche)
- **une intégration custom** : des scénarios d’intégration plus poussés comme par exemple amener directement l’utilisateur dans son projet contextualisé sur la plateforme (par exemple avec Recoco, un utilisateur pourrait être créé à la volée ainsi que son projet)

## Intégration technique

Pour l'intégration iframe (quand le widget présente directement un iframe dévéloppé par le service), voici quelques points importants :

## Support iframe

Nous affichons des iframes à partir des contextes projets des plateformes sur lesquelles est installé le widget.

![widget-iframe.png](widget-iframe.png)

Nous pouvons passer un certain nombre de query params à l'iframe depuis les infos que nous avons en base, notamment :

- code insee pour commune
- code siren pour epci
- type de collectivité (pour le moment : commune ou epci)
- nom de la collectivité
- thématique associé au projet
- leviers de la TE associé au projet
- description du projet

### Iframe resizer

Pour garantir une expérience optimale pour l'utilisateur. (notamment au niveau du resize) Il convient d'importer ce package sur les pages de l'iframe :

https://iframe-resizer.com/setup/child/

### Restrictions de sécurité (CSP)

Pour des raisons de sécurité, certains services ont des restrictions CSP (Content Security Policy).

Seuls les domaines autorisés peuvent intégrer l'iframe. Il convient alors d'ajouter les urls qui affiche le widget. Voici un récapitulatif des urls à jour sur lesquelles le widget est présent :

**environnements staging**

localhost (pour nos tests)

- https://preprod-app.territoiresentransitions.fr
- https://staging-app.territoiresentransitions.fr (donc territoiresentransitions pour le domaine)
- https://mon-espace-collectivite-staging.osc-fr1.scalingo.io (pas de custom domain ici)

**environnements prod**

- https://monespacecollectivite.anct.gouv.fr
- https://app.territoiresentransitions.fr

A l'inverse si les plateformes hôtes du widget ont des CSP, elles doivent autoriser les domaines suivant pour que les iframe s'affichent correctement :

- https://benefriches-staging.osc-fr1.scalingo.io/
- https://facili-tacct.incubateur.ademe.dev/
- https://lvao.ademe.fr/
- https://quefairedemesdechets.ademe.fr/
