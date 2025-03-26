# Import python's built-in regular expression library
import re
import anthropic
from dotenv import load_dotenv
import os
import argparse
import json
import sys
import base64
import copy


# System-Prompt, User-Prompt & few-shot examples
system_prompt_aides = """
Vous êtes un expert dont le but est, à partir de la description d’une aide (destinée à des collectivités pour mener à bien leurs projets) et d’une liste de projets référents :
	•	D’évaluer tous les projets référents fournis et d’associer à l'aide les plus pertinents (entre 0 et maximum 10)
	•	Pour chaque projet associé, attribuer un score compris entre 0 et 1, reflétant la pertinence du projet par rapport à l'aide selon les critères suivants :
	•	0.9 - 1.0 : le projet est hautement pertinent et directement lié aux actions ou impacts principaux de l'aide.
	•	0.7 - 0.8 : le projet est pertinent et a un lien important avec l'aide.
	•	0.5 - 0.6 : le projet est modérément pertinent, avec un lien indirect ou partiel.
	•	0.3 - 0.4 : le projet a une pertinence faible, avec un lien mineur.
	•	0.1 - 0.2 :  le projet est très faiblement pertinent.

Vous devez retourner un JSON valide avec les champs suivants :
	•	“aide” : l'intitulé de l'aide
	•	“projets” : Une liste de dictionnaires {"projet": "Nom du projet référent", "score": valeur}, classés par ordre décroissant de score. Au maximum 10 projet peuvent être associés. Ce champ peut être une liste vide si aucun projet n’est pertinent pour l'aide analysée. 

<projets-référents>
{
  "Mobilité": [
    "Développer les infrastructures de covoiturage",
    "Inciter financièrement le covoiturage",
    "Accompagner le déploiement des zones à faibles émissions",
    "Création d’une voie douce / piste cyclable",
    "Installation de bornes électriques",
    "Acquisition de véhicule décarboné"
  ],
  "Voirie/Ouvrage d’art": [
    "Installation de ralentisseur",
    "Réfection/aménagement de la voirie",
    "Installation de miroir de circulation de sécurité routière",
    "Entretien des ponts"
  ],
  "Biodiversité": [
    "Entretien / restauration des haies",
    "Restauration écologique / continuité écologique",
    "Création de jardins partagés"
  ],
  "Rénovation énergétique": [
    "Mise en place d’un réseau de chaleur",
    "Construction d’un éclairage public",
    "Installation de panneaux photovoltaïques/panneaux solaires sur les toits et façades des bâtiments publics",
    "Isolation du bâtiment",
    "Changement des fenêtres/portes d’un bâtiment public"
  ],
  "Commerce": [
    "Mise en place d’un commerce de proximité",
    "Mise en place d’un café / bistrot"
  ],
  "Equipement sportif": [
    "Construction d’un gymnase",
    "Rénovation du gymnase",
    "Création d’un terrain de football",
    "Création d’un city park / city stade / terrain multisports",
    "Construction d'une piscine",
    "Aménagement d’une aire de jeux"
  ],
  "Eclairage Public": [
    "Rénovation de l’éclairage public"
  ],
  "Ecole": [
    "Construction d’une cantine scolaire",
    "Déployer les équipements numériques",
    "Réaménagement de la cantine scolaire / Acquisition de mobiliers et matériels pour les cantines",
    "Cour d’école : végétaliser, désimperméabiliser, jeux, voiles ombrages",
    "Construction d’une école",
    "Rénovation énergétique école"
  ],
  "Bâtiment public": [
    "Mise en place de l’accessibilité dans les bâtiments publics",
    "Création de logements sociaux",
    "Création d’une bibliothèque municipale",
    "Création d’une crèche"
  ],
  "Eau": [
    "Rénover le réseau d’assainissement",
    "Gestion des inondations"
  ],
  "Lieux de culte": [
    "Végétalisation du cimetière",
    "Restauration du patrimoine religieux"
  ],
  "Santé": [
    "Mise en place de la télémedecine",
    "Création d’une maison de santé"
  ],
  "Protection civile": [
    "Mise en place d’un système de vidéo-protection",
    "Installation de bornes et poteaux incendies dans le cadre de la défense extérieure contre l’incendie (DECI)"
  ],
  "Foncier": [
    "Acquisition d'une parcelle"
  ]
}
</projets-référents>

"""

examples_prompt_aides = "<examples>\n<example>\n<aide>\nintitulé de l'aide : Maintenir les jeunes sur le territoire\ndescription : Les études démographiques montrent une tendance au vieillissement du territoire, une stagnation de l'arrivée de nouveaux habitants et des naissances. Pour autant, notre territoire compte de nombreuses familles grâce à son positionnement géographique, sa disponibilité foncière et son attractivité en terme d'accès aux services. Face à l'exode des jeunes, il s'agit de renforcer le cadre de vie des enfants et des jeunes, afin qu'ils restent ou reviennent sur le territoire. Cette mobilisation autour des jeunes pourra impacter plusieurs secteurs de leur vie sociale, avec une priorité marquée sur la formation et les conditions d'accès à l'emploi.\n• Accès aux activités de loisirs\n• Information et prévention en matière de santé\n• Accès aux services et information sur les politiques publiques en faveur de la jeunesse\n• Accès à la formation et à l'information sur le monde de l'entreprise et l'emploi\n• Développement de la mobilité des jeunes\n• Ouverture aux initiatives et créations d'opportunités (junior entreprise...)\nexemples de projets : • Création de lieux ou d'activités de loisirs pour les jeunes\n• Organisation d'événements fédérateurs\n• Campagne d'information sur la santé, la nutrition, les conduites addictives...\n• Sensibilisation aux réalités économiques du territoire\n• Parrainage et accompagnement d'initiatives portées par des jeunes\n</aide>\n<ideal_output>\n<json>\n{\n    \"aide\": \"Maintenir les jeunes sur le territoire\",\n    \"projets\": [\n        {\n            \"projet\": \"Création d'un city park / city stade / terrain multisports\",\n            \"score\": 0.9\n        },\n        {\n            \"projet\": \"Construction d'un gymnase\",\n            \"score\": 0.8\n        },\n        {\n            \"projet\": \"Rénovation du gymnase\",\n            \"score\": 0.8\n        },\n        {\n            \"projet\": \"Création d'un terrain de football\",\n            \"score\": 0.8\n        },\n        {\n            \"projet\": \"Construction d'une piscine\",\n            \"score\": 0.8\n        },\n        {\n            \"projet\": \"Déployer les équipements numériques\",\n            \"score\": 0.7\n        },\n        {\n            \"projet\": \"Création d'une bibliothèque municipale\",\n            \"score\": 0.7\n        },\n        {\n            \"projet\": \"Aménagement d'une aire de jeux\",\n            \"score\": 0.7\n        },\n        {\n            \"projet\": \"Création de logements sociaux\",\n            \"score\": 0.6\n        },\n        {\n            \"projet\": \"Création d'une voie douce / piste cyclable\",\n            \"score\": 0.6\n        }\n    ]\n}\n</json>\n</ideal_output>\n</example>\n<example>\n<aide>\nintitulé de l'aide : Acheter et porter du foncier pour le compte des collectivités (19)\ndescription : L'établissement public foncier de Nouvelle - Aquitaine (EPFNA) est un opérateur public de l'État au service des collectivités pour accompagner leurs projets de développement territorial. Expert de la question foncière, il met à disposition son ingénierie et ses outils d'intervention pour prendre en charge le volet foncier des opérations d'aménagement. L'EPFNA est régi par le décret n° 2008 - 645 en date du 30 juin 2008, modifié par le décret n° 2017 - 837 du 5 mai 2017. Il est au service des territoires de 10 départements de Nouvelle - Aquitaine : la Charente, la Charente - Maritime, la Creuse, la Corrèze, la Dordogne, les Deux - Sèvres, la Gironde, la Haute - Vienne, la Vienne et le Lot - et - Garonne (hormis les communes de l'agglomération d'Agen). Son intervention permet de mobiliser du foncier, bâti ou non, pour la réalisation des projets de collectivités, conformément à l'article 321 - 1 du Code de l'urbanisme, dans l'objectif de :\n• favoriser l'accès au logement, en soutenant particulièrement la production de logement social\n• redynamiser les centralités urbaines, maintenir l'emploi dans les territoires dans un objectif de cohésion des territoires\n• reconvertir les friches (artisanales, industrielles, résidentielles, ...)\n• prévenir les risques naturels ou technologiques Son champ de compétence opérationnelle concerne :\n• la recherche d'informations nécessaires à la parfaite connaissance des caractéristiques foncières du site, et la réalisation d'études de capacité ou de pré - faisabilité,\n• l'acquisition, par le biais d'une négociation amiable, d'une préemption ou en ayant recours à l'expropriation,\n• la gestion : il assure la bonne gestion du bien et peut faire réaliser les travaux de démolition ou de dépollution nécessaires.\n• la cession à opérateur : si le bien n'a pas vocation à être racheté par la collectivité l'EPFNA accompagne celle - ci dans la recherche d'un acquéreur (bailleur social, opérateur immobilier, ...) et dans le montage de l'opération de manière à permettre sa revente rapide. Il dispose d'une bonne connaissance des opérateurs immobiliers actifs dans le territoire. En amont il peut appuyer la collectivité dans la définition d'une stratégie d'intervention foncière sur la base d'une étude ou d'un gisement foncier ( 👉 voir fiche « stratégie foncière ») En secteur rural, l'EPFNA a développé des outils spécifiques comme le démembrement de propriété pour favoriser la sortie opérationnelle des projets. L'action de l'EPFNA se déploie en complémentarité et en proximité avec celle des autres acteurs locaux de l'ingénierie. Pour bénéficier de l'accompagnement de l'EPFNA, la collectivité doit prendre contact avec la direction territoriale. Après échanges et validation de l'opportunité d'intervention, l'EPFNA propose la signature d'une convention d'étude ou de veille, qui précise le projet de la collectivité, les fonciers nécessaires à la réalisation de ce projet, le montant maximum et la durée de la mobilisation de l'EPFNA.\n</aide>\n<ideal_output>\n<json>\n{\n    \"aide\": \"Acheter et porter du foncier pour le compte des collectivités (19)\",\n    \"projets\": [\n        {\n            \"projet\": \"Acquisition d'une parcelle\",\n            \"score\": 1.0\n        },\n        {\n            \"projet\": \"Création de logements sociaux\",\n            \"score\": 0.9\n        },\n        {\n            \"projet\": \"Mise en place d'un commerce de proximité\",\n            \"score\": 0.8\n        },\n        {\n            \"projet\": \"Mise en place d'un café / bistrot\",\n            \"score\": 0.8\n        },\n        {\n            \"projet\": \"Création d'une maison de santé\",\n            \"score\": 0.7\n        },\n        {\n            \"projet\": \"Création d'une bibliothèque municipale\",\n            \"score\": 0.7\n        },\n        {\n            \"projet\": \"Création d'une crèche\",\n            \"score\": 0.7\n        },\n        {\n            \"projet\": \"Construction d'une école\",\n            \"score\": 0.7\n        },\n        {\n            \"projet\": \"Construction d'un gymnase\",\n            \"score\": 0.5\n        },\n        {\n            \"projet\": \"Construction d'une cantine scolaire\",\n            \"score\": 0.5\n        }\n    ]\n}\n</json>\n</ideal_output>\n</example>\n<example>\n<aide>\nintitulé de l'aide : Financer des projets qui favorisent le partage des richesses culturelles et la vie locale\ndescription : L’objectif du programme LEADER sur le territoire Garrigues et Costières de Nîmes est de soutenir l’offre culturelle locale (dont le patrimoine), les services aux habitants pour favoriser le bien vivre ensemble dans les villages. Il vise également à trouver des solutions de mobilité durables qui permettent aux habitants d’accéder aux opportunités proches de chez eux. Enfin, il vise à renforcer le lien social, à favoriser la mixité, l’entraide et la solidarité.En résumé, il vise à soutenir des projets qui permettent de : - Sauvegarder et transmettre les patrimoines matériels et immatériels - Créer une offre culturelle locale favorisant les échanges - Renforcer le lien social et les actions en faveur de la jeunesse - Développer les services aux habitants - Favoriser les mobilités alternatives au service du lien social ou de la vie localeLe programme LEADER permet aux porteurs de projets, dont le projet correspond aux critères de la stratégie du territoire, d’être accompagné par l’équipe technique sur le montage de leur projet (plan de financement, recherche de partenariats, etc.), et de déposer une demande d’aide financière auprès de l’Union Européenne.Le taux maximum d’aide publique (LEADER + autre cofinancement public) est de 80%, et le minimum d’autofinancement (fonds propres ou financements privés) est de 20%, dans la limite de 90 000 €. \nexemples de projets : - Restauration de patrimoine permettant de créer du lien social, recueil de récits et valorisation, etc.‐ Création artistique sur le territoire, etc.‐ Activités intergénérationnelles, tiers - lieu culturel, etc.‐ Bibliothèque itinérante, activités inter - villages, etc.‐ Rosalies, installations de racks à vélo et bornes de réparation, autopartage, navette mutualisée, etc.\n</aide>\n<ideal_output>\n<json>\n{\n    \"aide\": \"Financer des projets qui favorisent le partage des richesses culturelles et la vie locale\",\n    \"projets\": [\n        {\n            \"projet\": \"Création d'une bibliothèque municipale\",\n            \"score\": 1.0\n        },\n        {\n            \"projet\": \"Restauration du patrimoine religieux\",\n            \"score\": 0.9\n        },\n        {\n            \"projet\": \"Création d'une voie douce / piste cyclable\",\n            \"score\": 0.9\n        },\n        {\n            \"projet\": \"Création de jardins partagés\",\n            \"score\": 0.8\n        },\n        {\n            \"projet\": \"Création d'un city park / city stade / terrain multisports\",\n            \"score\": 0.8\n        },\n        {\n            \"projet\": \"Aménagement d'une aire de jeux\",\n            \"score\": 0.7\n        },\n        {\n            \"projet\": \"Mise en place d'un café / bistrot\",\n            \"score\": 0.7\n        },\n        {\n            \"projet\": \"Installation de bornes électriques\",\n            \"score\": 0.6\n        },\n        {\n            \"projet\": \"Mise en place d'un commerce de proximité\",\n            \"score\": 0.6\n        },\n        {\n            \"projet\": \"Déployer les équipements numériques\",\n            \"score\": 0.5\n        }\n    ]\n}\n</json>\n</ideal_output>\n</example>\n<example>\n<aide>\nintitulé de l'aide : Faciliter l’accès aux crédits bancaires en apportant, en partenariat avec Bpifrance, une garantie jusqu’à 70% (35% Région, 35% Bpifrance)\ndescription : Qu'il s'agisse d'innover, d'exporter, de s'adapter aux évolutions du marché, toutes ces composantes de la vie de l'entreprise comportent un volet financier. La question du financement est une priorité pour la Région avec un objectif transversal : faire effet de levier sur les financements privés, notamment bancaires. Pour qui ? Ces garanties bénéficient à l'ensemble des PME (répondant à la définition européenne de la PME). Sont toutefois exclues : les activités d'intermédiation financière, les activités de promotion et de locations immobilières (sauf immobilier lié à un projet de développement d'une entreprise), les activités agricoles réalisant moins de 750 000 € de chiffres d'affaires. Pour quels projets ? Le Fonds Pays de la Loire Garantie peut être mobilisé dans le cadre des opérations suivantes :\n• de création d'entreprise ;\n• de transmission d'entreprise ;\n• pour l'acquisition et le développement de nouveaux équipements ;\n• pour le développement à l'international des entreprises ;\n• pour le renforcement de la structure financière et de la trésorerie des entreprises ;\n• pour soutenir les entreprises innovantes. \n</aide>\n<ideal_output>\n<json>\n{\n    \"aide\": \"Faciliter l'accès aux crédits bancaires en apportant, en partenariat avec Bpifrance, une garantie jusqu'à 70% (35% Région, 35% Bpifrance)\",\n    \"projets\": [\n        {\n            \"projet\": \"Mise en place d'un commerce de proximité\",\n            \"score\": 0.8\n        },\n        {\n            \"projet\": \"Mise en place d'un café / bistrot\",\n            \"score\": 0.9\n        },\n        {\n            \"projet\": \"Création d'une maison de santé\",\n            \"score\": 0.6\n        },\n        {\n            \"projet\": \"Acquisition d'une parcelle\",\n            \"score\": 0.5\n        },\n        {\n            \"projet\": \"Mise en place de la télémedecine\",\n            \"score\": 0.5\n        },\n        {\n            \"projet\": \"Mise en place d'un système de vidéo-protection\",\n            \"score\": 0.4\n        },\n        {\n            \"projet\": \"Acquisition de véhicule décarboné\",\n            \"score\": 0.3\n        }\n    ]\n}\n</json>\n</ideal_output>\n</example>\n<example>\n<aide>\nintitulé de l'aide : Moderniser son commerce\ndescription : Objectif\n• Faciliter l'implantation et l'ancrage des activités commerciales et artisanales dans les centres - villes et villages du territoire, en accompagnant les entreprises dans leurs efforts de développement et de modernisation. \nexemples de projets : 55 boutiques dans tout le territoire dont: traiteur Bach, restaurants Gaia, l'Estaminet et le Glacier, D - Cycles, Corentin Coiffure, garage LV Auto, Agence Tops Immo, Institut Bulle de Bien - ëtre, etc.\n</aide>\n<ideal_output>\n<json>\n{\n    \"aide\": \"Moderniser son commerce\",\n    \"projets\": [\n        {\n            \"projet\": \"Mise en place d'un commerce de proximité\",\n            \"score\": 1.0\n        },\n        {\n            \"projet\": \"Mise en place d'un café / bistrot\",\n            \"score\": 0.9\n        },\n        {\n            \"projet\": \"Réfection/aménagement de la voirie\",\n            \"score\": 0.4\n        },\n        {\n            \"projet\": \"Mise en place de l'accessibilité dans les bâtiments publics\",\n            \"score\": 0.4\n        },\n        {\n            \"projet\": \"Rénovation de l'éclairage public\",\n            \"score\": 0.3\n        }\n    ]\n}\n</json>\n</ideal_output>\n</example>\n<example>\n<aide>\nintitulé de l'aide :  Récompenser les chercheurs hommes résidant de manière permanente dans un État membre de l'UE ou un pays associé au programme Horizon Europe\ndescription :  Horizon Europe - 2021 - 2027\n• Budget total de l’appel : 15 000 € par prix (quatre Prix de Leadership Scientifique)Objectif Récompenser les chercheurs hommes résidant de manière permanente dans un État membre de l'UE ou un pays associé au programme Horizon Europe. TOPIC : Ouvert\n• HORIZON - JU - EDCTP3 - 2025 - SciLeadershipManEUPrize: Prix de Leadership Scientifique pour un homme résident d'un État membre de l'UE ou d'un pays associé au programme Horizon Europe Informations complémentaires\n• Lignes directrices : Cliquez ici\n• Autres documents de l’appel (EN) : Cliquez ici\n• Site web de la DG ou de l’Agence exécutive : Cliquez ici\n• Plus d’informations : Cliquez ici\n</aide>\n<ideal_output>\n<json>\n{\n    \"aide\": \"Récompenser les chercheurs hommes résidant de manière permanente dans un État membre de l'UE ou un pays associé au programme Horizon Europe\",\n    \"projets\": []\n}\n</json>\n</ideal_output>\n</example>\n</examples>\n\n"


user_prompt_aides = """
Vous devez retourner un JSON valide avec les champs suivants :
	•	“aide” : L'intitulé de l'aide.
	•	“projets” : Une liste de dictionnaires {"projet": "Intitulé de l'action","score": valeur}, classés par ordre décroissant de score. Les scores doivent être attribués selon les critères de pertinence définis, et le classement doit refléter ces scores. Ce champ peut être vide si aucune action n’est pertinente. Au maximum 10 projets peuvent être présents.

Avant de sélectionner les actions pertinentes, vous devez évaluer tous les projets de la liste fournie pour déterminer leur pertinence par rapport à l'aide et raisonner de manière réfléchie et précise.

Votre réponse doit TOUJOURS être un JSON valide sans autre commentaire, de la forme suivante : 
<json>
{
    "aide": "intitulé de l'aide",
    "projets": [
        {
            "projet": "Intitulé du projet référent",
            "score": float (entre 0 et 1)
        },
        ...
    ]
</json>

<exemple>
<json>
{
    "aide": "Soutenir financièrement les commerces et services du quotidien présents dans les centres-bourgs",
    "projets": [
        {
            "projet": "Mise en place d'un commerce de proximité",
            "score": 1.0
        },
        {
            "projet": "Mise en place d'un café / bistrot",
            "score": 0.9
        },
        {
            "projet": "Création d'une maison de santé",
            "score": 0.6
        },
        {
            "projet": "Mise en place de la télémedecine",
            "score": 0.4
        }
    ]
}
</json>
</exemple>

"""


# List of valid projects references (used for post-treatment)
project_references_dict ={
  "Mobilité": [
    "Développer les infrastructures de covoiturage",
    "Inciter financièrement le covoiturage",
    "Accompagner le déploiement des zones à faibles émissions",
    "Création d’une voie douce / piste cyclable",
    "Installation de bornes électriques",
    "Acquisition de véhicule décarboné"
  ],
  "Voirie/Ouvrage d’art": [
    "Installation de ralentisseur",
    "Réfection/aménagement de la voirie",
    "Installation de miroir de circulation de sécurité routière",
    "Entretien des ponts"
  ],
  "Biodiversité": [
    "Entretien / restauration des haies",
    "Restauration écologique / continuité écologique",
    "Création de jardins partagés"
  ],
  "Rénovation énergétique": [
    "Mise en place d’un réseau de chaleur",
    "Construction d’un éclairage public",
    "Installation de panneaux photovoltaïques/panneaux solaires sur les toits et façades des bâtiments publics",
    "Isolation du bâtiment",
    "Changement des fenêtres/portes d’un bâtiment public"
  ],
  "Commerce": [
    "Mise en place d’un commerce de proximité",
    "Mise en place d’un café / bistrot"
  ],
  "Equipement sportif": [
    "Construction d’un gymnase",
    "Rénovation du gymnase",
    "Création d’un terrain de football",
    "Création d’un city park / city stade / terrain multisports",
    "Construction d'une piscine",
    "Aménagement d’une aire de jeux"
  ],
  "Eclairage Public": [
    "Rénovation de l’éclairage public"
  ],
  "Ecole": [
    "Construction d’une cantine scolaire",
    "Déployer les équipements numériques",
    "Réaménagement de la cantine scolaire / Acquisition de mobiliers et matériels pour les cantines",
    "Cour d’école : végétaliser, désimperméabiliser, jeux, voiles ombrages",
    "Construction d’une école",
    "Rénovation énergétique école"
  ],
  "Bâtiment public": [
    "Mise en place de l’accessibilité dans les bâtiments publics",
    "Création de logements sociaux",
    "Création d’une bibliothèque municipale",
    "Création d’une crèche"
  ],
  "Eau": [
    "Rénover le réseau d’assainissement",
    "Gestion des inondations"
  ],
  "Lieux de culte": [
    "Végétalisation du cimetière",
    "Restauration du patrimoine religieux"
  ],
  "Santé": [
    "Mise en place de la télémedecine",
    "Création d’une maison de santé"
  ],
  "Protection civile": [
    "Mise en place d’un système de vidéo-protection",
    "Installation de bornes et poteaux incendies dans le cadre de la défense extérieure contre l’incendie (DECI)"
  ],
  "Foncier": [
    "Acquisition d'une parcelle"
  ]
}

# strict list of valid_projects_references
valid_projects_references = []
for category_values in project_references_dict.values():
    if isinstance(category_values, list):
        valid_projects_references.extend(category_values)
    else:
        valid_projects_references.append(category_values)


from copy import deepcopy
def post_treatment_projects(json_data, valid_projects):

    data = deepcopy(json_data)
    
    processed_projects = []
    for project in data['projets']:
        name = project['projet']
        # Based on exact strings found in AT API for projects references, these two have straight  ' and the other curled ’
        valid_name = (name if name in ["Acquisition d'une parcelle","Construction d'une piscine"] else 
                      name.replace("'", "’") if name.replace("'", "’") in valid_projects_references
                      else None)
        if valid_name:
            project['projet'] = valid_name
            processed_projects.append(project)
    
    data['projets'] = sorted(processed_projects, key=lambda x: x['score'], reverse=True)
    
    return data



load_dotenv()
API_KEY = os.getenv("ANTHROPIC_API_KEY")

client = anthropic.Anthropic(api_key=API_KEY)


def categorization_projects(nom_aide: str, description_aide=None, exemples_projets=None, system_prompt=system_prompt_aides, user_prompt=user_prompt_aides, examples_prompt = examples_prompt_aides):
    """
    Matches an aid with relevant project references and assigns relevance scores.

    Args:
        nom_aide (str): Name of the aid to analyze
        description_aide (str, optional): Description of the aid
        exemples_projets (str, optional): Examples of eligible projects
        system_prompt (str): System prompt for the LLM
        user_prompt (str): User prompt for the LLM
        examples_prompt (str): Few-shot examples for the LLM

    Returns:
        dict: Contains aid name and matched projects with scores:
            {
                "aide": str,
                "projets": [
                    {
                        "projet": str,
                        "score": float (0-1)
                    },
                    ...
                ]
            }
    """
    
    aide = f"intitulé de l'aide : {nom_aide}"
    if description_aide :
            aide += f"\ndescription :  {description_aide}"

    if exemples_projets:
            aide += f"\nexemples de projets réalisables : {exemples_projets}"

    # print the aid input sent to LLM (comment to skip it)
    print("Aid Input sent to LLM:\n")
    print(aide)
    print("\n--------------------------------")

    response = client.messages.create(
        model= "claude-3-7-sonnet-20250219",
        max_tokens=1024,
        temperature=0.6,
        system=[{"type": "text","text": system_prompt,"cache_control": {"type": "ephemeral"}}],
        messages = [{
                    "role": "user",
                    "content": [
                        {"type": "text", "text": examples_prompt, "cache_control": {"type": "ephemeral"}},
                        {"type": "text", "text": user_prompt_aides, "cache_control": {"type": "ephemeral"}},
                        {"type": "text", "text": f"<aide>\n{aide}\n</aide>"}
                    ]
                }]

        )
    # print the raw LLM response (comment to skip it)
    print("Raw LLM response:\n")    
    print(response.content[0].text)

    # Print token usage information
    # input_tokens = response.usage.input_tokens
    # output_tokens = response.usage.output_tokens
    # input_tokens_cache_read = getattr(response.usage, 'cache_read_input_tokens', '---')
    # input_tokens_cache_create = getattr(response.usage, 'cache_creation_input_tokens', '---')
    # print(f"User input tokens: {input_tokens}")
    # print(f"Output tokens: {output_tokens}")
    # print(f"Input tokens (cache read): {input_tokens_cache_read}")
    # print(f"Input tokens (cache write): {input_tokens_cache_create}")
    # print(response.content[0].text)

    # Extract content between <json> tags
    json_content = re.search(r'<json>(.*?)</json>', response.content[0].text, re.DOTALL)
    
    # Initialize response dictionary
    response_dict = {
        "aide": nom_aide,
        "projets": []
    }
    
    # Parse JSON content
    if json_content:
        try:
            json_data = json_data = json.loads(json_content.group(1).strip())
            
            # post-treatment of the LLM response for leviers
            json_data = post_treatment_projects(json_data,valid_projects_references)
            response_dict.update(json_data)
        except json.JSONDecodeError:
            response_dict["projets"] = "Error in treating the aid: Invalid JSON format returned by the LLM"
    else:
        print("No JSON content found in the response.")
        response_dict["classification"] = "Error in treating the project: No JSON content found in the LLM response"
    return response_dict

# example to test the function
aide = "Financer des projets contribuant au développement durable de la commune"
description = "Le contrat Agglo - communes de Saint - Lô Agglo vise à impulser la mise en œuvre d'opérations structurantes à l'échelle du bassin de vie des communes. Il permet le soutien et le cofinancement de projets locaux, sous maitrise d'ouvrage communale. "
projets_elegibles = "Aménagement d'itinéraires cyclables et piétonniers, démarche innovant type écoquartiers ou haute qualité environnementale, création de tiers - lieux, systèmes d'éclairage public intelligent, travaux d'amélioration énergétique"

# uncomment to test the function
# categorization_projects(aide,description,projets_elegibles)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description='Catégorisation des aides territoriales')
    parser.add_argument('aide', help='Nom de l\'aide à analyser')
    parser.add_argument('--description', help='Description de l\'aide')
    parser.add_argument('--projets_eligibles', help='Liste des projets réalisables')
    args = parser.parse_args()

    response_categorization = categorization_projects(args.aide,args.description,args.projets_eligibles)
    #print(json.dumps(response_categorization, ensure_ascii=False))



