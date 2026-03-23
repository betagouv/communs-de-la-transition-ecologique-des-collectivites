# Doc de passation

## Contexte / Intro :

Pour une overview générale rapide de ce qu’est Les communs, 3 ressources pertinentes :

- [slides du comité d’investissement de juin 2025](https://docs.google.com/presentation/d/1WFPPXCrX-OJswVqj3dFu_2OlhYHjX2Lnidyl4wXok-8/edit?slide=id.g33d28688783_0_1490#slide=id.g33d28688783_0_1490) qui retracent l’histoire et la roadmap à venir des Communs
- [doc readme du repo](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/blob/main/README.md) qui dispatche ensuite vers les docs utiles
- [fiche produit beta gouv](https://beta.gouv.fr/startups/communs-de-la-transition-ecologique-des-collectivites.html)


## Onboarding technique

Le monorepo est accessible ici : https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/tree/main

Plusieurs briques principales détaillées ci-dessous dans le schema et reprises dans la doc du repo

![image.png](archi-macro.png)

Pour la stack, c’est assez classique :

- **api :** node / nest / drizzle (orm) / postrges
- **widget** : app react bundlé via vite
- **pages annexes demo et statistique**s : app react / vite servi par le server Nest (plutot que d’avoir des apps scalingo standalone)

### **Widget Grist :**

### **How to :**

<details>
<summary>Connect to the DB and switch env</summary>  
With the DB on scalingo it is not reachable from the internet and you need to use a tunnel.

1. connect through SSH to [scalingo console](https://doc.scalingo.com/platform/cli/start)
2. open a tunnel

   ```bash
   #DATABASE_URL is not a variable it needs to stay as is
   scalingo --app les-communs-transition-ecologique-api-staging db-tunnel DATABASE_URL
   ``

3. modifier l’url de la BD dans vos .env pour se connecter à l’IP du tunnel ()

    ````bash
    # this is not the url you need to use, it is an example, you need to take the url from scalingo and replace the part after
    # the @ to match the tunnel IP
    # sslmode=no-verify at the end my be needed depending on your sql ui client. It is needed for drizzle studio 
    DATABASE_URL="postgres://les_communs_204:password@127.0.0.1:10000/les_communs_204?sslmode=no-verify"
    ```

In the script in package.json, based on the `NODE_ENV` var, it will take either the `.env.production` or the `.env.staging` or the `.env.development` as a fallback
</details>


<details>
<summary>Import service</summary>  

  Le widget affiche les services qui matchent le contexte d’un projet. Donc il nous faut des services 🙂 A terme il y aura une interface admin ou les services rentreront eux-même leur données. Pour le moment on a fait ca avec Jean via un [gsheet](https://docs.google.com/spreadsheets/d/1Vmcq_s_799Bj8QP56Q3BzajHtZsk78Z8Lhg4gtmwGrg/edit?gid=33371786#gid=33371786). Il y a 2 onglets à exporter dans des fichiers csv différents.

  Ces fichiers sont référencés sous : `services-context-import.csv` et `services-import.csv`

  Il faut donc :

1. les exporter du ghseet quand il ya des mises à jours et les overrider dans le projet
2. lancer le script `seed:services:dev`  en choissisant le bon environnement via `NODE_ENV` (ne pas oublier le tunnel si pas en local)
</details>


<details>
<summary>Import collectivites</summary>  

Les collectivités sont un maillon essentiel dans les infos d’un projet. On s’appuie sur geo api pour avoir cette donnée en base de manière intègre.

Nous avons un script qui permet d’importer les (surtout utile quand on wipe la base de donnée en locale si besoin) `seed:communes-and-epci:dev` A changer NODE_ENV en fonction de l’env targetté

Le script est censé être résilient sur les updates annuelles (certaines infos peuvent changer d’une année à l’autre)

</details>

<details>
<summary>Run e2e test locally (for api)</summary>  

Les tests e2e de l’api ont besoin de python pour s’executer. (nous avons un script python pour gérer l’appel au LLM Anthropic) Il faut donc avoir python d’installer dans son env de travail. Personelement j’utilisais [un environnement virtuel](https://www.w3schools.com/python/python_virtualenv.asp).  Le fait d’utiliser du python est de la dette technique car nous avons importé directement le code que Louis avait produit dans ces analyses de data. Il conviendrait de changer ce bout de code pour du typescript surtout que les SDK node/Typescript des différents LLM sont tous dispos
</details>

<details>
<summary>Publish a new widget version package to npm</summary>  

Simplement suivre la [procédure documentée dans le readme du widget](widget/README.md#publishing)
</details>

### **Liens utiles :**

- [repo](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/tree/main)
- [backlog github](https://github.com/orgs/betagouv/projects/129/views/1)
- [swagger prod](https://api.collectivites.beta.gouv.fr/api)
- [swagger staging](https://les-communs-transition-ecologique-api-staging.osc-fr1.scalingo.io/api)
- [vaultWarden](https://doc.incubateur.net/communaute/les-outils-de-la-communaute/autres-services/vaultwarden) : c’est le lien vers la doc, il faut que Denis t’invite sur le vaultWarden pour l’administrer et y avoir accès. On l’utilise principalement pour partager de manière sécure les clefs api des services tiers
- [matomo dev/staging](https://stats.beta.gouv.fr/index.php?module=CoreHome&action=index&idSite=201&period=day&date=yesterday#?period=day&date=2025-05-26&idSite=201&category=Dashboard_Dashboard&subcategory=1) et [matomo prod](https://stats.beta.gouv.fr/index.php?module=CoreHome&action=index&idSite=217&period=day&date=yesterday#?period=day&date=2025-05-26&idSite=217&category=Dashboard_Dashboard&subcategory=1) (on a aussi un site ID pour le widget grist)
- [scalingo dev](https://dashboard.scalingo.com/apps/osc-fr1/les-communs-transition-ecologique-api-staging) et [scalingo prod](https://dashboard.scalingo.com/apps/osc-fr1/les-communs-transition-ecologique-api-prod)
- [dashboard redis](https://api.collectivites.beta.gouv.fr/queues/queue/project-qualification?status=active)  pour les jobs LLM ad
- [lien vers la demo du widget](https://les-communs-transition-ecologique-api-staging.osc-fr1.scalingo.io/sandbox/)
- [page statistique](https://les-communs-transition-ecologique-api-staging.osc-fr1.scalingo.io/statistics/)

### **Accès à demander:**
Il faut demander à Denis B. (CTO Beta.gouv) les accès à : 
- Scalingo (les liens ci-dessus)
- Matomo (les sites Id ci-dessus)
- Vaultwarden (pour qu'il donne les accès au vault les communs)
- accès github au repo et au board
- orga npm betagouv pour le package du widget

Il faut demander à Jean les accès à :
- les pages pertinentes de son notion 
- les présentations 


### Roadmap technique (wip)

Voir les tickets techniques : https://github.com/orgs/betagouv/projects/129/views/1?filterQuery=task-type%3A%22Technical+Task%22


### Utilisation LLM 

Nous utilisons les LLM pour classifier les projets et leur assigner des leviers et des compétences en fonction de leur description. 

Un gros travail de documentation et d'analyse a été fait par Louis (notre ancien data analyste) Ce travail est disponible sur [le notion de Jean](https://www.notion.so/13ebde078be0805e9669ee108021b8b4?v=65885a228f6142eab388eb91d41fc188) 

### Suivi intégration service

Nous intégrons les services au fur et à mesure pour qu'ils soient présents dans le widget. Un travail de recencesement a été fait.  

La liste est disponible ici (Notion de Jean) : https://www.notion.so/10dbde078be080b89a7aeb14caa9a952?v=fffbde078be081649899000ce0132ace&source=copy_link

Pour le moment nous avons contacté principalement les P1 pour les intégrations avancées en iframe. Sur les intégrations simples (juste du contenu et un lien) nous avons pris la liberté de faire le premier jet.

Un deuxième doc existe ou je fais le suivi de l'intégration technique pour les services avec iframe : https://docs.google.com/spreadsheets/d/1YkBWNYhoo9KpUg8OIkdbfenXkFMjxHYW89qDnIGAe0c/edit?gid=0#gid=0

L'intégration des services est aussi matérialisé dans le backlog dans une colonne spécifique ou je mettais à jour l'avancement. Mais je ne trouve pas le format adéquat (le backlog ne se prete pas à un suivi qui représente l'avancement d'une tache qui a plusieurs stades d'avancement)

Je conseille de faire le suivi global dans le gsheet et de créer des taches adhoc dans le backlog pour matérialiser le travail sur une tache spécifique

### Divers

**Plusieurs canaux ou se faire inviter sur mattermost :**
- notifs sentry : https://mattermost.incubateur.net/betagouv/channels/startup-communs-te-tech-notifs-public-sentry
- channel de l'équipe des communs : https://mattermost.incubateur.net/betagouv/channels/communs-de-la-transition-ecologique-des-collectivites
- channel des discussions TET x MEC (un peu doublon avec celui ci-dessous) :  https://mattermost.incubateur.net/betagouv/channels/tet-x-mec
- channel de discussion avec toutes les plateformes : https://mattermost.incubateur.net/betagouv/channels/tmp-communs-collaborations

Reste à faire dans la doc :

- [ ]  Changer la clef API pour Anthropic
- [ ]  refaire un tour de roue sur les services avec lesquels j’ai discuté pour laisser des instructions claires de ou on en est.


