import React from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { Quote } from "@codegouvfr/react-dsfr/Quote";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";

// --- Flow Diagram Components ---

function ContextFlowDiagram() {
  // Horizontal flow: Diagnostic → Stratégie → Actions → Opérationnel → Bilan
  // Positions measured from Figma reference (960x40)
  const pills = [
    { label: "Diagnostic", x: 0, w: 154 },
    { label: "Stratégie", x: 206, w: 154 },
    { label: "Actions", x: 412, w: 154 },
    { label: "Opérationnel", x: 618, w: 136 },
    { label: "Bilan", x: 806, w: 154 },
  ];
  const pH = 40;

  const pillStyle: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "100px",
    backgroundColor: "#E8EDFF",
    color: "#000091",
    fontWeight: 500,
    fontSize: "16px",
    lineHeight: "24px",
    width: "100%",
    height: `${pH}px`,
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  };

  const dash = "4 4";
  const lineStyle = { stroke: "#000091", strokeWidth: 1, strokeDasharray: dash };

  // Arrow positions (between pills)
  const arrows = [
    { x1: 157, x2: 203 },
    { x1: 363, x2: 409 },
    { x1: 569, x2: 615 },
    { x1: 757, x2: 803 },
  ];

  return (
    <svg
      viewBox="0 0 960 40"
      width="100%"
      style={{ overflow: "visible", maxWidth: "960px" }}
      aria-label="Parcours commun : Diagnostic, Stratégie, Actions, Opérationnel, Bilan"
    >
      <defs>
        <marker id="ctx-arrow" markerWidth="5" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M1 1L4 4L1 7" fill="none" stroke="#000091" strokeWidth="1" strokeLinecap="round" />
        </marker>
      </defs>

      {/* Dashed arrows */}
      {arrows.map((a, i) => (
        <line key={i} x1={a.x1} y1={pH / 2} x2={a.x2} y2={pH / 2} {...lineStyle} markerEnd="url(#ctx-arrow)" />
      ))}

      {/* Pills */}
      {pills.map((p) => (
        <foreignObject key={p.label} x={p.x} y={0} width={p.w} height={pH}>
          <div style={pillStyle}>{p.label}</div>
        </foreignObject>
      ))}
    </svg>
  );
}

function DefinitionsFlowDiagram() {
  // Three-row SVG flow diagram matching the Figma layout:
  //
  // Top row:                 [          Financement          ]
  //                                ↕                   ↕
  // Mid row: [Diagnostic] → [Plan] → [  Actions  ] ↔ [  Opérations  ] → [Bilan]
  //                                    ↕  ↕  ↕         ↕    ↕
  // Bot row:        [levier 1] [levier 2] [axe 1] [compétence 1] [compétence 2]

  const pillBase: React.CSSProperties = {
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: "100px",
    fontWeight: 500,
    fontSize: "16px",
    lineHeight: "24px",
    padding: "8px 16px",
    width: "100%",
    boxSizing: "border-box",
    whiteSpace: "nowrap",
  };

  const tagStyle: React.CSSProperties = {
    display: "inline-flex",
    justifyContent: "center",
    alignItems: "center",
    padding: "8px 16px",
    borderRadius: "100px",
    backgroundColor: "#FFFFFF",
    border: "1px solid #0000FF",
    color: "#0000FF",
    fontSize: "16px",
    fontWeight: 500,
    lineHeight: "24px",
    whiteSpace: "nowrap",
  };

  // Y positions — matched to reference crop pixel measurements
  const yFin = 20;
  const yMain = 103;
  const yTags = 193;
  const pH = 40;

  // X positions — from Figma pixel analysis
  const xDiag = 55;
  const xPlan = 197;
  const xAct = 453;
  const xOps = 657;
  const xBil = 924;
  const xFin = 560;

  // Pill widths — from Figma design specs (fixed sizes)
  const wDiag = 110;
  const wPlan = 70;
  const wFin = 361;
  const wAct = 144;
  const wOps = 164;
  const wBil = 60;

  const dash = "4 4";
  const lineStyle = { stroke: "#000091", strokeWidth: 1, strokeDasharray: dash };
  const mkEnd = "url(#flow-arrow-end)";
  const mkStart = "url(#flow-arrow-start)";

  // Tag center X positions — from reference pixel measurements
  const tLevier1 = 309;
  const tLevier2 = 408;
  const tAxe1 = 507;
  const tComp1 = 632;
  const tComp2 = 785;

  return (
    <svg
      viewBox="0 0 960 245"
      width="100%"
      style={{ overflow: "visible", maxWidth: "960px" }}
      aria-label="Schéma conceptuel : Plan, Action, Opération avec Financement transversal"
    >
      <defs>
        <marker id="flow-arrow-end" markerWidth="5" markerHeight="8" refX="4" refY="4" orient="auto">
          <path d="M1 1L4 4L1 7" fill="none" stroke="#000091" strokeWidth="1" strokeLinecap="round" />
        </marker>
        <marker id="flow-arrow-start" markerWidth="5" markerHeight="8" refX="1" refY="4" orient="auto-start-reverse">
          <path d="M1 1L4 4L1 7" fill="none" stroke="#000091" strokeWidth="1" strokeLinecap="round" />
        </marker>
      </defs>

      {/* === Horizontal dashed arrows === */}
      {/* Diagnostic → Plan (one-directional) */}
      <line
        x1={xDiag + wDiag / 2 + 3}
        y1={yMain}
        x2={xPlan - wPlan / 2 - 3}
        y2={yMain}
        {...lineStyle}
        markerEnd={mkEnd}
      />
      {/* Plan → Actions (one-directional) */}
      <line
        x1={xPlan + wPlan / 2 + 3}
        y1={yMain}
        x2={xAct - wAct / 2 - 3}
        y2={yMain}
        {...lineStyle}
        markerEnd={mkEnd}
      />
      {/* Actions ↔ Opérations (bidirectional) */}
      <line
        x1={xAct + wAct / 2 + 6}
        y1={yMain}
        x2={xOps - wOps / 2 - 3}
        y2={yMain}
        {...lineStyle}
        markerStart={mkStart}
        markerEnd={mkEnd}
      />
      {/* Opérations → Bilan (one-directional) */}
      <line x1={xOps + wOps / 2 + 3} y1={yMain} x2={xBil - wBil / 2 - 3} y2={yMain} {...lineStyle} markerEnd={mkEnd} />

      {/* === Financement ↔ Actions / Opérations (vertical, bidirectional) === */}
      <line
        x1={xAct}
        y1={yFin + pH / 2 + 5}
        x2={xAct}
        y2={yMain - pH / 2 - 2}
        {...lineStyle}
        markerStart={mkStart}
        markerEnd={mkEnd}
      />
      <line
        x1={xOps}
        y1={yFin + pH / 2 + 5}
        x2={xOps}
        y2={yMain - pH / 2 - 2}
        {...lineStyle}
        markerStart={mkStart}
        markerEnd={mkEnd}
      />

      {/* === Tags → Actions (3 connectors, arrow pointing up toward Actions) === */}
      <line x1={396} y1={yMain + pH / 2 + 5} x2={344} y2={yTags - pH / 2 - 2} {...lineStyle} markerStart={mkStart} />
      <line x1={431} y1={yMain + pH / 2 + 5} x2={431} y2={yTags - pH / 2 - 2} {...lineStyle} markerStart={mkStart} />
      <line x1={466} y1={yMain + pH / 2 + 5} x2={495} y2={yTags - pH / 2 - 2} {...lineStyle} markerStart={mkStart} />

      {/* === Tags → Opérations (3 connectors, arrow pointing up toward Opérations) === */}
      <line x1={582} y1={yMain + pH / 2 + 5} x2={544} y2={yTags - pH / 2 - 2} {...lineStyle} markerStart={mkStart} />
      <line x1={645} y1={yMain + pH / 2 + 5} x2={645} y2={yTags - pH / 2 - 2} {...lineStyle} markerStart={mkStart} />
      <line x1={706} y1={yMain + pH / 2 + 5} x2={747} y2={yTags - pH / 2 - 2} {...lineStyle} markerStart={mkStart} />

      {/* === Pills === */}
      <foreignObject x={xFin - wFin / 2} y={yFin - pH / 2} width={wFin} height={pH + 4}>
        <div style={{ ...pillBase, backgroundColor: "#0000FF", color: "#FFFFFF", height: `${pH}px` }}>Financement</div>
      </foreignObject>

      <foreignObject x={xDiag - wDiag / 2} y={yMain - pH / 2} width={wDiag} height={pH + 4}>
        <div style={{ ...pillBase, backgroundColor: "#ECECFE", color: "#000091", height: `${pH}px` }}>Diagnostic</div>
      </foreignObject>
      <foreignObject x={xPlan - wPlan / 2} y={yMain - pH / 2} width={wPlan} height={pH + 4}>
        <div style={{ ...pillBase, backgroundColor: "#000091", color: "#FFFFFF", height: `${pH}px` }}>Plan</div>
      </foreignObject>
      <foreignObject x={xAct - wAct / 2} y={yMain - pH / 2} width={wAct} height={pH + 4}>
        <div style={{ ...pillBase, backgroundColor: "#0000FF", color: "#FFFFFF", height: `${pH}px` }}>Actions</div>
      </foreignObject>
      <foreignObject x={xOps - wOps / 2} y={yMain - pH / 2} width={wOps} height={pH + 4}>
        <div style={{ ...pillBase, backgroundColor: "#0000FF", color: "#FFFFFF", height: `${pH}px` }}>Opérations</div>
      </foreignObject>
      <foreignObject x={xBil - wBil / 2} y={yMain - pH / 2} width={wBil} height={pH + 4}>
        <div style={{ ...pillBase, backgroundColor: "#ECECFE", color: "#000091", height: `${pH}px` }}>Bilan</div>
      </foreignObject>

      {/* === Tags (individual foreignObjects for precise positioning) === */}
      <foreignObject x={tLevier1 - 44} y={yTags - pH / 2} width={89} height={pH + 4}>
        <div style={{ ...tagStyle, width: "100%", boxSizing: "border-box" }}>levier 1</div>
      </foreignObject>
      <foreignObject x={tLevier2 - 44} y={yTags - pH / 2} width={89} height={pH + 4}>
        <div style={{ ...tagStyle, width: "100%", boxSizing: "border-box" }}>levier 2</div>
      </foreignObject>
      <foreignObject x={tAxe1 - 44} y={yTags - pH / 2} width={89} height={pH + 4}>
        <div style={{ ...tagStyle, width: "100%", boxSizing: "border-box" }}>axe 1</div>
      </foreignObject>
      <foreignObject x={tComp1 - 69} y={yTags - pH / 2} width={138} height={pH + 4}>
        <div style={{ ...tagStyle, width: "100%", boxSizing: "border-box" }}>compétence 1</div>
      </foreignObject>
      <foreignObject x={tComp2 - 69} y={yTags - pH / 2} width={138} height={pH + 4}>
        <div style={{ ...tagStyle, width: "100%", boxSizing: "border-box" }}>compétence 2</div>
      </foreignObject>
    </svg>
  );
}

// --- Relation Tags ---

function RelationTag({ label, variant }: { label: string; variant: "filled" | "outlined" }) {
  const style: React.CSSProperties =
    variant === "filled"
      ? {
          display: "inline-flex",
          padding: "4px 8px",
          borderRadius: "100px",
          backgroundColor: "#0000FF",
          color: "#FFFFFF",
          fontSize: "16px",
          fontWeight: 500,
          lineHeight: "24px",
          whiteSpace: "nowrap",
        }
      : {
          display: "inline-flex",
          padding: "4px 8px",
          borderRadius: "100px",
          backgroundColor: "#FFFFFF",
          border: "1px solid #0000FF",
          color: "#0000FF",
          fontSize: "16px",
          fontWeight: 500,
          lineHeight: "24px",
          whiteSpace: "nowrap",
        };

  return <span style={style}>{label}</span>;
}

// --- Definition Card Building Blocks ---

function DefinitionCardWrapper({
  title,
  borderColor = "#E3E3FD",
  children,
}: {
  title: string;
  borderColor?: string;
  children: React.ReactNode;
}) {
  return (
    <div
      style={{
        backgroundColor: "#FAFAFF",
        border: `1px solid ${borderColor}`,
        borderRadius: "10px",
        padding: "16px",
        display: "flex",
        flexDirection: "column",
        gap: "24px",
        flex: 1,
        minWidth: 0,
      }}
    >
      <h5 style={{ margin: 0 }}>{title}</h5>
      {children}
    </div>
  );
}

function CardSection({ label, children, gap = "8px" }: { label: string; children: React.ReactNode; gap?: string }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap }}>
      <p className={fr.cx("fr-text--lg")} style={{ fontWeight: 500, margin: 0 }}>
        {label}
      </p>
      {children}
    </div>
  );
}

function TagsRow({ tags }: { tags: { label: string; variant: "filled" | "outlined" }[] }) {
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: "16px" }}>
      {tags.map((tag) => (
        <RelationTag key={tag.label} {...tag} />
      ))}
    </div>
  );
}

// --- Main Component ---

export function Vocabulaire() {
  return (
    <div className={fr.cx("fr-container")} style={{ maxWidth: "960px", paddingTop: "24px", paddingBottom: "48px" }}>
      <Breadcrumb
        currentPageLabel="Vocabulaire métier"
        segments={[{ label: "Ressources", linkProps: { href: "/ressources" } }]}
      />

      <h1>Vocabulaire métier</h1>
      <p className={fr.cx("fr-text--lead")}>
        Glossaire des termes utilisés dans le domaine de la transition écologique des collectivités.
      </p>

      {/* Corps de page — 56px gap between major sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "56px", marginTop: "24px" }}>
        {/* ===================== CONTEXTE ===================== */}
        <section style={{ display: "flex", flexDirection: "column", gap: "36px" }}>
          {/* Heading + intro */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0 }}>Contexte</h2>
            <p style={{ margin: 0 }}>
              Nous avons mené une dizaine d&apos;interviews auprès de différents acteurs de la Transition Écologique des
              Collectivités (agents DDTM, agents de collectivités EPCI, membres d&apos;équipes produit de services
              numériques d&apos;État) pour mettre en lumière les concepts clés utilisés dans leur quotidien avec pour
              objectif de clarifier une vision partagée du parcours de création et suivi de « projets » liés à la
              transition écologique dans les collectivités.
            </p>
          </div>

          {/* Deux constats majeurs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h5 style={{ margin: 0 }}>Deux constats majeurs</h5>
            <ol style={{ margin: 0 }}>
              <li>
                La terminologie «&nbsp;Projet&nbsp;» est employée à des niveaux très différents (stratégiques comme
                opérationnels). Ce mot «&nbsp;fourre-tout&nbsp;» fait toutefois partie de l&apos;usage des différents
                acteurs et cet usage sera compliqué à modifier.
              </li>
              <li>
                La terminologie «&nbsp;Action&nbsp;», même si elle est souvent comprise comme une volonté politique pour
                atteindre un objectif lié à une thématique précise sur un territoire, est parfois utilisée de manière
                opérationnelle.
              </li>
            </ol>
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
            <ContextFlowDiagram />
          </div>
        </section>

        {/* ===================== DEFINITIONS ===================== */}
        <section style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {/* Heading + intro */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ margin: 0 }}>Définitions des concepts et recommandations d&apos;usage</h2>
            <p style={{ margin: 0 }}>
              Ce cadre conceptuel, ainsi restructuré, offre une hiérarchie plus épurée (Plan → Action → Opération) tout
              en laissant de la souplesse aux collectivités pour leur structuration interne, et en introduisant le
              financement comme une dimension transversale explicitement modélisée :
            </p>
          </div>

          <DefinitionsFlowDiagram />

          {/* --- Plan (full width) --- */}
          <DefinitionCardWrapper title="Plan" borderColor="#ECECFE">
            <CardSection label="Définition">
              <p style={{ margin: 0 }}>
                Document stratégique qui définit, sur un horizon temporel déterminé, les orientations, objectifs et
                actions que se fixe une collectivité territoriale pour organiser et développer son territoire de manière
                cohérente. Il traduit une vision partagée du devenir du territoire en tenant compte de ses enjeux
                (aménagement, développement économique, transition écologique, cohésion sociale, etc.), des besoins de
                ses habitants et des ressources disponibles. Le plan établit généralement des priorités, identifie les
                moyens de mise en œuvre et définit des indicateurs de suivi et d&apos;évaluation.
              </p>
            </CardSection>
            <CardSection label="Recommandations d'usage" gap="16px">
              <p style={{ margin: 0 }}>Plan de territoire ;</p>
            </CardSection>
          </DefinitionCardWrapper>

          {/* --- Action + Opération (side by side) --- */}
          <div style={{ display: "flex", gap: "24px", alignItems: "stretch" }}>
            <DefinitionCardWrapper title="Action">
              <CardSection label="Définition">
                <p style={{ margin: 0 }}>
                  Expression d&apos;une volonté politique qui décrit ce que la collectivité territoriale souhaite
                  entreprendre pour atteindre un objectif de son plan de territoire. Elle traduit une intention
                  stratégique en précisant la nature de l&apos;intervention envisagée, son périmètre d&apos;application
                  et les finalités recherchées, sans entrer dans les modalités opérationnelles de mise en œuvre.
                  L&apos;action constitue le lien entre l&apos;ambition portée par les orientations du plan et sa
                  déclinaison concrète à travers des opérations.
                </p>
                <p style={{ margin: 0 }}>
                  Pour faciliter l&apos;interopérabilité entre plateformes, les actions sont qualifiées par des tags
                  thématiques communs (ex. mobilité douce, biodiversité, rénovation énergétique...) qui se substituent à
                  la notion d&apos;axes, propre à chaque collectivité.
                </p>
              </CardSection>
              <CardSection label="Relations" gap="16px">
                <p style={{ margin: 0 }}>
                  Une action se décline en une ou plusieurs opérations ; une même opération peut être rattachée à
                  plusieurs actions (relation N-N). Une action peut être financée par un ou plusieurs financements ; un
                  même financement peut couvrir plusieurs actions (relation N-N).
                </p>
                <TagsRow
                  tags={[
                    { label: "financement", variant: "filled" },
                    { label: "opération", variant: "filled" },
                    { label: "leviers", variant: "outlined" },
                    { label: "axes", variant: "outlined" },
                    { label: "compétences", variant: "outlined" },
                  ]}
                />
              </CardSection>
              <CardSection label="Recommandations d'usage" gap="16px">
                <p style={{ margin: 0 }}>Fiche Action ;</p>
              </CardSection>
            </DefinitionCardWrapper>

            <DefinitionCardWrapper title="Opération">
              <CardSection label="Définition">
                <p style={{ margin: 0 }}>
                  Déclinaison opérationnelle et structurée d&apos;une action, qui définit précisément une des modalités
                  de sa réalisation concrète sur le territoire. Elle détaille les moyens engagés (budget, ressources
                  humaines, techniques), identifie les acteurs et leurs rôles respectifs, établit un calendrier précis
                  et définit des livrables attendus. L&apos;opération constitue l&apos;unité de gestion et de pilotage
                  qui permet la mise en œuvre effective de la volonté politique exprimée dans l&apos;action.
                </p>
              </CardSection>
              <CardSection label="Relations" gap="16px">
                <p style={{ margin: 0 }}>
                  Une opération peut contribuer à la mise en œuvre d&apos;une ou plusieurs actions ; une même action
                  peut se décliner en plusieurs opérations (relation N-N). Une opération peut être financée par un ou
                  plusieurs financements ; un même financement peut couvrir plusieurs opérations (relation N-N).
                </p>
                <TagsRow
                  tags={[
                    { label: "financement", variant: "filled" },
                    { label: "action", variant: "filled" },
                    { label: "leviers", variant: "outlined" },
                    { label: "axes", variant: "outlined" },
                    { label: "compétences", variant: "outlined" },
                  ]}
                />
              </CardSection>
              <CardSection label="Recommandations d'usage" gap="16px">
                <p style={{ margin: 0 }}>Projet opérationnel ;</p>
              </CardSection>
            </DefinitionCardWrapper>
          </div>

          {/* --- Financement + Leviers (full width, stacked) --- */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <DefinitionCardWrapper title="Financement">
              <CardSection label="Définition">
                <p style={{ margin: 0 }}>
                  Dispositif ou source de financement mobilisé pour soutenir la réalisation d&apos;une ou plusieurs
                  actions ou opérations. Il peut prendre la forme d&apos;une subvention, d&apos;un fonds propre,
                  d&apos;un contrat de financement européen, national ou régional (CRTE, DETR, FEDER, etc.), ou de tout
                  autre mécanisme de soutien financier. Le financement est caractérisé par son origine, son montant, ses
                  conditions d&apos;éligibilité et son calendrier de versement.
                </p>
              </CardSection>
              <CardSection label="Relations" gap="16px">
                <p style={{ margin: 0 }}>
                  Un financement peut soutenir une ou plusieurs actions et/ou opérations ; une action ou opération peut
                  être soutenue par plusieurs financements (relation N-N).
                </p>
                <TagsRow
                  tags={[
                    { label: "action", variant: "filled" },
                    { label: "opération", variant: "filled" },
                  ]}
                />
              </CardSection>
              <CardSection label="Recommandations d'usage" gap="16px">
                <p style={{ margin: 0 }}>Dispositif de financement ; Subvention ; Contractualisation</p>
              </CardSection>
            </DefinitionCardWrapper>

            <DefinitionCardWrapper title="Leviers, axes et compétences">
              <CardSection label="Définition">
                <p style={{ margin: 0 }}>
                  Plusieurs référentiels sont utilisés pour catégoriser et standardiser les données des projets :
                </p>
                <ol style={{ margin: 0 }}>
                  <li>
                    <strong>Référentiel des compétences M57</strong> : Liste hiérarchique des compétences et
                    sous-compétences des collectivités selon la nomenclature M57. Les compétences ont un code du type :
                    90-XY, et les sous-compétences 90-XYZ
                  </li>
                  <li>
                    <strong>Référentiel des leviers de transition écologique</strong> : Liste des leviers SGPE
                    disponibles et leur description pour les projets de transition écologique.
                  </li>
                  <li>
                    <strong>Axes</strong> (souvent appelé thématique ou chantier) : désigne une grande orientation
                    sectorielle ou transversale structurant un plan. Concrètement, le plan «&nbsp;France Nation
                    Verte&nbsp;» s&apos;organise autour de 6 thématiques (se déplacer, se loger, se nourrir, produire et
                    travailler, consommer, préserver) déclinées en 22 chantiers d&apos;action.
                  </li>
                </ol>
              </CardSection>
              <CardSection label="Relations" gap="16px">
                <p style={{ margin: 0 }}>
                  Ces métadonnées issues de référentiels viennent nourrir de manière unilatérale les concepts
                  d&apos;actions et d&apos;opérations. Une action peut avoir N leviers, N compétences, N axes... et
                  inversement, un levier/axe/compétences peut être lié à N actions ou opérations.
                </p>
                <TagsRow
                  tags={[
                    { label: "action", variant: "filled" },
                    { label: "opération", variant: "filled" },
                  ]}
                />
              </CardSection>
              <CardSection label="Recommandations d'usage" gap="16px">
                <p style={{ margin: 0 }}>Leviers ;</p>
              </CardSection>
            </DefinitionCardWrapper>
          </div>

          {/* --- Callout about Axes --- */}
          <CallOut
            colorVariant="yellow-tournesol"
            title="Note sur les Axes et Sous-Axes (aujourd'hui utilisés dans Territoires en Transitions) :"
            titleAs="h5"
          >
            À l&apos;issue des travaux, un consensus s&apos;est dégagé sur le fait que les axes et sous-axes relèvent
            d&apos;une structuration propre à chaque collectivité. Ils constituent des outils de navigation interne
            plutôt que des outils de pilotage partagé, et ne se prêtent pas à une standardisation inter-opérable. La
            valeur pour l&apos;interopérabilité repose plutôt sur des métadonnées / tags thématiques communs rattachés
            aux actions, laissant chaque collectivité libre d&apos;organiser ses axes selon sa propre logique.
          </CallOut>
        </section>
      </div>
    </div>
  );
}
