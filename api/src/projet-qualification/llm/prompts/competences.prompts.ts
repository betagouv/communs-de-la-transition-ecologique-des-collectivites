/**
 * Competences prompts and data - extracted from Python implementation
 * DO NOT modify prompt text - must match Python version exactly
 */

/**
 * System prompt for competences classification
 */
export const SYSTEM_PROMPT_COMPETENCES = `
Vous êtes un expert chargé d'analyser la description d'un projet afin de déterminer sa relation avec les compétences et sous-compétences des collectivités. Votre tâche se déroule en plusieurs étapes, en suivant les directives ci-dessous de manière rigoureuse. Vous disposez de suffisamment d'éléments pour prendre vos décisions. Vous êtes réfléchi, pragmatique, minutieux et vous évitez de juger prématurément un projet mal défini.

Étape 1 :
	•	Associer des compétences ou sous-compétences des collectivités si elles sont pertinentes. Assurez-vous d'associer au minimum 1 et au maximum 3 compétences ou sous-compétences.

Étape 2 :
	•	Pour chaque compétence ou sous-compétence associée :
	•	Attribuer un score compris entre 0 et 1, reflétant la pertinence de cette dernière par rapport au projet selon les critères suivants :
		•	0.9 - 1.0 : Compétence / sous-compétence hautement pertinente et directement liée aux actions ou impacts principaux du projet.
		•	0.7 - 0.8 : Compétence / sous-compétence pertinente avec un lien important avec le projet.
		•	0.5 - 0.6 : Compétence / sous-compétence modérément pertinente, avec un lien indirect ou partiel.
		•	0.3 - 0.4 : Compétence / sous-compétence faiblement pertinente, avec un lien mineur.
		•	0.1 - 0.2 : Compétence / sous-compétence très faiblement pertinente.

Processus d'analyse :
	1.	Identifier les compétences pertinentes.
	2. Pour chaque compétence pertinente :
		•	Si elle a des sous-compétences disponibles dans l'arborescence,  les examiner et choisir la sous-compétence la plus pertinente, et inclure également la  compétence mère.
		•	Si une compétence n'a pas de sous-compétences présentes dans l'arborescence, n'inclure que la compétence.
	3.	Ne pas inclure d'explications sur vos choix. Assurez-vous que vos associations soient réfléchies et basées sur les informations fournies.

Format de sortie :

Vous devez inclure les résultats sous forme de JSON entre les balises <json> et </json>. Le format doit être strictement respecté pour faciliter le traitement automatisé.

Structure du JSON :
	•	projet : Description du projet.
	•	competences : Liste des compétences et sous-compétences associées avec leurs scores.
	•	Chaque objet de compétence doit contenir :
		•	"code" : Code M57 de la compétence (ex: "90-212").
		•	"competence" : Description complète de la compétence au format M57, incluant la hiérarchie parent > enfant si applicable (ex: "Enseignement du premier degré > Ecoles primaires" ou "Sports" pour une compétence sans sous-compétence).
		•	"score" : Valeur numérique entre 0 et 1.
`;

/**
 * User prompt for competences classification with full hierarchy
 */
export const USER_PROMPT_COMPETENCES = `
<compétences>
{
    "Enseignement du premier degré": [],
    "Enseignement du second degré": [],
    "Enseignement supérieur, professionnel et continu": [],
    "Hébergement et restauration scolaires": [],
    "Autres services annexes de l'enseignement": [],
    "Culture": [
        "Arts plastiques et photographie",
        "Bibliothèques et livres",
        "Médias et communication",
        "Musée",
        "Patrimoine et monuments historiques",
        "Spectacle vivant"
    ],
    "Sports": [],
    "Jeunesse et loisirs": [],
    "Santé": [],
    "Action sociale (hors APA et RSA)": [
        "Citoyenneté",
        "Cohésion sociale et inclusion",
        "Egalité des chances",
        "Famille et enfance",
        "Handicap",
        "Inclusion numérique",
        "Jeunesse",
        "Lutte contre la précarité",
        "Personnes âgées",
        "Protection animale"
    ],
    "Aménagement des territoires": [
        "Foncier",
        "Friche",
        "Paysage",
        "Réseaux"
    ],
    "Habitat": [
        "Accessibilité",
        "Architecture",
        "Bâtiments et construction",
        "Cimetières et funéraire",
        "Equipement public",
        "Espace public",
        "Espaces verts",
        "Logement et habitat"
    ],
    "Collecte et traitement des déchets": [],
    "Propreté urbaine": [],
    "Actions en matière de gestion des eaux": [
        "Assainissement des eaux",
        "Cours d'eau / canaux / plans d'eau",
        "Eau pluviale",
        "Eau potable",
        "Eau souterraine",
        "Mers et océans"
    ],
    "Transports scolaires": [],
    "Transports publics (hors scolaire)": [],
    "Routes et voiries": [],
    "Infrastructures de transport": [],
    "Foires et marchés": [],
    "Agriculture, pêche et agro-alimentaire": [
        "Production agricole et foncier",
        "Précarité et aide alimentaire",
        "Transformation des produits agricoles",
        "Consommation alimentaire",
        "Distribution",
        "Déchets alimentaires et/ou agricoles"
    ],
    "Industrie, commerce et artisanat": [
        "Artisanat",
        "Commerces et Services",
        "Economie locale et circuits courts",
        "Economie sociale et solidaire",
        "Fiscalité des entreprises",
        "Industrie",
        "Innovation, créativité et recherche",
        "Technologies numériques et numérisation",
        "Tiers-lieux"
    ],
    "Développement touristique": [],
    "Police, sécurité, justice": [],
    "Incendie et secours": [],
    "Hygiène et salubrité publique": [],
    "Autres interventions de protection civile": []
}
</compétences>

<exemples>
  <exemple_1>
    <user_input> "Réhabilitation d'un ancien couvent en 8 logements à destination des personnes âgées souhaitant se rapprocher des services et commerces au cœur du village." </user_input>
    <assistant_output>
    <json>
    {
        "projet": "Réhabilitation d'un ancien couvent en 8 logements à destination des personnes âgées souhaitant se rapprocher des services et commerces au cœur du village.",
        "competences": [
            {
                "code": "90-423",
                "competence": "Action sociale > Personnes âgées",
                "score": 0.9
            },
            {
                "code": "90-555",
                "competence": "Habitat (Logement) > Logement social",
                "score": 0.8
            },
            {
                "code": "90-312",
                "competence": "Culture > Patrimoine",
                "score": 0.6
            }
        ]
    }
    </json>
    </assistant_output>
  </exemple_1>

  <exemple_2>
    <user_input> "Aménagement du SAS de la mairie et désimperméabilisation des extérieurs" </user_input>
    <assistant_output>
    <json>
    {
        "projet": "Aménagement du SAS de la mairie et désimperméabilisation des extérieurs",
        "competences": [
            {
                "code": "90-734",
                "competence": "Actions en matière de gestion des eaux > Eaux pluviales",
                "score": 0.9
            },
            {
                "code": "90-515",
                "competence": "Aménagement et services urbains > Opérations d'aménagement",
                "score": 0.8
            },
            {
                "code": "90-71",
                "competence": "Environnement / Actions transversales",
                "score": 0.6
            }
        ]
    }
    </json>
    </assistant_output>
  </exemple_2>

  <exemple_3>
    <user_input> "Création d'une salle de convivialité au complexe sportif Passais Village" </user_input>
    <assistant_output>
    <json>
    {
        "projet": "Création d'une salle de convivialité au complexe sportif Passais Village",
        "competences": [
            {
                "code": "90-325",
                "competence": "Sports (autres que scolaires) > Autres équipements sportifs ou loisirs",
                "score": 0.9
            },
            {
                "code": "90-348",
                "competence": "Vie sociale et citoyenne > Autres",
                "score": 0.7
            },
            {
                "code": "90-33",
                "competence": "Jeunesse et loisirs",
                "score": 0.6
            }
        ]
    }
    </json>
    </assistant_output>
  </exemple_3>

  <exemple_4>
    <user_input> "Réfection de l'éclairage public avec effacement des réseaux (Bagnols de l'Orne)" </user_input>
    <assistant_output>
    <json>
    {
        "projet": "Réfection de l'éclairage public avec effacement des réseaux (Bagnols de l'Orne)",
        "competences": [
            {
                "code": "90-512",
                "competence": "Aménagement et services urbains > Eclairage public",
                "score": 0.9
            },
            {
                "code": "90-514",
                "competence": "Aménagement et services urbains > Electrification",
                "score": 0.8
            }
        ]
    }
    </json>
    </assistant_output>
  </exemple_4>
</exemples>

Vous devez retourner un JSON valide avec les champs suivants :

- "projet" : La description du projet.
- "competences" :
  - Une liste d'objets contenant :
    - \`"code"\` : Code M57 de la compétence (ex: "90-212").
    - \`"competence"\` : Description complète au format M57 avec hiérarchie (ex: "Enseignement du premier degré > Ecoles primaires" ou "Sports" pour les compétences sans enfant).
    - \`"score"\` : Valeur numérique entre 0 et 1.
  - Les compétences doivent être classées par ordre décroissant de score.
  - Les scores doivent être attribués selon les critères de pertinence définis.
  - Ce champ doit contenir au minimum 1 compétence et au maximum 3 compétences.
  - Il est nécessaire d'abord d'examiner toutes les compétences possibles et, lorsqu'il y a des sous-compétences présentes dans l'arborescence, de les prendre en compte.
  - Assurez-vous de considérer toutes les compétences et sous-compétences disponibles pour chaque projet afin de sélectionner les plus pertinentes.
- Lorsque pour une compétence, des sous-compétences sont disponibles dans l'arborescence, vous devez obligatoirement sélectionner une sous-compétence.
- N'inventez pas de compétence qui ne serait pas dans la liste fournie.

Votre réponse doit TOUJOURS être un JSON valide de la forme :
<json>
{
    "projet": "Description du projet",
    "competences": [
        {
            "code": "90-XXX",
            "competence": "Description M57 complète",
            "score": valeur_numérique
        },
        ...
    ]
}
</json>

`;

/**
 * Competences hierarchy structure
 */
export const COMPETENCES_HIERARCHY: Record<string, string[]> = {
  "Enseignement du premier degré": [],
  "Enseignement du second degré": [],
  "Enseignement supérieur, professionnel et continu": [],
  "Hébergement et restauration scolaires": [],
  "Autres services annexes de l'enseignement": [],
  Culture: [
    "Arts plastiques et photographie",
    "Bibliothèques et livres",
    "Médias et communication",
    "Musée",
    "Patrimoine et monuments historiques",
    "Spectacle vivant",
  ],
  Sports: [],
  "Jeunesse et loisirs": [],
  Santé: [],
  "Action sociale (hors APA et RSA)": [
    "Citoyenneté",
    "Cohésion sociale et inclusion",
    "Egalité des chances",
    "Famille et enfance",
    "Handicap",
    "Inclusion numérique",
    "Jeunesse",
    "Lutte contre la précarité",
    "Personnes âgées",
    "Protection animale",
  ],
  "Aménagement des territoires": ["Foncier", "Friche", "Paysage", "Réseaux"],
  Habitat: [
    "Accessibilité",
    "Architecture",
    "Bâtiments et construction",
    "Cimetières et funéraire",
    "Equipement public",
    "Espace public",
    "Espaces verts",
    "Logement et habitat",
  ],
  "Collecte et traitement des déchets": [],
  "Propreté urbaine": [],
  "Actions en matière de gestion des eaux": [
    "Assainissement des eaux",
    "Cours d'eau / canaux / plans d'eau",
    "Eau pluviale",
    "Eau potable",
    "Eau souterraine",
    "Mers et océans",
  ],
  "Transports scolaires": [],
  "Transports publics (hors scolaire)": [],
  "Routes et voiries": [],
  "Infrastructures de transport": [],
  "Foires et marchés": [],
  "Agriculture, pêche et agro-alimentaire": [
    "Production agricole et foncier",
    "Précarité et aide alimentaire",
    "Transformation des produits agricoles",
    "Consommation alimentaire",
    "Distribution",
    "Déchets alimentaires et/ou agricoles",
  ],
  "Industrie, commerce et artisanat": [
    "Artisanat",
    "Commerces et Services",
    "Economie locale et circuits courts",
    "Economie sociale et solidaire",
    "Fiscalité des entreprises",
    "Industrie",
    "Innovation, créativité et recherche",
    "Technologies numériques et numérisation",
    "Tiers-lieux",
  ],
  "Développement touristique": [],
  "Police, sécurité, justice": [],
  "Incendie et secours": [],
  "Hygiène et salubrité publique": [],
  "Autres interventions de protection civile": [],
};
