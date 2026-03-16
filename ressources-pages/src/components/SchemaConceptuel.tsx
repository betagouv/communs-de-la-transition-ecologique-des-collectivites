import React from "react";

// Schema conceptuel: visual flow diagram showing the ecological transition journey
// Uses SVG + foreignObject approach (proven to work well for cross-browser rendering)
//
// Grid-based layout (all positions are center-x, with explicit widths):
//
//                          [Programme]    [Financement]
//                           cx=545          cx=665
//                              ↓               ↓
// [Diagnostic] → [Plan de transition] → [Fiche action] → [Projet opérationnel] → [Bilan]
//   cx=60          cx=215                cx=405            cx=605                 cx=770
//                                         ↑  ↑              ↑  ↑
//                                       [Levier]        [Compétence]
//                                        cx=455            cx=575

const pillBase: React.CSSProperties = {
  display: "flex",
  justifyContent: "center",
  alignItems: "center",
  borderRadius: "100px",
  fontWeight: 500,
  fontSize: "13px",
  lineHeight: "18px",
  padding: "6px 12px",
  width: "100%",
  boxSizing: "border-box",
  whiteSpace: "nowrap",
};

const outlinedPill: React.CSSProperties = {
  ...pillBase,
  backgroundColor: "#FFFFFF",
  border: "1px solid #000091",
  color: "#000091",
};

const dash = "4 4";
const lineStyle = { stroke: "#000091", strokeWidth: 1, strokeDasharray: dash };

export function SchemaConceptuel() {
  // --- Y positions ---
  const yTop = 10; // Programme + Financement row
  const yMain = 82; // Main flow row
  const yTags = 158; // Tags row
  const pH = 34; // Pill height

  // --- Main flow: center-x positions and widths ---
  // Diagnostic and Bilan: no background, dark blue text only
  // Plan de transition, Fiche action, Projet opérationnel: filled dark blue
  const cols = [
    { label: "Diagnostic", cx: 60, w: 100, bg: "transparent", color: "#000091", border: "none" },
    { label: "Plan de transition", cx: 215, w: 150, bg: "#000091", color: "#FFFFFF", border: "none" },
    { label: "Fiche action", cx: 405, w: 115, bg: "#000091", color: "#FFFFFF", border: "none" },
    { label: "Projet opérationnel", cx: 605, w: 165, bg: "#000091", color: "#FFFFFF", border: "none" },
    { label: "Bilan", cx: 770, w: 60, bg: "transparent", color: "#000091", border: "none" },
  ];

  // --- Top row: Programme + Financement (outlined dark blue, positioned above Projet opérationnel) ---
  const topPills = [
    { label: "Programmes", cx: 545, w: 120 },
    { label: "Financements", cx: 670, w: 130 },
  ];

  // --- Bottom row: Levier + Compétence (outlined dark blue, between Fiche action and Projet opérationnel) ---
  const tags = [
    { label: "Leviers", cx: 455, w: 85 },
    { label: "Compétences", cx: 580, w: 125 },
  ];

  const mkEnd = "url(#schema-arrow-end)";

  // Horizontal arrow between two consecutive main pills
  const hArrow = (i: number) => {
    const from = cols[i];
    const to = cols[i + 1];
    const x1 = from.cx + from.w / 2 + 4;
    const x2 = to.cx - to.w / 2 - 4;
    return (
      <line key={`h${i}`} x1={x1} y1={yMain + pH / 2} x2={x2} y2={yMain + pH / 2} {...lineStyle} markerEnd={mkEnd} />
    );
  };

  // Vertical arrow from top pill down to main row
  const vArrowDown = (topPill: { cx: number }, key: string) => (
    <line
      key={key}
      x1={topPill.cx}
      y1={yTop + pH + 4}
      x2={topPill.cx}
      y2={yMain - 2}
      {...lineStyle}
      markerEnd={mkEnd}
    />
  );

  // Diagonal arrow from tag (bottom) UP to main pill (arrows point upward)
  const diagArrowUp = (tagCx: number, mainCx: number, key: string) => (
    <line key={key} x1={tagCx} y1={yTags - 2} x2={mainCx} y2={yMain + pH + 4} {...lineStyle} markerEnd={mkEnd} />
  );

  return (
    <div
      style={{
        border: "1px solid #E3E3FD",
        borderRadius: "10px",
        padding: "24px 16px",
        backgroundColor: "#FAFAFF",
        color: "#161616",
      }}
    >
      <svg
        viewBox="0 0 840 200"
        width="100%"
        style={{ overflow: "visible", maxWidth: "840px", display: "block", margin: "0 auto" }}
        aria-label="Schéma conceptuel : Diagnostic, Plan de transition, Fiche action, Projet opérationnel, Bilan avec Programmes, Financements, Leviers et Compétences"
      >
        <defs>
          <marker id="schema-arrow-end" markerWidth="5" markerHeight="8" refX="4" refY="4" orient="auto">
            <path d="M1 1L4 4L1 7" fill="none" stroke="#000091" strokeWidth="1" strokeLinecap="round" />
          </marker>
        </defs>

        {/* === Horizontal arrows (main flow) === */}
        {[0, 1, 2, 3].map((i) => hArrow(i))}

        {/* === Vertical arrows: Programme → Projet opérationnel, Financement → Projet opérationnel === */}
        {vArrowDown(topPills[0], "v-prog")}
        {vArrowDown(topPills[1], "v-fin")}

        {/* === Diagonal arrows: tags UP to Fiche action + Projet opérationnel === */}
        {/* Levier (cx=455) → Fiche action (cx=405) and Projet opérationnel (cx=605) */}
        {diagArrowUp(440, 385, "d-lev-fa")}
        {diagArrowUp(470, 585, "d-lev-po")}
        {/* Compétence (cx=575) → Fiche action (cx=405) and Projet opérationnel (cx=605) */}
        {diagArrowUp(560, 425, "d-comp-fa")}
        {diagArrowUp(590, 625, "d-comp-po")}

        {/* === Top row pills: Programme + Financement (outlined dark blue) === */}
        {topPills.map((p) => (
          <foreignObject key={p.label} x={p.cx - p.w / 2} y={yTop} width={p.w} height={pH + 2}>
            <div style={{ ...outlinedPill, height: `${pH}px` }}>{p.label}</div>
          </foreignObject>
        ))}

        {/* === Main flow pills === */}
        {cols.map((c) => (
          <foreignObject key={c.label} x={c.cx - c.w / 2} y={yMain} width={c.w} height={pH + 2}>
            <div
              style={{
                ...pillBase,
                backgroundColor: c.bg,
                color: c.color,
                height: `${pH}px`,
              }}
            >
              {c.label}
            </div>
          </foreignObject>
        ))}

        {/* === Tag pills (bottom row, outlined dark blue) === */}
        {tags.map((t) => (
          <foreignObject key={t.label} x={t.cx - t.w / 2} y={yTags} width={t.w} height={pH + 2}>
            <div style={{ ...outlinedPill, height: `${pH}px` }}>{t.label}</div>
          </foreignObject>
        ))}
      </svg>
    </div>
  );
}
