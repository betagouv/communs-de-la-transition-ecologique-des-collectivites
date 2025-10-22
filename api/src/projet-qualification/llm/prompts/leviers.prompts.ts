/**
 * Leviers prompts and data - extracted from Python implementation
 * DO NOT modify prompt text - must match Python version exactly
 */

/**
 * System prompt for leviers classification
 */
export const SYSTEM_PROMPT_CLASSIFICATION_TE = `
Vous êtes un expert chargé d'analyser la description d'un projet afin de déterminer sa relation avec les enjeux de la transition écologique. Votre tâche se déroule en plusieurs étapes, en suivant les directives ci-dessous de manière rigoureuse. Il vous faut suffisamment d'éléments pour prendre vos décisions. Vous êtes réfléchi, pragmatique, minutieux et vous évitez de juger prématurément un projet mal défini.

Étape 1 : Classification du Projet

Classez le projet dans l'une des trois catégories suivantes (en utilisant exactement les formulations) :
	1.	« Le projet n'a pas de lien avec la transition écologique »
Il y a assez d'éléments dans la description du projet pour affirmer qu'il n'a pas d'impact positif sur a minima un des axes suivants : l'atténuation du changement climatique, l'adaptation au changement climatique, la biodiversité, la préservation des ressources, l'économie circulaire, la réduction des déchets, la réduction des pollutions.
	2.	« Le projet n'est pas assez précis pour être lié ou non à la transition écologique »
Il n'y a pas assez d'éléments dans la description du projet pour affirmer qu'il n'a pas d'impact positif sur a minima un des axes suivants : l'atténuation du changement climatique, l'adaptation au changement climatique, la biodiversité, la préservation des ressources, l'économie circulaire, la réduction des déchets, la réduction des pollutions.
	3. « Le projet a un lien avec la transition écologique»
Il y a assez d'éléments dans la description du projet pour affirmer qu'il a un impact positif sur a minima un des axes suivants : l'atténuation du changement climatique, l'adaptation au changement climatique, la biodiversité, la préservation des ressources, l'économie circulaire, la réduction des déchets, la réduction des pollutions.

Etape 2 : Associations de leviers selon une liste établie.
Associer des leviers, si c'est pertinent, à la description du projet
- Il est possible qu'un projet soit lié à la transition écologique sans correspondre à aucun levier de la liste fournie.
- Un projet peut ne pas être en lien direct avec la transition écologique, ou sa description peut être insuffisamment précise pour le déterminer, mais des leviers pertinents peuvent tout de même y être associés.
- les leviers possibles sont au nombre de 72, la liste complète des leviers sera donnée par la suite.

Pour chaque levier associé, attribuer un score compris entre 0 et 1, reflétant la pertinence du levier par rapport au projet selon les critères suivants :
	•	0.9 - 1.0 : Le levier est hautement pertinent et directement lié aux actions ou impacts principaux du projet.
	•	0.7 - 0.8 : Le levier est pertinent et a un lien important avec le projet.
	•	0.5 - 0.6 : Le levier est modérément pertinent, avec un lien indirect ou partiel.
	•	0.3 - 0.4 : Le levier a une pertinence faible, avec un lien mineur.
	•	0.1 - 0.2 : Le levier est très faiblement pertinent.

Etape 3 : Fournir le raisonnement qui a amené à explication vos choix, en expliquant :
•	Pourquoi vous avez classé le projet e cette manière.
•	Les explications qui vous ont amené à associer des leviers et leur classement, s'il y en a.
Le raisonnement doit être inclus entre des balises <raisonnement> </raisonnement>

Etape 4 : Vous devez retourner un JSON valide avec les champs suivants :
	•	"projet" : La description du projet.
	•	"classification" : Une des trois options mentionnées ci-dessus.
	•	"leviers" : Une liste de paires {"nom du levier": score}, classés par ordre décroissant de score. Ce champ peut être vide si aucun levier n'est pertinent.
Le json doit être inclus entre des balises <json> </json>
`;

/**
 * User prompt for leviers classification
 */
export const USER_PROMPT_CLASSIFICATION_TE = `
Liste des leviers  :
<leviers>
	1.	Gestion des forêts et produits bois : Gestion durable des forêts pour améliorer leur santé et promouvoir l'utilisation du bois comme matériau écologique.
	2.	Changements de pratiques de fertilisation azotée : Adoption de méthodes agricoles réduisant l'utilisation d'engrais azotés pour diminuer les émissions de gaz à effet de serre.
	3.	Élevage durable : Mise en place de pratiques d'élevage respectueuses de l'environnement pour réduire l'impact sur le climat et la biodiversité.
	4.	Gestion des haies : Conservation et plantation de haies pour protéger la biodiversité et améliorer les écosystèmes agricoles.
	5.	Bâtiments & Machines agricoles : Modernisation des infrastructures et équipements agricoles pour augmenter l'efficacité énergétique et réduire les émissions.
	6.	Gestion des prairies : Pratiques de gestion des prairies visant à maintenir la biodiversité et à stocker du carbone dans les sols.
	7.	Pratiques stockantes : Techniques agricoles qui augmentent le stockage de carbone dans les sols, contribuant à la lutte contre le changement climatique.
	8.	Sobriété foncière : Concept visant à limiter l'artificialisation des sols, c'est-à-dire la transformation d'espaces naturels en zones urbaines ou industrielles.
	9.	Surface en aire protégée : Augmentation de la superficie des zones protégées pour préserver la biodiversité et les écosystèmes sensibles.
	10.	Résorption des points noirs prioritaires de continuité écologique : Élimination des obstacles majeurs qui empêchent la libre circulation des espèces dans les écosystèmes.
	11.	Restauration des habitats naturels : Actions visant à réhabiliter les écosystèmes dégradés pour favoriser la biodiversité.
	12.	Réduction de l'usage des produits phytosanitaires : Diminution de l'utilisation de pesticides et herbicides pour protéger la santé humaine et l'environnement.
	13.	Développement de l'agriculture biologique et de HVE : Promotion de l'agriculture biologique et de la Haute Valeur Environnementale pour des pratiques agricoles plus durables.
	14.	Respect d'Egalim pour la restauration collective : Mise en œuvre de la loi Egalim pour favoriser une alimentation saine et durable dans les cantines et restaurants collectifs.
	15.	Sobriété des bâtiments (résidentiel) : Réduction de la consommation d'énergie dans les bâtiments résidentiels par des comportements sobres.
	16.	Changement chaudières fioul + rénovation (résidentiel) : Remplacement des chaudières au fioul par des systèmes plus propres et rénovation énergétique des logements.
	17.	Changement chaudières gaz + rénovation (résidentiel) : Remplacement des chaudières au gaz par des systèmes plus efficaces et rénovation énergétique des logements.
	18.	Rénovation (hors changement chaudières) : Travaux d'amélioration énergétique des bâtiments sans changer les chaudières, comme l'isolation.
	19.	Sobriété des bâtiments (tertiaire) : Réduction de la consommation d'énergie dans les bâtiments du secteur tertiaire par des pratiques sobres.
	20.	Changement chaudières fioul + rénovation (tertiaire) : Remplacement des chaudières au fioul dans le tertiaire et rénovation pour améliorer l'efficacité énergétique.
	21.	Changement chaudières gaz + rénovation (tertiaire) : Remplacement des chaudières au gaz dans le tertiaire et rénovation pour réduire la consommation énergétique.
	22.	Gaz fluorés résidentiel : Réduction de l'utilisation des gaz fluorés dans les équipements résidentiels, car ils ont un fort potentiel de réchauffement climatique.
	23.	Gaz fluorés tertiaire : Réduction de l'utilisation des gaz fluorés dans les équipements du secteur tertiaire.
	24.	Captage de méthane dans les ISDND : Récupération du méthane émis par les Installations de Stockage de Déchets Non Dangereux pour limiter les émissions de gaz à effet de serre.
	25.	Prévention des déchets : Réduction de la production de déchets à la source par des comportements sobres.
	26.	Valorisation matière des déchets : Recyclage et réutilisation des déchets pour en faire de nouvelles ressources.
	27.	Moindre stockage en décharge : Réduction du volume des déchets mis en décharges.
	28.	Augmentation du taux de collecte : Amélioration des systèmes de collecte et de tri pour augmenter le recyclage.
	29.	Sobriété dans l'utilisation de la ressource en eau : Réduction de la consommation d'eau par des usages plus économes.
	30.	Protection des zones de captage d'eau : Mesures pour préserver les zones où l'eau est prélevée pour l'alimentation en eau potable.
	31.	Désimperméabilisation des sols : Réduction des surfaces imperméables pour favoriser l'infiltration de l'eau dans les sols.
	32.	Électricité renouvelable : Développement de la production d'électricité à partir de sources renouvelables comme le solaire et l'éolien.
	33.	Biogaz : Production de gaz renouvelable à partir de matières organiques pour remplacer le gaz fossile.
	34.	Réseaux de chaleur décarbonés : Utilisation de sources d'énergie renouvelable ou de récupération pour alimenter les réseaux de chauffage urbain.
	35.	Top 50 sites industriels : Actions ciblées sur les 50 sites industriels les plus émetteurs pour réduire significativement les émissions.
	36.	Industrie diffuse : Réduction des émissions provenant de l'ensemble des activités industrielles moins concentrées.
	37.	Fret décarboné et multimodalité : Promotion de modes de transport de marchandises moins polluants et combinant différents modes (train, bateau, etc.).
	38.	Efficacité et sobriété logistique : Optimisation des flux logistiques pour réduire la consommation d'énergie et les émissions.
	39.	Réduction des déplacements : Diminution de la nécessité de se déplacer, par exemple via le télétravail ou la relocalisation des services.
	40.	Covoiturage : Partage de véhicules entre plusieurs personnes pour réduire le nombre de voitures sur la route.
	41.	Vélo : Promotion de l'usage du vélo pour les déplacements quotidiens.
	42.	Transports en commun : Développement et amélioration des services de transport public pour encourager leur utilisation.
	43.	Véhicules électriques : Transition vers les véhicules électriques pour réduire les émissions du transport routier.
	44.	Efficacité énergétique des véhicules privés : Amélioration de la consommation de carburant des véhicules pour réduire les émissions.
	45.	Bus et cars décarbonés : Remplacement des bus et cars par des modèles à faibles émissions ou électriques.
	46.	2 roues (élec & efficacité) : Promotion des deux-roues électriques ou plus économes en énergie.
	47.	Nucléaire : Maintien ou développement de l'énergie nucléaire pour une production d'électricité bas-carbone.
	48.	Bio-carburants : Utilisation de carburants issus de la biomasse pour remplacer les carburants fossiles.
	49.	Efficacité des aéronefs : Amélioration de l'efficacité énergétique des avions pour réduire les émissions du secteur aérien.
	50.	SAF : Utilisation de carburants d'aviation durables (Sustainable Aviation Fuel) pour réduire l'impact environnemental des vols.
    51.	Confort thermique des transports collectifs et des mobilités actives : Actions visant à améliorer le confort thermique des usagers des transports en commun et des mobilités actives pour favoriser leur usage.
    52.	Réduction de la vulnérabilité des infrastructures et services de transport : Mesures pour protéger et adapter les infrastructures de transport face aux aléas climatiques.
    53.	Intégration du confort d'été dans la rénovation et la construction des bâtiments : Prise en compte des performances estivales (rafraîchissement passif, isolation adaptée) lors de la conception et rénovation des bâtiments.
    54.	Réseaux de froid : Développement et résilience des infrastructures de froid (stockage, transport d'aliments, médical) face aux besoins énergétiques et climatiques.
    55.	Réduction de la vulnérabilité du système énergétique au changement climatique : Actions pour sécuriser et adapter la production, le transport et la distribution d'énergie face aux impacts climatiques.
    56.	Adaptation des filières et des exploitations agricoles : Mesures pour adapter les pratiques agricoles et les filières aux nouvelles conditions climatiques.
    57.	Performance des services publics de l'eau potable et de l'assainissement : Amélioration de la qualité, de la continuité et de la résilience des services d'eau potable et d'assainissement.
    58.	Prévention des éboulements et glissement de terrain : Mesures de prévention et protection contre les mouvements de terrain et l'érosion.
    59.	Prévention des inondations par débordement de cours d'eau, notamment via restauration des milieux aquatiques : Actions visant à réduire les risques d'inondation liés aux cours d'eau, incluant la restauration écologique.
    60.	Prévention des inondations par ruissellement : Mesures de gestion des eaux de ruissellement urbain et rural pour limiter les inondations.
    61.	Renaturation des villes et réduction de l'effet d'îlot de chaleur urbain : Actions de renaturation urbaine pour atténuer les îlots de chaleur et améliorer la qualité de vie.
    62.	Conditionnement du développement urbain et économique à la ressource en eau : Intégration de la disponibilité et de la pérennité de la ressource en eau dans les décisions d'aménagement et d'économie.
    63.	Renforcement de la résilience des services de santé : Mesures pour garantir le fonctionnement et l'accessibilité des services de santé en cas de crises climatiques.
    64.	Préparation des services de secours : Renforcement de la capacité opérationnelle et logistique des services de secours face aux événements climatiques extrêmes.
    65.	Résilience des services de communication : Garantir la continuité des réseaux et services de communication essentiels lors d'aléas.
    66.	Protection et mise à l'abri des personnes vulnérables : Actions ciblées pour protéger et abriter les populations vulnérables lors d'événements extrêmes.
    67.	Evolution de l'offre touristique de montagne : Adaptation des activités et infrastructures touristiques de montagne aux changements climatiques.
    68.	Evolution de l'offre touristique littorale : Adaptation des activités et infrastructures touristiques littorales aux enjeux comme l'érosion et l'élévation du niveau de la mer.
    69.	Continuité des activités économiques : Mesures pour maintenir l'activité économique locale face aux perturbations climatiques.
    70.	Prévention des dégâts causés par le retrait-gonflement des argiles : Actions de prévention et adaptation des constructions et infrastructures aux mouvements des sols argileux.
    71.	Intégration de l'élévation du niveau des mers dans l'aménagement du littoral : Prise en compte de la montée du niveau marin dans les politiques d'aménagement et de protection du littoral.
    72.	Préservation des sites culturels et patrimoniaux : Mesures pour protéger les biens culturels et patrimoniaux des risques climatiques et environnementaux.
</leviers>

Liste des acronymes :
<acronymes>
	1.	HVE : Haute Valeur Environnementale
	2.	Egalim : Loi visant à améliorer les relations commerciales agricoles et promouvoir une alimentation saine et durable
	3.	ISDND : Installations de Stockage de Déchets Non Dangereux
	4.	SAF : Sustainable Aviation Fuel (carburant d'aviation durable)
</acronymes>


<exemples>

<exemple_1>

<projet>  Création d'une salle de convivialité au complexe sportif Passais Village" </projet
<raisonnement>
Le projet concerne la construction d'une installation sportive sans lien significatif avec la transition écologique ni avec les leviers disponibles.
</raisonnement>
<json>
{ "projet": "Création d'une salle de convivialité au complexe sportif Passais Village", "classification": "Le projet n'a pas de lien avec la transition écologique", "leviers": { "Sobriété des bâtiments (tertiaire)": 0.3}}
 </json>
</exemple_1>

<exemple_2>

<projet> Aménagement du SAS de la mairie et désimperméabilisation des extérieurs </projet>
<raisonnement>
Ce projet peut être classé comme ayant un lien avec la transition écologique pour plusieurs raisons :

1. La désimperméabilisation des extérieurs est explicitement mentionnée, ce qui est une action directe en faveur de la transition écologique. Cette action permet :
- Une meilleure infiltration des eaux pluviales
- Une réduction des îlots de chaleur
- Une amélioration de la biodiversité urbaine
- Une meilleure résilience face aux événements climatiques extrêmes

2. Pour les leviers associés :
- "Désimperméabilisation des sols" est le levier le plus pertinent (score 1.0) car il correspond exactement à une partie du projet
- "Sobriété dans l'utilisation de la ressource en eau" est également pertinent (score 0.7) car la désimperméabilisation contribue à une meilleure gestion des eaux pluviales
- "Sobriété foncière" est modérément pertinent (score 0.5) car le projet s'inscrit dans une logique d'amélioration de l'existant plutôt que d'extension

La partie "aménagement du SAS" n'est pas assez précise pour déterminer son impact environnemental, mais la composante de désimperméabilisation suffit à classifier ce projet comme ayant un lien avec la transition écologique.
</raisonnement>
<json>
{
    "projet": "Aménagement du SAS de la mairie et désimperméabilisation des extérieurs",
    "classification": "Le projet a un lien avec la transition écologique",
    "leviers": {
        "Désimperméabilisation des sols": 1.0,
        "Sobriété dans l'utilisation de la ressource en eau": 0.7,
        "Sobriété foncière": 0.5
    }
}
</json>
</exemple_2>

—
<exemple_3>

<projet> Rénovation de l'éclairage public à Juvigny sous Andaine et Sept Forges </projet>
<raisonnement>
La rénovation de l'éclairage public est un projet qui a un lien direct avec la transition écologique pour plusieurs raisons :

1. L'amélioration de l'efficacité énergétique : La rénovation de l'éclairage public implique généralement le remplacement des anciennes installations énergivores par des technologies plus efficaces (comme les LED), ce qui contribue directement à la réduction de la consommation d'énergie.
2. La réduction des émissions de gaz à effet de serre : En diminuant la consommation d'électricité, le projet contribue à l'atténuation du changement climatique.
Concernant les leviers, bien que ce projet soit clairement lié à la transition écologique, il ne correspond pas parfaitement aux leviers listés.
</raisonnement>

<json>
{
    "projet": "Rénovation de l'éclairage public à Juvigny sous Andaine et Sept Forges",
    "classification": "Le projet a un lien avec la transition écologique",
    "leviers": {
    }
}
</json>
</exemple_3>

<exemple_4>
<projet>Extension du bois de Cormelles le Royal et des liaisons douces – CORMELLES LE ROYAL </projet>
<raisonnement>
Ce projet semble avoir deux composantes distinctes :
1. L'extension du bois de Cormelles le Royal : Cela suggère un projet d'agrandissement d'une zone boisée, ce qui contribue directement à la transition écologique via la préservation de la biodiversité et le stockage de carbone.
2. Les liaisons douces : Ce terme fait référence aux voies de circulation dédiées aux modes de déplacement non motorisés (vélos, piétons), favorisant ainsi la mobilité durable.

Le projet a donc clairement un lien avec la transition écologique car il combine :
- L'extension d'un espace naturel boisé (impact positif sur la biodiversité et le stockage carbone)
- Le développement de mobilités douces (réduction des émissions de GES liées au transport)

Les leviers associés sont :
- "Gestion des forêts et produits bois" (0.9) : L'extension d'un bois est directement liée à ce levier
- "Vélo" (0.8) : Les liaisons douces incluent typiquement des pistes cyclables
- "Réduction des déplacements" (0.6) : Les liaisons douces peuvent encourager indirectement la réduction de l'usage de la voiture
- "Surface en aire protégée" (0.5) : L'extension du bois peut contribuer à augmenter les espaces naturels protégés, mais nous n'avons pas la certitude du statut de protection
</raisonnement>

<json>
{
    "projet": "Extension du bois de Cormelles le Royal et des liaisons douces – CORMELLES LE ROYAL",
    "classification": "Le projet a un lien avec la transition écologique",
    "leviers": {
        "Gestion des forêts et produits bois": 0.9,
        "Vélo": 0.8,
        "Réduction des déplacements": 0.6,
        "Surface en aire protégée": 0.5
    }
}
</json>
</exemple_4>

<exemple_5>
<projet>Chaufferie collective et réseau de chaleur urbain – VERSON / CLM </projet>
<raisonnement>
Ce projet concerne la mise en place d'une chaufferie collective et d'un réseau de chaleur urbain à Verson. Bien que la description soit succincte, la nature même du projet permet de le classifier comme ayant un lien avec la transition écologique pour plusieurs raisons :

1. Les réseaux de chaleur urbains permettent généralement une meilleure efficacité énergétique que des solutions individuelles.
2. Ces installations peuvent être alimentées par des énergies renouvelables ou de récupération, contribuant à la décarbonation du chauffage.

Les leviers associés sont :
- "Réseaux de chaleur décarbonés" avec un score de 1.0 car c'est exactement l'objet du projet
- "Changement chaudières gaz + rénovation (résidentiel)" avec un score de 0.6 car le projet peut impliquer le remplacement de chaudières individuelles
- "Changement chaudières fioul + rénovation (résidentiel)" avec un score de 0.6 pour la même raison
</raisonnement>

<json>
{
    "projet": "Chaufferie collective et réseau de chaleur urbain – VERSON / CLM",
    "classification": "Le projet a un lien avec la transition écologique",
    "leviers": {
        "Réseaux de chaleur décarbonés": 1.0,
        "Changement chaudières gaz + rénovation (résidentiel)": 0.6,
        "Changement chaudières fioul + rénovation (résidentiel)": 0.6
    }
}
</json>
</exemple_5>

<exemple_6>
<projet>Revitalisation du centre bourg Saint Mars d'Egrenne </projet>
<raisonnement>
La description du projet "Revitalisation du centre bourg Saint Mars d'Egrenne" est trop vague pour déterminer avec certitude son lien avec la transition écologique. La revitalisation d'un centre-bourg peut englober de nombreux aspects différents :
- Rénovation de bâtiments
- Aménagements urbains
- Développement de commerces et services
- Création d'espaces publics
- Mobilité
- etc.

Sans plus de détails sur la nature exacte des actions prévues, il n'est pas possible d'affirmer si le projet aura un impact positif sur la transition écologique.

Cependant, certains leviers peuvent être potentiellement pertinents pour ce type de projet de revitalisation, avec des scores modérés reflétant l'incertitude :
- Sobriété foncière (0.6) : La revitalisation des centres-bourgs contribue généralement à limiter l'étalement urbain
- Rénovation (0.5) : La rénovation de bâtiments est souvent une composante de la revitalisation
- Réduction des déplacements (0.4) : Le renforcement des centres-bourgs peut réduire les besoins en déplacements

Ces associations sont faites avec prudence étant donné le manque d'information sur le contenu exact du projet.
</raisonnement>

<json>
{
    "projet": "Revitalisation du centre bourg Saint Mars d'Egrenne",
    "classification": "Le projet n'est pas assez précis pour être lié ou non à la transition écologique",
    "leviers": {
        "Sobriété foncière": 0.6,
        "Rénovation (hors changement chaudières)": 0.5,
        "Réduction des déplacements": 0.4
    }
}
</json>
</exemple_6>

<exemple_7>

<projet> Travaux d'assainissement des eaux usées </projet>
<raisonnement>
Ce projet de travaux d'assainissement des eaux usées a un lien direct avec la transition écologique pour plusieurs raisons :

1. Il contribue à la préservation des ressources en eau et à la réduction des pollutions en traitant les eaux usées avant leur rejet dans l'environnement.

2. Il participe à la protection des écosystèmes aquatiques et de la biodiversité en limitant la contamination des milieux naturels.

Concernant les leviers, bien que ce projet soit clairement lié à la transition écologique, il ne correspond pas parfaitement aux leviers listés.

</raisonnement>

<json>
{
    "projet": "Travaux d'assainissement des eaux usées",
    "classification": "Le projet a un lien avec la transition écologique",
    "leviers": {
    }
}
</json>
</exemple_7>

<exemple_8>
<projet> Aménagement du parking de la salle communale (Ceaucé) </projet>
<raisonnement>
La description du projet "Aménagement du parking de la salle communale" est trop succincte pour déterminer avec certitude son impact sur la transition écologique. En effet, l'aménagement d'un parking peut prendre différentes formes :

1. Il pourrait s'agir d'une simple imperméabilisation du sol avec de l'enrobé, ce qui aurait un impact négatif
2. Il pourrait inclure des solutions vertueuses comme :
- Des revêtements perméables
- L'intégration de végétation
- La gestion des eaux pluviales
- L'installation de bornes de recharge électrique
- L'aménagement d'espaces pour les vélos

Sans plus de détails sur la nature exacte des aménagements prévus, il n'est pas possible de déterminer si le projet aura un impact positif sur la transition écologique.

Cependant, certains leviers peuvent être potentiellement pertinents, avec des scores faibles reflétant l'incertitude :
- Désimperméabilisation des sols (0.3) : Le projet pourrait intégrer des solutions perméables, mais ce n'est pas certain
- Véhicules électriques (0.2) : Le parking pourrait inclure des bornes de recharge, mais ce n'est pas précisé
</raisonnement>

<json>
{
    "projet": "Aménagement du parking de la salle communale (Ceaucé)",
    "classification": "Le projet n'est pas assez précis pour être lié ou non à la transition écologique",
    "leviers": {
        "Désimperméabilisation des sols": 0.3,
        "Véhicules électriques": 0.2
    }
}
</json>
</exemple_8>

</exemples>


Vous devez retourner un JSON valide avec les champs suivants entre les balises <json> et </json> :
	•	"projet" : La description du projet.
	•	"classification" : Une des trois options mentionnées
         -Le projet n'a pas de lien avec la transition écologique
         -Le projet n'est pas assez précis pour être lié ou non à la transition écologique
         - Le projet a un lien avec la transition écologique
	•	"leviers" : Une liste de paires {"nom du levier": score}, classés par ordre décroissant de score. Les scores doivent être attribués selon les critères de pertinence définis, et le classement doit refléter ces scores. Ce champ peut être vide si aucun levier n'est pertinent. Les leviers associés doivent OBLIGATOIREMENT appartenir à la liste définie ci-desssus.

Votre réponse doit TOUJOURS doit être divisée en 2 parties définies par les balises <raisonnement> </raisonnement> et <json> </json>
`;

// Re-export Levier type from shared constants
export { leviers as LEVIERS_LIST } from "@/shared/const/leviers";
export type { Levier } from "@/shared/types";
