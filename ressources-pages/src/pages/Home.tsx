import { fr } from "@codegouvfr/react-dsfr";
import { Card } from "@codegouvfr/react-dsfr/Card";

export function Home() {
  return (
    <div className={fr.cx("fr-container", "fr-py-8w")}>
      <h1>Ressources pour les collectivités</h1>
      <p className={fr.cx("fr-text--lead")}>
        Découvrez les outils et ressources pour accompagner la transition écologique de votre territoire.
      </p>

      <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mt-6w")}>
        <div className={fr.cx("fr-col-12", "fr-col-md-6", "fr-col-lg-4")}>
          <Card
            title="Cartographie des projets"
            desc="Visualisez les projets de transition écologique sur l'ensemble du territoire national et découvrez les initiatives près de chez vous."
            imageUrl="/ressources/images/cartographie-preview.png"
            imageAlt="Aperçu de la cartographie des projets"
            linkProps={{
              href: "/ressources/cartographie",
            }}
            enlargeLink
            footer={
              <ul className={fr.cx("fr-badges-group")}>
                <li>
                  <span className={fr.cx("fr-badge", "fr-badge--green-emeraude")}>Nouveau</span>
                </li>
              </ul>
            }
          />
        </div>

        <div className={fr.cx("fr-col-12", "fr-col-md-6", "fr-col-lg-4")}>
          <Card
            title="Documentation API"
            desc="Consultez la documentation technique de l'API Collectivités pour intégrer les données de projets dans vos applications."
            imageUrl="/ressources/images/api-preview.png"
            imageAlt="Documentation de l'API"
            linkProps={{
              href: "/api",
            }}
            enlargeLink
          />
        </div>

        <div className={fr.cx("fr-col-12", "fr-col-md-6", "fr-col-lg-4")}>
          <Card
            title="Statistiques d'usage"
            desc="Consultez les statistiques d'utilisation de la plateforme et l'évolution des projets de transition écologique."
            imageUrl="/ressources/images/stats-preview.png"
            imageAlt="Tableau de bord statistiques"
            linkProps={{
              href: "/statistics",
            }}
            enlargeLink
          />
        </div>
      </div>

      <section className={fr.cx("fr-mt-8w")}>
        <h2>À propos de l&apos;API Collectivités</h2>
        <p>
          L&apos;API Collectivités facilite le partage des projets de transition écologique entre les différentes
          plateformes de l&apos;écosystème beta.gouv.fr. Elle permet aux collectivités de saisir leurs projets une seule
          fois tout en les rendant visibles sur l&apos;ensemble des services partenaires.
        </p>
        <p>
          Cette API est développée dans le cadre du programme beta.gouv.fr et respecte les standards de l&apos;État en
          matière d&apos;accessibilité (RGAA) et de design (DSFR).
        </p>
      </section>
    </div>
  );
}
