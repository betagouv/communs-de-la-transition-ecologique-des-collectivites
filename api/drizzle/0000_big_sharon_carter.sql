CREATE TYPE "public"."competences" AS ENUM('Action sociale (hors APA et RSA)', 'Actions en matière de gestion des eaux', 'Agriculture, pêche et agro-alimentaire', 'Aménagement des territoires', 'Autres interventions de protection civile', 'Autres services annexes de l''enseignement', 'Collecte et traitement des déchets', 'Culture', 'Développement touristique', 'Enseignement du premier degré', 'Enseignement du second degré', 'Enseignement supérieur, professionnel et continu', 'Foires et marchés', 'Habitat', 'Hygiène et salubrité publique', 'Hébergement et restauration scolaires', 'Incendie et secours', 'Industrie, commerce et artisanat', 'Infrastructures de transport', 'Jeunesse et loisirs', 'Police, sécurité, justice', 'Propreté urbaine', 'Routes et voiries', 'Santé', 'Sports', 'Transports publics (hors scolaire)', 'Transports scolaires');--> statement-breakpoint
CREATE TYPE "public"."permission_type" AS ENUM('EDIT', 'VIEW');--> statement-breakpoint
CREATE TYPE "public"."project_status" AS ENUM('IDEE', 'FAISABILITE', 'EN_COURS', 'IMPACTE', 'ABANDONNE', 'TERMINE');--> statement-breakpoint
CREATE TYPE "public"."sous_competences" AS ENUM('Accessibilité', 'Architecture', 'Artisanat', 'Arts plastiques et photographie', 'Assainissement des eaux', 'Bibliothèques et livres', 'Bâtiments et construction', 'Cimetières et funéraire', 'Citoyenneté', 'Cohésion sociale et inclusion', 'Commerces et Services', 'Consommation alimentaire', 'Cours d''eau / canaux / plans d''eau', 'Distribution', 'Déchets alimentaires et/ou agricoles', 'Eau pluviale', 'Eau potable', 'Eau souterraine', 'Economie locale et circuits courts', 'Economie sociale et solidaire', 'Egalité des chances', 'Equipement public', 'Espace public', 'Espaces verts', 'Famille et enfance', 'Fiscalité des entreprises', 'Foncier', 'Friche', 'Handicap', 'Inclusion numérique', 'Industrie', 'Innovation, créativité et recherche', 'Jeunesse', 'Logement et habitat', 'Lutte contre la précarité', 'Mers et océans', 'Musée', 'Médias et communication', 'Patrimoine et monuments historiques', 'Paysage', 'Personnes âgées', 'Production agricole et foncier', 'Protection animale', 'Précarité et aide alimentaire', 'Réseaux', 'Spectacle vivant', 'Technologies numériques et numérisation', 'Tiers-lieux', 'Transformation des produits agricoles');--> statement-breakpoint
CREATE TABLE "communes" (
	"insee_code" text PRIMARY KEY NOT NULL
);
--> statement-breakpoint
CREATE TABLE "projects" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"nom" text NOT NULL,
	"description" text,
	"code_siret" text,
	"porteur_referent_email" text,
	"porteur_referent_telephone" text,
	"porteur_referent_prenom" text,
	"porteur_referent_nom" text,
	"porteur_referent_fonction" text,
	"competences" "competences"[],
	"sous_competences" "sous_competences"[],
	"budget" integer,
	"forecasted_start_date" text,
	"status" "project_status"
);
--> statement-breakpoint
CREATE TABLE "projects_to_communes" (
	"project_id" uuid NOT NULL,
	"commune_id" text NOT NULL,
	CONSTRAINT "projects_to_communes_project_id_commune_id_pk" PRIMARY KEY("project_id","commune_id")
);
--> statement-breakpoint
CREATE TABLE "services" (
	"id" uuid PRIMARY KEY NOT NULL,
	"createdAt" timestamp DEFAULT now(),
	"name" text NOT NULL,
	"description" text NOT NULL,
	"logoUrl" text NOT NULL,
	"url" text NOT NULL
);
--> statement-breakpoint
ALTER TABLE "projects_to_communes" ADD CONSTRAINT "projects_to_communes_project_id_projects_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "projects_to_communes" ADD CONSTRAINT "projects_to_communes_commune_id_communes_insee_code_fk" FOREIGN KEY ("commune_id") REFERENCES "public"."communes"("insee_code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "commune_project_idx" ON "projects_to_communes" USING btree ("commune_id","project_id");