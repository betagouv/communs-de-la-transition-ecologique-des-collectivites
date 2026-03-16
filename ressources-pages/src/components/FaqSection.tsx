import { Accordion } from "@codegouvfr/react-dsfr/Accordion";

export function FaqSection() {
  return (
    <div>
      <Accordion label="Pourquoi un glossaire de référence ?">
        <p>
          Les plateformes numériques au service de la transition écologique des collectivités utilisent des
          terminologies différentes pour désigner des concepts similaires. Le terme « projet » peut désigner un plan
          stratégique dans un outil et une opération concrète dans un autre. Ce glossaire propose un vocabulaire commun
          pour faciliter l&apos;interopérabilité entre les plateformes et fluidifier le parcours des collectivités.
        </p>
      </Accordion>
      <Accordion label="Pourquoi les indicateurs de suivi et d'impact ne sont-ils pas mentionnés ?">
        <p>
          Les indicateurs de suivi et d&apos;impact relèvent d&apos;une logique propre à chaque plateforme et à chaque
          collectivité. Ils ne font pas partie du vocabulaire commun car leur standardisation nécessite un travail
          spécifique qui dépasse le périmètre de ce glossaire. Ce sujet pourra être traité dans une phase ultérieure.
        </p>
      </Accordion>
      <Accordion label="Ma plateforme n'apparaît pas dans la table de correspondance, que faire ?">
        <p>
          La table de correspondance est évolutive. Si votre plateforme intervient dans le domaine de la transition
          écologique des collectivités et que vous souhaitez y apparaître, n&apos;hésitez pas à nous contacter via le
          formulaire en bas de page. Nous travaillerons ensemble à l&apos;alignement de votre terminologie avec le
          vocabulaire de référence.
        </p>
      </Accordion>
      <Accordion label="Qui maintient ce glossaire à jour ?">
        <p>
          Ce glossaire est maintenu par l&apos;équipe API Collectivités dans le cadre du programme beta.gouv.fr, en
          collaboration avec les équipes produit de Territoires en Transitions, Mon Espace Collectivité et les services
          de l&apos;État (DGALN, ADEME, ANCT). Il évolue au fil des retours terrain et des nouveaux partenariats.
        </p>
      </Accordion>
    </div>
  );
}
