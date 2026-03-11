const DSFR_CDN = "https://cdn.jsdelivr.net/npm/@gouvfr/dsfr@latest/dist";

export const layoutTemplate = (title: string, content: string): string => `<!DOCTYPE html>
<html lang="fr" data-fr-scheme="system">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${title}</title>
  <link rel="stylesheet" href="${DSFR_CDN}/dsfr.min.css">
  <link rel="stylesheet" href="${DSFR_CDN}/utility/icons/icons.min.css">
</head>
<body>
  <header role="banner" class="fr-header">
    <div class="fr-header__body">
      <div class="fr-container">
        <div class="fr-header__body-row">
          <div class="fr-header__brand fr-enlarge-link">
            <div class="fr-header__brand-top">
              <div class="fr-header__logo">
                <p class="fr-logo">République<br>Française</p>
              </div>
            </div>
            <div class="fr-header__service">
              <a href="/" title="Accueil - API Collectivités">
                <p class="fr-header__service-title">API Collectivités</p>
                <p class="fr-header__service-tagline">Données et services pour la transition écologique des collectivités</p>
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  </header>

  <main role="main" id="content">
    ${content}
  </main>

  <footer class="fr-footer" role="contentinfo">
    <div class="fr-container">
      <div class="fr-footer__body">
        <div class="fr-footer__brand fr-enlarge-link">
          <p class="fr-logo">République<br>Française</p>
        </div>
        <div class="fr-footer__content">
          <p class="fr-footer__content-desc">
            API Collectivités est un service développé par
            <a href="https://beta.gouv.fr" target="_blank" rel="noopener">beta.gouv.fr</a>
            dans le cadre de la transition écologique des collectivités territoriales.
          </p>
          <ul class="fr-footer__content-list">
            <li class="fr-footer__content-item">
              <a class="fr-footer__content-link" href="https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites" target="_blank" rel="noopener">Code source</a>
            </li>
            <li class="fr-footer__content-item">
              <a class="fr-footer__content-link" href="https://beta.gouv.fr" target="_blank" rel="noopener">beta.gouv.fr</a>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </footer>

  <script type="module" src="${DSFR_CDN}/dsfr.module.min.js"></script>
  <script type="text/javascript" nomodule src="${DSFR_CDN}/dsfr.nomodule.min.js"></script>
</body>
</html>`;

export const homePage = (): string =>
  layoutTemplate(
    "API Collectivités",
    `
    <div class="fr-container fr-my-6w">
      <h1>API Collectivités</h1>
      <p class="fr-text--lead">
        Plateforme de services pour la transition écologique des collectivités territoriales.
      </p>

      <div class="fr-grid-row fr-grid-row--gutters fr-mt-4w">
        <div class="fr-col-12 fr-col-md-6">
          <div class="fr-card fr-enlarge-link">
            <div class="fr-card__body">
              <div class="fr-card__content">
                <h2 class="fr-card__title">
                  <a href="/referentiel">API Référentiel Collectivités</a>
                </h2>
                <p class="fr-card__desc">
                  Données de référence sur les collectivités territoriales : communes, intercommunalités,
                  groupements et compétences. Sources : Banatic (DGCL), ZLV, geo.api.gouv.fr.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="fr-col-12 fr-col-md-6">
          <div class="fr-card fr-enlarge-link">
            <div class="fr-card__body">
              <div class="fr-card__content">
                <h2 class="fr-card__title">
                  <a href="/api-projets">API Projets Collectivités</a>
                </h2>
                <p class="fr-card__desc">
                  Partage de projets de transition écologique entre plateformes partenaires.
                  Permet la découverte et la synchronisation de projets entre services.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div class="fr-col-12 fr-col-md-6">
          <div class="fr-card fr-enlarge-link">
            <div class="fr-card__body">
              <div class="fr-card__content">
                <h2 class="fr-card__title">
                  <a href="/ressources">Espace Ressources</a>
                </h2>
                <p class="fr-card__desc">
                  Cartographie et analyses de convergence des outils au service de la transition
                  écologique des collectivités.
                </p>
              </div>
            </div>
          </div>
        </div>

      </div>
    </div>`,
  );

export const referentielPage = (): string =>
  layoutTemplate(
    "API Référentiel Collectivités",
    `
    <div class="fr-container fr-my-6w">
      <nav role="navigation" class="fr-breadcrumb" aria-label="vous êtes ici :">
        <ol class="fr-breadcrumb__list">
          <li><a class="fr-breadcrumb__link" href="/">Accueil</a></li>
          <li><a class="fr-breadcrumb__link" aria-current="page">API Référentiel Collectivités</a></li>
        </ol>
      </nav>

      <h1>API Référentiel Collectivités</h1>
      <p class="fr-text--lead">
        API publique de référence sur les collectivités territoriales françaises.
        Données issues de Banatic (DGCL), ZLV et geo.api.gouv.fr.
      </p>

      <div class="fr-callout fr-my-4w">
        <p class="fr-callout__text">
          Cette API est en accès libre, sans authentification requise.
        </p>
      </div>

      <h2>Endpoints disponibles</h2>
      <div class="fr-table">
        <table>
          <thead>
            <tr>
              <th>Méthode</th>
              <th>Endpoint</th>
              <th>Description</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><code>GET</code></td>
              <td><code>/v1/communes</code></td>
              <td>Rechercher des communes par nom, code postal ou code INSEE</td>
            </tr>
            <tr>
              <td><code>GET</code></td>
              <td><code>/v1/communes/:id</code></td>
              <td>Détail d'une commune (population, EPCI, départements, régions)</td>
            </tr>
            <tr>
              <td><code>GET</code></td>
              <td><code>/v1/groupements</code></td>
              <td>Rechercher des groupements (EPCI, syndicats, PETR…)</td>
            </tr>
            <tr>
              <td><code>GET</code></td>
              <td><code>/v1/groupements/:id</code></td>
              <td>Détail d'un groupement et ses communes membres</td>
            </tr>
            <tr>
              <td><code>GET</code></td>
              <td><code>/v1/competences</code></td>
              <td>Liste des 123 compétences Banatic en 10 catégories</td>
            </tr>
            <tr>
              <td><code>GET</code></td>
              <td><code>/v1/recherche</code></td>
              <td>Recherche transversale par nom (communes et groupements)</td>
            </tr>
          </tbody>
        </table>
      </div>

      <h2>Exemples</h2>
      <pre class="fr-p-2w" style="background: var(--background-alt-grey); border-radius: 4px; overflow-x: auto;"><code># Rechercher une commune
curl "https://collectivites.api.beta.gouv.fr/v1/communes?q=Paris"

# Détail d'une commune par code INSEE
curl "https://collectivites.api.beta.gouv.fr/v1/communes/75056"

# Détail avec les compétences des groupements associés
curl "https://collectivites.api.beta.gouv.fr/v1/communes/75056?includeCompetences=true"

# Rechercher des groupements
curl "https://collectivites.api.beta.gouv.fr/v1/groupements?q=Nantes"

# Liste des compétences
curl "https://collectivites.api.beta.gouv.fr/v1/competences"

# Recherche transversale (communes + groupements)
curl "https://collectivites.api.beta.gouv.fr/v1/recherche?q=Lyon"</code></pre>

      <div class="fr-mt-4w">
        <a class="fr-btn" href="/api/referentiel">
          Documentation Swagger complète
        </a>
      </div>
    </div>`,
  );

export const apiProjetsPage = (): string =>
  layoutTemplate(
    "API Projets Collectivités",
    `
    <div class="fr-container fr-my-6w">
      <nav role="navigation" class="fr-breadcrumb" aria-label="vous êtes ici :">
        <ol class="fr-breadcrumb__list">
          <li><a class="fr-breadcrumb__link" href="/">Accueil</a></li>
          <li><a class="fr-breadcrumb__link" aria-current="page">API Projets Collectivités</a></li>
        </ol>
      </nav>

      <h1>API Projets Collectivités</h1>
      <p class="fr-text--lead">
        API de partage de projets de transition écologique entre plateformes partenaires.
      </p>

      <div class="fr-callout fr-my-4w">
        <p class="fr-callout__text">
          L'accès à cette API nécessite une clé d'authentification (Bearer token).
          Contactez l'équipe pour obtenir un accès.
        </p>
      </div>

      <h2>Fonctionnalités</h2>
      <ul>
        <li>Création et synchronisation de projets entre services partenaires</li>
        <li>Recherche de projets par collectivité, thématique ou localisation</li>
        <li>Qualification automatique des projets (leviers SGPE, compétences)</li>
        <li>Import en masse de projets</li>
      </ul>

      <div class="fr-mt-4w">
        <a class="fr-btn" href="/api">
          Documentation Swagger complète
        </a>
      </div>
    </div>`,
  );
