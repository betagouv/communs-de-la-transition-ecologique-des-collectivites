import { useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Breadcrumb } from "@codegouvfr/react-dsfr/Breadcrumb";

/**
 * Notion embed URL for the vocabulary page.
 * Generated via Notion's official "Share > Publish > Embed this page > Copy code" feature.
 * Note: The double slash after /ebd// is intentional and required by Notion's embed format.
 */
const NOTION_EMBED_URL = "https://communs-te.notion.site/ebd//2bcbde078be0808dae9ad77f218ca7df";

/** Original Notion page URL for the "View on Notion" link */
const NOTION_PAGE_URL =
  "https://communs-te.notion.site/UX-Research-Vocabulaire-M-tier-2bcbde078be0808dae9ad77f218ca7df";

export function Vocabulaire() {
  const [isLoading, setIsLoading] = useState(true);

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

      <div className={fr.cx("fr-mt-4w")} style={{ position: "relative" }}>
        {isLoading && (
          <div
            className={fr.cx("fr-p-4w")}
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              minHeight: "400px",
              backgroundColor: "var(--background-alt-grey)",
              borderRadius: "8px",
            }}
          >
            <p className={fr.cx("fr-text--lg")}>Chargement du vocabulaire...</p>
          </div>
        )}
        <iframe
          src={NOTION_EMBED_URL}
          title="Vocabulaire métier - Glossaire de la transition écologique"
          style={{
            display: isLoading ? "none" : "block",
            width: "100%",
            height: "calc(100vh - 350px)",
            minHeight: "600px",
            border: "1px solid var(--border-default-grey)",
            borderRadius: "8px",
          }}
          loading="lazy"
          allowFullScreen
          onLoad={() => setIsLoading(false)}
        />
      </div>

      <p className={fr.cx("fr-mt-2w", "fr-text--sm", "fr-text--light")}>
        Ce contenu est hébergé sur{" "}
        <a href={NOTION_PAGE_URL} target="_blank" rel="noopener noreferrer">
          Notion
        </a>
        .
      </p>
    </div>
  );
}
