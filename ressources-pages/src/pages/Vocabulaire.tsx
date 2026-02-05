import { fr } from "@codegouvfr/react-dsfr";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";

interface QuoteProps {
  text: React.ReactNode;
  author: string;
  source?: string;
}

function Quote({ text, author, source }: QuoteProps) {
  return (
    <figure className={fr.cx("fr-quote")}>
      <blockquote>
        <p className={fr.cx("fr-text--lg")}>{text}</p>
      </blockquote>
      <figcaption>
        <p className={fr.cx("fr-quote__author")}>
          {author}
          {source && `, ${source}`}
        </p>
      </figcaption>
    </figure>
  );
}

function HighlightedAction({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "#6A6AF4" }}>{children}</span>;
}

function HighlightedProjet({ children }: { children: React.ReactNode }) {
  return <span style={{ color: "#FA794A" }}>{children}</span>;
}

interface FlowStepProps {
  label: string;
  variant?: "outline" | "filled";
  isLast?: boolean;
}

function FlowStep({ label, variant = "outline", isLast = false }: FlowStepProps) {
  const baseStyle: React.CSSProperties = {
    padding: "8px 16px",
    borderRadius: "100px",
    fontWeight: 500,
    fontSize: "16px",
    whiteSpace: "nowrap",
  };

  const outlineStyle: React.CSSProperties = {
    ...baseStyle,
    backgroundColor: "var(--background-contrast-info)",
    color: "var(--text-action-high-blue-france)",
  };

  const filledStyle: React.CSSProperties = {
    ...baseStyle,
    backgroundColor: "var(--background-action-high-blue-france)",
    color: "var(--text-inverted-blue-france)",
  };

  return (
    <>
      <span style={variant === "filled" ? filledStyle : outlineStyle}>{label}</span>
      {!isLast && (
        <span
          style={{
            display: "flex",
            alignItems: "center",
            flexShrink: 0,
            color: "var(--text-action-high-blue-france)",
          }}
        >
          <span
            style={{
              width: "40px",
              height: "0",
              borderTop: "2px dashed currentColor",
            }}
          />
          <svg width="8" height="12" viewBox="0 0 8 12" fill="none" style={{ marginLeft: "-2px" }} aria-hidden="true">
            <path d="M1.5 1L6.5 6L1.5 11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
          </svg>
        </span>
      )}
    </>
  );
}

interface DefinitionBlockProps {
  title: string;
  definition: string;
  recommendation: string;
}

function DefinitionBlock({ title, definition, recommendation }: DefinitionBlockProps) {
  return (
    <div className={fr.cx("fr-mt-4w")}>
      <h4>{title}</h4>
      <div className={fr.cx("fr-mt-2w")}>
        <p className={fr.cx("fr-text--lg")} style={{ fontWeight: 500 }}>
          Définition
        </p>
        <p>{definition}</p>
      </div>
      <div className={fr.cx("fr-mt-2w")}>
        <p className={fr.cx("fr-text--lg")} style={{ fontWeight: 500 }}>
          Recommandations d&apos;usage
        </p>
        <p>{recommendation}</p>
      </div>
    </div>
  );
}

const quotes: QuoteProps[] = [
  {
    text: (
      <>
        « L&apos;<HighlightedAction>action</HighlightedAction> c&apos;est le niveau le plus bas de déclinaison du projet
        de territoire ; elle peut être déclinée en sous-opérations selon les dispositifs de financement. »
      </>
    ),
    author: "Directrice de projets",
    source: "CC Perpignan Méditerranée",
  },
  {
    text: (
      <>
        « L&apos;<HighlightedAction>action</HighlightedAction>, c&apos;est ce que l&apos;on souhaite faire, c&apos;est
        sur le papier, c&apos;est une fiche, un vœu pieu. »
      </>
    ),
    author: "Chargée de mission TE",
    source: "CC Creuse Sud-Ouest",
  },
  {
    text: (
      <>
        « Un <HighlightedProjet>projet</HighlightedProjet> est une intention politique validée, inscrite dans un cadre
        politique (projet de territoire, CRTE, etc.), mais sans commencement d&apos;exécution. »
      </>
    ),
    author: "Chargée des contractualisations territoriales",
    source: "EPCI",
  },
  {
    text: (
      <>
        « Un <HighlightedProjet>projet</HighlightedProjet>, c&apos;est la réalisation d&apos;une fiche action.
        C&apos;est un chantier mobilisant un ou plusieurs acteurs, nécessitant un pilote clair et des rôles définis. »
      </>
    ),
    author: "Directrice de projets",
    source: "CC Perpignan Méditerranée",
  },
];

const definitions: DefinitionBlockProps[] = [
  {
    title: "Plan",
    definition:
      "Document stratégique qui définit, sur un horizon temporel déterminé, les orientations, objectifs et actions que se fixe une collectivité territoriale pour organiser et développer son territoire de manière cohérente. Il traduit une vision partagée du devenir du territoire en tenant compte de ses enjeux (aménagement, développement économique, transition écologique, cohésion sociale, etc.), des besoins de ses habitants et des ressources disponibles. Le plan établit généralement des priorités, identifie les moyens de mise en œuvre et définit des indicateurs de suivi et d'évaluation.",
    recommendation: "Plan de territoire ;",
  },
  {
    title: "Axes et Sous-Axes",
    definition:
      "Composante structurante du plan de territoire qui organise et regroupe un ensemble cohérent d'actions autour d'une thématique stratégique majeure. L'axe constitue un pilier du projet territorial et traduit une orientation politique forte de la collectivité sur un domaine d'intervention spécifique (mobilité douce, transition écologique, cohésion sociale, développement économique...). Il peut se décomposer en sous-axes qui précisent des objectifs opérationnels ciblés, idéalement associés à des indicateurs de suivi, permettant ainsi d'articuler la vision thématique générale avec des ambitions mesurables.",
    recommendation: "Objectifs ;",
  },
  {
    title: "Action",
    definition:
      "Expression d'une volonté politique qui décrit ce que la collectivité territoriale souhaite entreprendre pour atteindre un objectif de son plan de territoire. Elle traduit une intention stratégique en précisant la nature de l'intervention envisagée, son périmètre d'application et les finalités recherchées, sans entrer dans les modalités opérationnelles de mise en œuvre. L'action constitue le lien entre l'ambition portée par les orientations du plan et sa déclinaison concrète à travers des projets.",
    recommendation: "Fiche Action ;",
  },
  {
    title: "Opération",
    definition:
      "Déclinaison opérationnelle et structurée d'une action, qui définit précisément une des modalités de sa réalisation concrète sur le territoire. Il détaille les moyens engagés (budget, ressources humaines, techniques), identifie les acteurs et leurs rôles respectifs, établit un calendrier précis et définit des livrables attendus. L'opération constitue l'unité de gestion et de pilotage qui permet la mise en œuvre effective de la volonté politique exprimée dans l'action.",
    recommendation: "Projet opérationnel ;",
  },
];

export function Vocabulaire() {
  return (
    <div className={fr.cx("fr-container", "fr-py-4w")}>
      <Breadcrumb
        currentPageLabel="Vocabulaire métier"
        segments={[{ label: "Ressources", linkProps: { href: "/ressources" } }]}
      />

      <h1>Vocabulaire métier</h1>
      <p className={fr.cx("fr-text--lead")}>
        Glossaire des termes utilisés dans le domaine de la transition écologique des collectivités.
      </p>

      <div className={fr.cx("fr-mt-6w")}>
        {/* Section Contexte */}
        <h2>Contexte</h2>
        <p>
          Nous avons mené une dizaine d&apos;interviews auprès de différents acteurs de la Transition Écologique des
          Collectivités (agents DDTM, agents de collectivités EPCI, membres d&apos;équipes produit de services
          numériques d&apos;État) pour mettre en lumière les concepts clés utilisés dans leur quotidien avec pour
          objectif de clarifier une vision partagée du parcours de création et suivi de &quot;projets&quot; liés à la
          transition écologique dans les collectivités.
        </p>

        <h3 className={fr.cx("fr-mt-4w")}>Deux constats majeurs</h3>
        <ol>
          <li>
            La terminologie &quot;Projet&quot; est employée à des niveaux très différents (stratégiques comme
            opérationnels). Ce mot &quot;fourre-tout&quot; fait toutefois partie de l&apos;usage des différents acteurs
            et cet usage sera compliqué à modifier.
          </li>
          <li>
            La terminologie &quot;Action&quot;, même si elle est souvent comprise comme une volonté politique pour
            atteindre un objectif lié à une thématique précise sur un territoire, est parfois utilisée de manière
            opérationnelle.
          </li>
        </ol>
        <p>
          Notre ambition ici est d&apos;abord de proposer un vocabulaire de référence pour faciliter l&apos;intégration
          des différentes plateformes numériques entre elles, pour ensuite fluidifier le parcours des bénéficiaires
          finaux : les collectivités territoriales.
        </p>

        <h3 className={fr.cx("fr-mt-4w")}>Exemple de définitions recueillies</h3>
        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters", "fr-mt-2w")}>
          {quotes.map((quote, index) => (
            <div key={index} className={fr.cx("fr-col-12", "fr-col-md-6")}>
              <Quote {...quote} />
            </div>
          ))}
        </div>

        {/* Section Émergence d'un parcours commun */}
        <h3 className={fr.cx("fr-mt-6w")}>Émergence d&apos;un parcours commun</h3>
        <p>
          Les entretiens menés avec les collectivités territoriales démontrent une logique commune en plusieurs étapes :
        </p>
        <ol>
          <li>
            Réalisation d&apos;un diagnostic sur le territoire pour faire un état des lieux de l&apos;existant et
            identifier les opportunités
          </li>
          <li>Définition d&apos;une stratégie de territoire sur plusieurs années autour de thématiques et objectifs</li>
          <li>Déclinaison de cette stratégie en souhaits d&apos;actions à accomplir sur le territoire</li>
          <li>Mise en place opérationnelle de ces actions</li>
          <li>Suivi des indicateurs et bilan stratégique</li>
        </ol>

        <div
          className={fr.cx("fr-mt-3w")}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "1px",
          }}
        >
          <FlowStep label="Diagnostic" />
          <FlowStep label="Stratégie" />
          <FlowStep label="Objectifs" />
          <FlowStep label="Actions" />
          <FlowStep label="Opérationnel" />
          <FlowStep label="Bilan" isLast />
        </div>

        {/* Séparateur */}
        <hr
          className={fr.cx("fr-mt-6w")}
          style={{
            border: "none",
            borderTop: "3px solid var(--border-action-high-blue-france)",
          }}
        />

        {/* Section Définitions */}
        <h2 className={fr.cx("fr-mt-6w")}>Définitions des concepts et recommandations d&apos;usage</h2>
        <p>Voici les concepts de référence pour chacune de ces étapes :</p>

        <div
          className={fr.cx("fr-mt-3w")}
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            gap: "1px",
          }}
        >
          <FlowStep label="Diagnostic" />
          <FlowStep label="Plan" variant="filled" />
          <FlowStep label="Axes et Sous-Axes" variant="filled" />
          <FlowStep label="Actions" variant="filled" />
          <FlowStep label="Opérations" variant="filled" />
          <FlowStep label="Bilan" isLast />
        </div>

        {definitions.map((def, index) => (
          <DefinitionBlock key={index} {...def} />
        ))}
      </div>
    </div>
  );
}
