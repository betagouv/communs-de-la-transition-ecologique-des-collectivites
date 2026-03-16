import React from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";
import { Summary } from "@codegouvfr/react-dsfr/Summary";
import { Table } from "@codegouvfr/react-dsfr/Table";
import { CallOut } from "@codegouvfr/react-dsfr/CallOut";
import "@codegouvfr/react-dsfr/dsfr/utility/icons/icons-business/icons-business.min.css";
import "@codegouvfr/react-dsfr/dsfr/utility/icons/icons-development/icons-development.min.css";
import "@codegouvfr/react-dsfr/dsfr/utility/icons/icons-editor/icons-editor.min.css";
import "@codegouvfr/react-dsfr/dsfr/utility/icons/icons-media/icons-media.min.css";
import "@codegouvfr/react-dsfr/dsfr/utility/icons/icons-system/icons-system.min.css";
import { SchemaConceptuel } from "../components/SchemaConceptuel";
import { FaqSection } from "../components/FaqSection";

// --- Reusable building blocks ---

function RelationTag({ label, variant }: { label: string; variant: "filled" | "outlined" | "light" }) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    padding: "2px 8px",
    borderRadius: "100px",
    fontSize: "14px",
    fontWeight: 500,
    lineHeight: "20px",
    whiteSpace: "nowrap",
  };
  const style: React.CSSProperties =
    variant === "filled"
      ? { ...base, backgroundColor: "#000091", color: "#FFFFFF" }
      : variant === "light"
        ? { ...base, backgroundColor: "#E3E3FD", color: "#000091" }
        : { ...base, backgroundColor: "#FFFFFF", border: "1px solid #000091", color: "#000091" };

  return <span style={style}>{label}</span>;
}

function TagsRow({ tags }: { tags: { label: string; variant: "filled" | "outlined" | "light" }[] }) {
  return (
    <span style={{ display: "inline-flex", flexWrap: "wrap", gap: "6px" }}>
      {tags.map((tag) => (
        <RelationTag key={tag.label} {...tag} />
      ))}
    </span>
  );
}

// --- Definition Card (new enriched format) ---

interface DefinitionField {
  icon?: string; // optional — Définition field has no icon
  label: string;
  content: React.ReactNode;
}

function DefinitionCard({ title, fields }: { title: string; fields: DefinitionField[] }) {
  return (
    <div
      style={{
        backgroundColor: "#ECECFE",
        border: "1px solid #E3E3FD",
        borderRadius: "10px",
        padding: "24px",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        flex: 1,
        minWidth: 0,
        color: "#161616",
      }}
    >
      <h5 style={{ margin: 0, color: "#000091" }}>{title}</h5>
      {fields.map((field) =>
        field.icon ? (
          // Fields with icon: inline layout — icon + "Label : content" (content in gray)
          <div key={field.label} style={{ display: "flex", gap: "10px", alignItems: "center", flexWrap: "wrap" }}>
            <span
              className={fr.cx(field.icon as never)}
              style={{ flexShrink: 0, color: "#000091" }}
              aria-hidden="true"
            />
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{field.label}</span>
            <span style={{ fontSize: "14px", color: "#161616" }}>:</span>
            <span style={{ fontSize: "14px", lineHeight: "22px", color: "#666666" }}>{field.content}</span>
          </div>
        ) : (
          // Definition field (no icon): label then paragraph below
          <div key={field.label}>
            <span style={{ fontWeight: 600, fontSize: "14px" }}>{field.label}</span>
            <div style={{ fontSize: "14px", lineHeight: "22px", marginTop: "4px" }}>{field.content}</div>
          </div>
        ),
      )}
    </div>
  );
}

// --- Example Diagram (Nantes PCAET - adapted terminology) ---
// Layout with colored group backgrounds matching mermaid subgraphs

function ExempleDiagram() {
  const boxStyle = (bg: string, border: string): React.CSSProperties => ({
    backgroundColor: bg,
    border: `2px solid ${border}`,
    borderRadius: "8px",
    padding: "10px 14px",
    fontSize: "13px",
    lineHeight: "18px",
    width: "100%",
    boxSizing: "border-box",
    color: "#161616",
  });

  // --- Y layout constants ---
  const gPad = 12; // padding inside group rect
  const labelH = 18; // label area height
  const boxH = 56; // box height (enough for 2-line text with padding)
  const arrowGap = 24; // gap between groups

  // Group Y positions and heights
  const g1Y = 0; // Plan de transition
  const g1H = gPad + labelH + boxH + gPad; // 98
  const g2Y = g1Y + g1H + arrowGap; // 122 — Fiche action
  const g2H = g1H; // 98
  const g3Y = g2Y + g2H + arrowGap; // 244 — Projets opérationnels
  const g3H = g1H; // 98
  const g4Y = g3Y + g3H + arrowGap; // 366 — Financements
  const g4H = gPad + labelH + boxH + 8 + boxH + gPad; // 162

  // Content Y offsets (label + padding before first box)
  const contentDy = gPad + labelH; // 30
  const labelDy = gPad + 12; // 24 (text baseline)

  const totalH = g4Y + g4H; // 528

  // Financing row 2 Y
  const g4Row2Y = g4Y + contentDy + boxH + 8; // 460

  return (
    <div
      style={{
        border: "1px solid #E3E3FD",
        borderRadius: "10px",
        padding: "24px",
        backgroundColor: "#FAFAFF",
        overflow: "auto",
        color: "#161616",
      }}
    >
      <svg
        viewBox={`0 0 780 ${totalH}`}
        width="100%"
        style={{ overflow: "visible", maxWidth: "780px", display: "block", margin: "0 auto" }}
        aria-label="Exemple concret : PCAET Nantes Métropole avec fiche action, projets opérationnels et financements"
      >
        <defs>
          <marker id="ex-arrow" markerWidth="5" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M1 1L4 4L1 7" fill="none" stroke="#9999CC" strokeWidth="1.5" strokeLinecap="round" />
          </marker>
        </defs>

        {/* === Group backgrounds (drawn first, behind everything) === */}
        <rect
          x={140}
          y={g1Y}
          width={500}
          height={g1H}
          rx={10}
          fill="#e3f2fd"
          fillOpacity={0.35}
          stroke="#1565c0"
          strokeOpacity={0.4}
          strokeWidth={1}
        />
        <rect
          x={90}
          y={g2Y}
          width={600}
          height={g2H}
          rx={10}
          fill="#fff3e0"
          fillOpacity={0.35}
          stroke="#e65100"
          strokeOpacity={0.4}
          strokeWidth={1}
        />
        <rect
          x={5}
          y={g3Y}
          width={770}
          height={g3H}
          rx={10}
          fill="#e8f5e9"
          fillOpacity={0.35}
          stroke="#2e7d32"
          strokeOpacity={0.4}
          strokeWidth={1}
        />
        <rect
          x={5}
          y={g4Y}
          width={770}
          height={g4H}
          rx={10}
          fill="#fce4ec"
          fillOpacity={0.35}
          stroke="#c62828"
          strokeOpacity={0.4}
          strokeWidth={1}
        />

        {/* === Group labels === */}
        <text
          x={156}
          y={g1Y + labelDy}
          fontSize="12"
          fontWeight="600"
          fill="#1565c0"
          fontFamily="Marianne, Arial, sans-serif"
        >
          Plan de transition
        </text>
        <text
          x={106}
          y={g2Y + labelDy}
          fontSize="12"
          fontWeight="600"
          fill="#e65100"
          fontFamily="Marianne, Arial, sans-serif"
        >
          Fiche action
        </text>
        <text
          x={21}
          y={g3Y + labelDy}
          fontSize="12"
          fontWeight="600"
          fill="#2e7d32"
          fontFamily="Marianne, Arial, sans-serif"
        >
          Projets opérationnels
        </text>
        <text
          x={21}
          y={g4Y + labelDy}
          fontSize="12"
          fontWeight="600"
          fill="#c62828"
          fontFamily="Marianne, Arial, sans-serif"
        >
          Financements
        </text>

        {/* === Arrows === */}
        {/* Plan → Fiche action */}
        <line
          x1={390}
          y1={g1Y + contentDy + boxH + 2}
          x2={390}
          y2={g2Y + contentDy - 2}
          stroke="#9999CC"
          strokeWidth="1.5"
          markerEnd="url(#ex-arrow)"
        />
        {/* Fiche action → Projet 1 (diagonal left) */}
        <line
          x1={300}
          y1={g2Y + contentDy + boxH + 2}
          x2={190}
          y2={g3Y + contentDy - 2}
          stroke="#9999CC"
          strokeWidth="1.5"
          markerEnd="url(#ex-arrow)"
        />
        {/* Fiche action → Projet 2 (diagonal right) */}
        <line
          x1={480}
          y1={g2Y + contentDy + boxH + 2}
          x2={587}
          y2={g3Y + contentDy - 2}
          stroke="#9999CC"
          strokeWidth="1.5"
          markerEnd="url(#ex-arrow)"
        />
        {/* Projet 1 → Fonds Vert (vertical) */}
        <line
          x1={102}
          y1={g3Y + contentDy + boxH + 2}
          x2={102}
          y2={g4Y + contentDy - 2}
          stroke="#9999CC"
          strokeWidth="1.5"
          markerEnd="url(#ex-arrow)"
        />
        {/* Projet 1 → ADEME (vertical) */}
        <line
          x1={280}
          y1={g3Y + contentDy + boxH + 2}
          x2={280}
          y2={g4Y + contentDy - 2}
          stroke="#9999CC"
          strokeWidth="1.5"
          markerEnd="url(#ex-arrow)"
        />
        {/* Projet 1 → Autofinancement (vertical, through gap between row 1 boxes) */}
        <line
          x1={170}
          y1={g3Y + contentDy + boxH + 2}
          x2={170}
          y2={g4Row2Y - 2}
          stroke="#9999CC"
          strokeWidth="1.5"
          markerEnd="url(#ex-arrow)"
        />
        {/* Projet 2 → DETR (vertical) */}
        <line
          x1={480}
          y1={g3Y + contentDy + boxH + 2}
          x2={480}
          y2={g4Y + contentDy - 2}
          stroke="#9999CC"
          strokeWidth="1.5"
          markerEnd="url(#ex-arrow)"
        />
        {/* Projet 2 → Autofinancement P2 (vertical) */}
        <line
          x1={672}
          y1={g3Y + contentDy + boxH + 2}
          x2={672}
          y2={g4Y + contentDy - 2}
          stroke="#9999CC"
          strokeWidth="1.5"
          markerEnd="url(#ex-arrow)"
        />

        {/* === Plan de transition === */}
        <foreignObject x={190} y={g1Y + contentDy} width={400} height={boxH}>
          <div style={boxStyle("#e3f2fd", "#1565c0")}>
            <strong>PCAET</strong> Nantes Métropole 2024-2030
          </div>
        </foreignObject>

        {/* === Fiche action === */}
        <foreignObject x={140} y={g2Y + contentDy} width={500} height={boxH}>
          <div style={boxStyle("#fff3e0", "#e65100")}>
            <strong>Rénover les bâtiments publics</strong> — Objectif : -40% consommation
          </div>
        </foreignObject>

        {/* === Projets opérationnels === */}
        <foreignObject x={15} y={g3Y + contentDy} width={350} height={boxH}>
          <div style={boxStyle("#e8f5e9", "#2e7d32")}>
            <strong>Rénovation gymnase M. Rouault</strong> · 850 k€ · En cours
          </div>
        </foreignObject>
        <foreignObject x={410} y={g3Y + contentDy} width={355} height={boxH}>
          <div style={boxStyle("#e8f5e9", "#2e7d32")}>
            <strong>Isolation école Jean Moulin</strong> · 320 k€ · À venir
          </div>
        </foreignObject>

        {/* === Financements — Projet 1 (left) === */}
        <foreignObject x={15} y={g4Y + contentDy} width={175} height={boxH}>
          <div style={boxStyle("#fce4ec", "#c62828")}>Fonds Vert · 350 k€</div>
        </foreignObject>
        <foreignObject x={200} y={g4Y + contentDy} width={160} height={boxH}>
          <div style={boxStyle("#fce4ec", "#c62828")}>ADEME · 200 k€</div>
        </foreignObject>
        <foreignObject x={55} y={g4Row2Y} width={230} height={boxH}>
          <div style={boxStyle("#fce4ec", "#c62828")}>Autofinancement · 300 k€</div>
        </foreignObject>

        {/* === Financements — Projet 2 (right) === */}
        <foreignObject x={400} y={g4Y + contentDy} width={160} height={boxH}>
          <div style={boxStyle("#fce4ec", "#c62828")}>DETR · 150 k€</div>
        </foreignObject>
        <foreignObject x={575} y={g4Y + contentDy} width={195} height={boxH}>
          <div style={boxStyle("#fce4ec", "#c62828")}>Autofinancement · 170 k€</div>
        </foreignObject>
      </svg>
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

      <h1>Vocabulaire de référence — transition écologique des collectivités</h1>

      <p style={{ margin: "0 0 8px", color: "#666666", fontSize: "14px" }}>Dernière mise à jour le 05 mars 2026</p>

      <Summary
        links={[
          { text: "Le parcours en un coup d\u2019\u0153il", linkProps: { href: "#parcours" } },
          { text: "Termes et définitions", linkProps: { href: "#definitions" } },
          { text: "Table de correspondance entre plateformes", linkProps: { href: "#correspondance" } },
          { text: "Foire aux questions", linkProps: { href: "#faq" } },
        ]}
      />

      <p className={fr.cx("fr-text--lg")} style={{ marginTop: "24px" }}>
        Ce glossaire s&apos;adresse aux équipes produit qui conçoivent des outils numériques dans le domaine de la
        transition écologique. Il permet d&apos;aligner les terminologies entre plateformes et avec les collectivités.
      </p>

      {/* Corps de page — 56px gap between major sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: "56px", marginTop: "32px" }}>
        {/* ===================== I. LE PARCOURS EN UN COUP D'ŒIL ===================== */}
        <section id="parcours" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={{ margin: 0 }}>I. Le parcours en un coup d&apos;œil</h2>
          <p style={{ margin: 0 }}>
            La transition écologique d&apos;un territoire suit une logique commune en cinq étapes, que les outils
            numériques doivent refléter. Chaque terme de ce vocabulaire s&apos;inscrit dans ce parcours commun :
          </p>
          <SchemaConceptuel />
        </section>

        {/* ===================== II. TERMES ET DEFINITIONS ===================== */}
        <section id="definitions" style={{ display: "flex", flexDirection: "column", gap: "32px" }}>
          <h2 style={{ margin: 0 }}>II. Termes et définitions</h2>

          {/* --- 1. Dans l'ordre du parcours --- */}
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            <h4 style={{ margin: 0 }}>1. Dans l&apos;ordre du parcours</h4>

            {/* Plan de transition + Fiche action + Projet opérationnel (stacked full width) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
              <DefinitionCard
                title="Plan de transition"
                fields={[
                  {
                    label: "Définition",
                    content: (
                      <p style={{ margin: 0 }}>
                        Document stratégique qui définit, sur un horizon temporel déterminé, les orientations, objectifs
                        et actions que se fixe une collectivité territoriale pour organiser et développer son territoire
                        de manière cohérente. Il traduit une vision partagée du devenir du territoire en tenant compte
                        de ses enjeux, des besoins de ses habitants et des ressources disponibles.
                      </p>
                    ),
                  },
                  {
                    icon: "fr-icon-megaphone-line",
                    label: "À utiliser à la place de",
                    content: "projet de territoire, stratégie",
                  },
                  {
                    icon: "fr-icon-alarm-warning-line",
                    label: "À ne pas confondre avec",
                    content: "Programme",
                  },
                  {
                    icon: "fr-icon-code-view",
                    label: "Terme technique dans le schéma",
                    content: <code>{"{plan_transition}"}</code>,
                  },
                  {
                    icon: "fr-icon-command-line",
                    label: "Lien aux autres termes",
                    content: (
                      <>
                        se décline en plusieurs <strong>actions</strong> et plusieurs{" "}
                        <strong>projets opérationnels</strong>
                      </>
                    ),
                  },
                  {
                    icon: "fr-icon-fullscreen-line",
                    label: "Exemples",
                    content:
                      "Plan Climat Air-Énergie Territorial (PCAET), Contrat pour la Réussite de la Transition Écologique (CRTE)",
                  },
                ]}
              />

              <DefinitionCard
                title="Fiche action"
                fields={[
                  {
                    label: "Définition",
                    content: (
                      <p style={{ margin: 0 }}>
                        Expression d&apos;une volonté politique qui décrit ce que la collectivité souhaite entreprendre
                        pour atteindre un objectif de son plan. Elle traduit une intention stratégique en précisant la
                        nature de l&apos;intervention envisagée, son périmètre et les finalités recherchées, sans entrer
                        dans les modalités opérationnelles.
                      </p>
                    ),
                  },
                  {
                    icon: "fr-icon-megaphone-line",
                    label: "À utiliser à la place de",
                    content: "action ; projet ; mesure",
                  },
                  {
                    icon: "fr-icon-alarm-warning-line",
                    label: "À ne pas confondre avec",
                    content: "projet opérationnel",
                  },
                  {
                    icon: "fr-icon-code-view",
                    label: "Terme technique dans le schéma",
                    content: <code>{"{fiche_action}"}</code>,
                  },
                  {
                    icon: "fr-icon-command-line",
                    label: "Lien aux autres termes",
                    content: (
                      <>
                        se décline en plusieurs <strong>projets opérationnels</strong> ; contribue à plusieurs{" "}
                        <strong>plans de transition</strong>
                      </>
                    ),
                  },
                  {
                    icon: "fr-icon-bubble-chart-line",
                    label: "Est qualifié par",
                    content: "leviers, compétences, axes",
                  },
                  {
                    icon: "fr-icon-fullscreen-line",
                    label: "Exemples",
                    content:
                      "« Rénover les bâtiments scolaires » ; « Encourager les mobilités partagées (covoiturage, autopartage...) »",
                  },
                ]}
              />

              <DefinitionCard
                title="Projet opérationnel"
                fields={[
                  {
                    label: "Définition",
                    content: (
                      <p style={{ margin: 0 }}>
                        Déclinaison opérationnelle et structurée d&apos;une action, qui définit précisément une des
                        modalités de sa réalisation concrète sur le territoire. Elle détaille les moyens engagés
                        (budget, ressources humaines, techniques), identifie les acteurs et leurs rôles respectifs,
                        établit un calendrier précis et définit des livrables attendus. Le projet opérationnel constitue
                        l&apos;unité de gestion et de pilotage qui permet la mise en œuvre effective de la volonté
                        politique exprimée dans l&apos;action.
                      </p>
                    ),
                  },
                  {
                    icon: "fr-icon-megaphone-line",
                    label: "À utiliser à la place de",
                    content: "projet ; chantier ; mesure",
                  },
                  {
                    icon: "fr-icon-alarm-warning-line",
                    label: "À ne pas confondre avec",
                    content: "action ; projet de territoire",
                  },
                  {
                    icon: "fr-icon-code-view",
                    label: "Terme technique dans le schéma",
                    content: <code>{"{projet_operationnel}"}</code>,
                  },
                  {
                    icon: "fr-icon-command-line",
                    label: "Lien aux autres termes",
                    content: (
                      <>
                        contribue à plusieurs <strong>actions</strong>, plusieurs <strong>plans de transition</strong>
                      </>
                    ),
                  },
                  {
                    icon: "fr-icon-bubble-chart-line",
                    label: "Est qualifié par",
                    content: "financement, programme, leviers, compétences, axes",
                  },
                  {
                    icon: "fr-icon-fullscreen-line",
                    label: "Exemples",
                    content: "« Rénovation thermique du gymnase Marcel Rouault »",
                  },
                ]}
              />
            </div>
          </div>

          {/* --- Données de qualification et périphériques --- */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h4 style={{ margin: 0 }}>2. Données de qualification et périphériques</h4>
            <p style={{ margin: 0 }}>
              Plusieurs métadonnées peuvent venir qualifier les concepts principaux définis ci-dessus :
            </p>
            <Table
              bordered
              headers={["Métadonnée", "Définition", "Est lié à"]}
              data={[
                [
                  <strong key="f">Financement</strong>,
                  "Dispositif mobilisé pour soutenir la réalisation d'une ou plusieurs actions ou opérations. Il peut prendre la forme d'une subvention, d'un fonds propre, d'un contrat de financement européen, national ou régional (CRTE, DETR, FEDER, etc.), ou de tout autre mécanisme de soutien financier, dont de l'auto-financement.",
                  <TagsRow key="ft" tags={[{ label: "projet opérationnel", variant: "light" }]} />,
                ],
                [
                  <strong key="l">Levier</strong>,
                  "Support d'identification des postes prioritaires de réduction des émissions définis par le SGPE, afin d'aider à la décision les collectivités.",
                  <TagsRow
                    key="lt"
                    tags={[
                      { label: "plan de transition", variant: "light" },
                      { label: "fiche action", variant: "light" },
                      { label: "projet opérationnel", variant: "light" },
                    ]}
                  />,
                ],
                [
                  <strong key="c">Compétence</strong>,
                  "Compétences et sous-compétences des collectivités selon la nomenclature du référentiel M57. Les compétences ont un code du type : 90-XY, et les sous-compétences 90-XYZ.",
                  <TagsRow
                    key="ct"
                    tags={[
                      { label: "fiche action", variant: "light" },
                      { label: "projet opérationnel", variant: "light" },
                    ]}
                  />,
                ],
                [
                  <strong key="p">Programme</strong>,
                  "Dispositif d'action publique structuré, porté par l'État (souvent en partenariat avec des agences comme l'ANCT, l'ADEME ou la Banque des Territoires), qui mobilise un ensemble cohérent de moyens financiers, humains et méthodologiques pour accompagner des acteurs territoriaux vers un objectif de transformation défini.",
                  <TagsRow key="pt" tags={[{ label: "projet opérationnel", variant: "light" }]} />,
                ],
              ]}
            />
          </div>

          {/* --- 3. Exemple --- */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h4 style={{ margin: 0 }}>3. Exemple</h4>
            <div
              style={{
                backgroundColor: "#B8FEC9",
                borderRadius: "8px",
                padding: "24px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
                color: "#161616",
              }}
            >
              <strong style={{ fontSize: "18px" }}>Scénario fictif</strong>
              <p style={{ margin: 0 }}>
                L&apos;exemple ci-dessous est <strong>entièrement fictif</strong> — les données, montants et références
                ne correspondent à aucun projet réel. Il illustre comment le schéma structure les relations entre un
                plan, ses actions et ses opérations.
              </p>
              <p style={{ margin: 0 }}>
                Nantes Métropole a un PCAET 2024-2030. Une de ses actions stratégiques est «&nbsp;Rénover les bâtiments
                scolaires&nbsp;». Cette action se décline en 2 opérations concrètes, financées par différentes sources.
              </p>
            </div>
            <ExempleDiagram />
          </div>

          {/* --- 4. Comment ces définitions ont-elles été établies ? --- */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h4 style={{ margin: 0 }}>4. Comment ces définitions ont-elles été établies ?</h4>
            <p style={{ margin: 0 }}>
              Ces définitions sont issues d&apos;une dizaine d&apos;entretiens menés avec des agents DDTM, des chargés
              de mission transition écologique et des membres d&apos;équipes produit de services numériques d&apos;État.
              L&apos;objectif était d&apos;identifier les termes utilisés de façon incohérente entre plateformes
              («&nbsp;projet&nbsp;», «&nbsp;action&nbsp;»...) et de proposer un cadre commun.
            </p>
            <a
              className={fr.cx("fr-btn", "fr-btn--secondary", "fr-btn--icon-right", "fr-icon-arrow-right-line")}
              href="/ressources/vocabulaire/methodologie"
            >
              Lire plus sur la méthodologie
            </a>
          </div>
        </section>

        {/* ===================== III. TABLE DE CORRESPONDANCE ===================== */}
        <section id="correspondance" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={{ margin: 0 }}>III. Table de correspondance entre plateformes</h2>
          <Table
            bordered
            headers={["Plateforme", "Plan", "Action", "Projet opérationnel", "Métadonnées principales"]}
            data={[
              [
                <strong key="tet">Territoires en Transitions</strong>,
                <code key="tp">{"{plan}"}</code>,
                <code key="ta">{"{action}"}</code>,
                <code key="to">{"{sous-action}"}</code>,
                "axe ; levier ; compétence",
              ],
              [
                <strong key="mec">Mon Espace Collectivité</strong>,
                <code key="mp">{"{PCAET-de-référence}"}</code>,
                <code key="ma">{"{action}"}</code>,
                <code key="mo">{"{projet}"}</code>,
                "financement",
              ],
              [
                <strong key="fv">Fonds Vert</strong>,
                "—",
                "—",
                <code key="fo">{"{dossier}"}</code>,
                "financement ; programme",
              ],
              [<strong key="pfmv">Plus Fraîche Ma Ville</strong>, "—", "—", "—", "—"],
            ]}
          />
        </section>

        {/* ===================== CALLOUT CTA ===================== */}
        <CallOut colorVariant="yellow-tournesol" title="Envie de contribuer au glossaire ?" titleAs="h3">
          Vous souhaitez apporter votre contribution et/ou apparaître dans la table de correspondance de référence ?
          <br />
          <br />
          <a className={fr.cx("fr-btn")} href="mailto:thomas.guillory@numerique.gouv.fr">
            Nous contacter
          </a>
        </CallOut>

        {/* ===================== IV. FAQ ===================== */}
        <section id="faq" style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          <h2 style={{ margin: 0 }}>IV. Foire aux questions</h2>
          <FaqSection />
        </section>
      </div>
    </div>
  );
}
