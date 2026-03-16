import React from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { Quote } from "@codegouvfr/react-dsfr/Quote";
import { FaqSection } from "../components/FaqSection";

// --- Simplified flow diagram for methodology page ---

function ParcoursDiagram() {
  const pills = [
    { label: "Diagnostic", x: 0, w: 130 },
    { label: "Stratégie", x: 180, w: 130 },
    { label: "Vœu politique", x: 360, w: 130 },
    { label: "Opérationnel", x: 540, w: 130 },
    { label: "Bilan", x: 720, w: 100 },
  ];
  const pH = 36;

  const pillStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "100px",
    backgroundColor: "#E8EDFF",
    color: "#000091",
    fontWeight: 500,
    fontSize: "14px",
    lineHeight: "20px",
    width: "100%",
    height: `${pH}px`,
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  };

  const dash = "4 4";
  const lineStyle = { stroke: "#000091", strokeWidth: 1, strokeDasharray: dash };

  const arrows = [
    { x1: 133, x2: 177 },
    { x1: 313, x2: 357 },
    { x1: 493, x2: 537 },
    { x1: 673, x2: 717 },
  ];

  return (
    <svg
      viewBox="0 0 820 36"
      width="100%"
      style={{ overflow: "visible", maxWidth: "820px" }}
      aria-label="Parcours commun : Diagnostic, Stratégie, Vœu politique, Opérationnel, Bilan"
    >
      <defs>
        <marker id="m-arrow" markerWidth="5" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M1 1L4 4L1 7" fill="none" stroke="#000091" strokeWidth="1" strokeLinecap="round" />
        </marker>
      </defs>

      {arrows.map((a, i) => (
        <line key={i} x1={a.x1} y1={pH / 2} x2={a.x2} y2={pH / 2} {...lineStyle} markerEnd="url(#m-arrow)" />
      ))}

      {pills.map((p) => (
        <foreignObject key={p.label} x={p.x} y={0} width={p.w} height={pH}>
          <div style={pillStyle}>{p.label}</div>
        </foreignObject>
      ))}
    </svg>
  );
}

// --- Main Component ---

export function Methodologie() {
  return (
    <div className={fr.cx("fr-container")} style={{ maxWidth: "960px", paddingTop: "24px", paddingBottom: "48px" }}>
      <Breadcrumb
        currentPageLabel="Résultats enquête"
        segments={[
          { label: "Ressources", linkProps: { href: "/ressources" } },
          { label: "Vocabulaire métier", linkProps: { href: "/ressources/vocabulaire" } },
        ]}
      />

      <h1>Vocabulaire de référence — transition écologique des collectivités</h1>

      <a
        className={fr.cx("fr-btn", "fr-btn--secondary", "fr-btn--sm", "fr-btn--icon-left", "fr-icon-arrow-left-line")}
        href="/ressources/vocabulaire"
        style={{ marginBottom: "32px" }}
      >
        Retour
      </a>

      <div style={{ display: "flex", flexDirection: "column", gap: "48px" }}>
        {/* ===================== COMMENT LES DEFINITIONS ONT-ELLES ETE ETABLIES ? ===================== */}
        <section style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <h2 style={{ margin: 0 }}>Comment les définitions ont-elles été établies ?</h2>
          <p style={{ margin: 0 }}>
            Nous avons mené une dizaine d&apos;interviews auprès de différents acteurs de la Transition Écologique des
            Collectivités (agents DDTM, agents de collectivités EPCI, membres d&apos;équipes produit de services
            numériques d&apos;État) pour mettre en lumière les concepts clés utilisés dans leur quotidien avec pour
            objectif de clarifier une vision partagée du parcours de création et suivi de « projets » liés à la
            transition écologique dans les collectivités.
          </p>

          {/* Deux constats majeurs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h5 style={{ margin: 0 }}>Deux constats majeurs</h5>
            <p style={{ margin: 0 }}>
              La terminologie «&nbsp;Projet&nbsp;» est employée à des niveaux très différents (stratégiques comme
              opérationnels). Ce mot «&nbsp;fourre-tout&nbsp;» fait toutefois partie de l&apos;usage des différents
              acteurs et cet usage sera compliqué à modifier.
            </p>
            <p style={{ margin: 0 }}>
              La terminologie «&nbsp;Action&nbsp;», même si elle est souvent comprise comme une volonté politique pour
              atteindre un objectif lié à une thématique précise sur un territoire, est parfois utilisée de manière
              opérationnelle.
            </p>
            <p style={{ margin: 0 }}>
              Notre ambition ici est d&apos;abord de proposer un vocabulaire de référence pour faciliter
              l&apos;intégration des différentes plateformes numériques entre elles, pour ensuite fluidifier le parcours
              des bénéficiaires finaux : les collectivités territoriales.
            </p>
          </div>

          {/* Exemple de définitions recueillies */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <h5 style={{ margin: 0 }}>Exemple de définitions recueillies</h5>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "40px" }}>
              <Quote
                text={
                  <>
                    L&apos;<span style={{ color: "#6A6AF4" }}>action</span> c&apos;est le niveau le plus bas de
                    déclinaison du projet de territoire ; elle peut être déclinée en sous-opérations selon les
                    dispositifs de financement.
                  </>
                }
                author="Directrice de projets, CC Perpignan Méditerranée"
              />
              <Quote
                text={
                  <>
                    L&apos;<span style={{ color: "#6A6AF4" }}>action</span>, c&apos;est ce que l&apos;on souhaite faire,
                    c&apos;est sur le papier, c&apos;est une fiche, un vœu pieu.
                  </>
                }
                author="Chargée de mission TE - CC Creuse Sud-Ouest"
              />
              <Quote
                text={
                  <>
                    Un <span style={{ color: "#FA794A" }}>projet</span> est une intention politique validée, inscrite
                    dans un cadre politique (projet de territoire, CRTE, etc.), mais sans commencement d&apos;exécution.
                  </>
                }
                author="Chargée des contractualisations territoriales, EPCI"
              />
              <Quote
                text={
                  <>
                    Un <span style={{ color: "#FA794A" }}>projet</span>, c&apos;est la réalisation d&apos;une fiche
                    action. C&apos;est un chantier mobilisant un ou plusieurs acteurs, nécessitant un pilote clair et
                    des rôles définis.
                  </>
                }
                author="Directrice de projets, CC Perpignan Méditerranée"
              />
            </div>
          </div>

          {/* Émergence d'un parcours commun */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h5 style={{ margin: 0 }}>Émergence d&apos;un parcours commun</h5>
            <p style={{ margin: 0 }}>
              Les entretiens menés avec les collectivités territoriales démontrent une logique commune en plusieurs
              étapes :
            </p>
            <ol style={{ margin: 0 }}>
              <li>
                Réalisation d&apos;un <strong>diagnostic</strong> sur le territoire pour faire un état des lieux de
                l&apos;existant et identifier les opportunités
              </li>
              <li>
                Définition d&apos;une <strong>stratégie</strong> de territoire sur plusieurs années autour de
                thématiques et objectifs
              </li>
              <li>
                Déclinaison de cette stratégie en souhaits <strong>d&apos;actions</strong> à accomplir sur le territoire
              </li>
              <li>
                Mise en place <strong>opérationnelle</strong> de ces actions
              </li>
              <li>
                Suivi des indicateurs et <strong>bilan</strong> stratégique
              </li>
            </ol>
            <ParcoursDiagram />
          </div>

          {/* Résultats */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h5 style={{ margin: 0 }}>Résultats : un glossaire de référence en évolution</h5>
            <p className={fr.cx("fr-text--lg")} style={{ margin: 0 }}>
              Le glossaire s&apos;adresse aux équipes produit qui conçoivent des outils numériques dans le domaine de la
              transition écologique. Il permet d&apos;aligner les terminologies entre plateformes et avec les
              collectivités.
            </p>
            <a
              className={fr.cx("fr-btn", "fr-btn--icon-right", "fr-icon-arrow-right-line")}
              href="/ressources/vocabulaire"
            >
              Consulter le glossaire de référence
            </a>
          </div>
        </section>

        {/* ===================== FAQ ===================== */}
        <section style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={{ margin: 0 }}>Foire aux questions</h2>
          <FaqSection />
        </section>

        {/* Bottom back button */}
        <a
          className={fr.cx("fr-btn", "fr-btn--secondary", "fr-btn--sm", "fr-btn--icon-left", "fr-icon-arrow-left-line")}
          href="/ressources/vocabulaire"
        >
          Retour
        </a>
      </div>
    </div>
  );
}
