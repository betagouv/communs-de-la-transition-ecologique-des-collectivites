import { useState } from "react";
import { fr } from "@codegouvfr/react-dsfr";
import { Badge } from "@codegouvfr/react-dsfr/Badge";
import { Button } from "@codegouvfr/react-dsfr/Button";
import { Input } from "@codegouvfr/react-dsfr/Input";
import { Select } from "@codegouvfr/react-dsfr/Select";
import { ToggleSwitch } from "@codegouvfr/react-dsfr/ToggleSwitch";
import { Etiquettes } from "./Etiquettes";
import { apercu as chargerApercu } from "../api";
import type { Apercu as ApercuType, ReglagesAides } from "../types";

/**
 * CE QUE L'API RENVOIE RÉELLEMENT, pour un projet, à une plateforme.
 *
 * PAS UNE ÉMULATION, et c'est tout l'enjeu de cet écran. Aucune règle n'est rejouée ici : les
 * quatre sections sont les réponses EXACTES des endpoints publics, produites par les MÊMES
 * fonctions qui servent MEC. Une reconstitution, même fidèle au départ, finit par diverger — et un
 * outil qui ment sur ce que voit la collectivité est pire que pas d'outil du tout.
 *
 * C'est pourquoi changer un réglage demande un aller-retour, contrairement à un curseur local : on
 * ne recalcule rien, on redemande à l'API.
 *
 * LA PLATEFORME EST OBLIGATOIRE. Les ajouts manuels et les arbitrages de recommandations sont
 * cloisonnés par plateforme : sans elle, on afficherait une liste que personne ne reçoit.
 */
const PLATEFORMES = ["MEC", "TET", "RECOCO", "URBAN_VITALIZ", "SOS_PONTS", "FOND_VERT"];

export function Apercu({ projetId }: { projetId: string }) {
  const [plateforme, setPlateforme] = useState("MEC");
  const [reglages, setReglages] = useState<ReglagesAides>({});
  // Le seuil des services est ENVOYÉ à l'API, jamais rejoué ici. Une version précédente de cet
  // écran le recalculait dans le navigateur : c'était une copie de la décision de l'API, et une
  // copie diverge. Le passer en paramètre coûte un aller-retour, et rend l'écran incapable de mentir.
  const [seuilServices, setSeuilServices] = useState<number | undefined>(undefined);
  const [resultat, setResultat] = useState<ApercuType | null>(null);
  const [chargement, setChargement] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);

  const lancer = async () => {
    setChargement(true);
    setErreur(null);
    try {
      setResultat(await chargerApercu(projetId, plateforme, reglages, seuilServices));
    } catch (e) {
      setErreur(e instanceof Error ? e.message : "Erreur inattendue.");
    } finally {
      setChargement(false);
    }
  };

  const nombre = (cle: keyof ReglagesAides, libelle: string, aide: string) => (
    <Input
      label={libelle}
      hintText={aide}
      nativeInputProps={{
        type: "number",
        step: "0.05",
        value: (reglages[cle] as number | undefined) ?? "",
        placeholder: "défaut API",
        onChange: (e) =>
          setReglages({ ...reglages, [cle]: e.target.value === "" ? undefined : Number(e.target.value) }),
      }}
    />
  );

  return (
    <section className={fr.cx("fr-mt-4w")}>
      <div className={fr.cx("fr-callout", "fr-mb-3w")}>
        <h2 className={fr.cx("fr-callout__title", "fr-h5")}>Ce que l&apos;API renvoie réellement</h2>
        <p className={fr.cx("fr-text--sm")}>
          Les réponses <strong>exactes</strong> des endpoints publics, produites par les mêmes fonctions qui servent
          MEC. Rien n&apos;est rejoué ici : changer un réglage redemande à l&apos;API, il ne recalcule pas.
        </p>

        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
          <div className={fr.cx("fr-col-12", "fr-col-md-4")}>
            <Select
              label="Au nom de quelle plateforme ?"
              hint="Les ajouts manuels et les arbitrages sont cloisonnés par plateforme."
              nativeSelectProps={{ value: plateforme, onChange: (e) => setPlateforme(e.target.value) }}
            >
              {PLATEFORMES.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </Select>
          </div>
          <div className={fr.cx("fr-col-6", "fr-col-md-2")}>
            {nombre("cutoff", "Cutoff", "Score minimal. 0 = aucun filtrage.")}
          </div>
          <div className={fr.cx("fr-col-6", "fr-col-md-2")}>
            {nombre("projetThreshold", "Confiance projet", "Sous ce seuil, l'étiquette ne compte pas.")}
          </div>
          <div className={fr.cx("fr-col-6", "fr-col-md-2")}>
            {nombre("aideThreshold", "Confiance aide", "Sous ce seuil, l'étiquette ne compte pas.")}
          </div>
          <div className={fr.cx("fr-col-6", "fr-col-md-2")}>{nombre("limit", "Max aides", "Défaut : 20.")}</div>
          <div className={fr.cx("fr-col-6", "fr-col-md-2")}>
            <Input
              label="Seuil services"
              hintText="Appliqué PAR l'API. Défaut : 0,30."
              nativeInputProps={{
                type: "number",
                step: "0.05",
                value: seuilServices ?? "",
                placeholder: "défaut API",
                onChange: (e) => setSeuilServices(e.target.value === "" ? undefined : Number(e.target.value)),
              }}
            />
          </div>
        </div>

        <ToggleSwitch
          label="Matching textuel (BM25)"
          helperText="Repêche les aides dont l'intitulé colle au projet, même sans recouvrement d'étiquettes."
          checked={reglages.textual ?? false}
          onChange={(v) => setReglages({ ...reglages, textual: v })}
          inputTitle="textuel"
          showCheckedHint={false}
        />

        {reglages.textual && (
          <Input
            label="Texte de la recherche"
            hintText="Vide = « nom + description » du projet, comme l'API."
            nativeInputProps={{
              value: reglages.texte ?? "",
              placeholder: "nom + description du projet",
              onChange: (e) => setReglages({ ...reglages, texte: e.target.value || undefined }),
            }}
          />
        )}

        <div className={fr.cx("fr-mt-2w")} style={{ display: "flex", gap: "0.5rem" }}>
          <Button onClick={() => void lancer()} disabled={chargement}>
            {chargement ? "Appel de l'API…" : "Appeler l'API"}
          </Button>
          <Button
            priority="secondary"
            onClick={() => {
              setReglages({});
              setSeuilServices(undefined);
            }}
            disabled={Object.keys(reglages).length === 0 && seuilServices === undefined}
          >
            Revenir aux défauts
          </Button>
        </div>
      </div>

      {erreur && (
        <div className={fr.cx("fr-alert", "fr-alert--error", "fr-mb-3w")}>
          <p>{erreur}</p>
        </div>
      )}

      {resultat && (
        <>
          <h3 className={fr.cx("fr-h5")}>
            Aides{" "}
            <Badge severity={resultat.aides.status === "ok" ? "success" : "warning"} noIcon>
              {resultat.aides.status}
            </Badge>
          </h3>
          <p className={fr.cx("fr-text--xs")}>
            {resultat.aides.aides.length} rendue(s) sur {resultat.aides.total} du territoire — appliqué : cutoff{" "}
            {resultat.reglagesAides.cutoff} · confiance projet {resultat.reglagesAides.thresholds?.projet ?? "0,8"} ·
            confiance aide {resultat.reglagesAides.thresholds?.aide ?? "0,8"} · textuel{" "}
            {resultat.reglagesAides.textualEnabled ? "oui" : "non"} · max {resultat.reglagesAides.maxResults}
          </p>

          <div className={fr.cx("fr-table", "fr-table--sm")}>
            <table>
              <thead>
                <tr>
                  <th scope="col">Aide</th>
                  <th scope="col">Score</th>
                  {resultat.reglagesAides.textualEnabled && <th scope="col">Textuel</th>}
                  <th scope="col">Étiquettes partagées</th>
                </tr>
              </thead>
              <tbody>
                {resultat.aides.aides.map((a) => (
                  <tr key={a.id}>
                    <td>
                      {a.url ? (
                        <a href={a.url} target="_blank" rel="noreferrer">
                          {a.name}
                        </a>
                      ) : (
                        a.name
                      )}
                      {a.ajoutManuel && (
                        <>
                          {" "}
                          <Badge severity="info" noIcon small>
                            ajout manuel
                          </Badge>
                          {a.ajoutManuel.message && (
                            <div className={fr.cx("fr-text--xs")}>« {a.ajoutManuel.message} »</div>
                          )}
                        </>
                      )}
                      <div className={fr.cx("fr-text--xs")}>id {a.id}</div>
                    </td>
                    <td>{a.normalizedScore?.toFixed(2) ?? "—"}</td>
                    {resultat.reglagesAides.textualEnabled && <td>{a.textualScore?.toFixed(2) ?? "—"}</td>}
                    <td>
                      <Etiquettes communes={a.labelsCommuns ?? { thematiques: [], sites: [], interventions: [] }} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {resultat.aides.aides.length === 0 && (
            <p className={fr.cx("fr-text--sm")}>
              Aucune aide rendue.{" "}
              {resultat.aides.total > 0 && "Des aides existent sur le territoire : c'est le matching qui les écarte."}
            </p>
          )}

          <h3 className={fr.cx("fr-h5", "fr-mt-4w")}>Services numériques</h3>
          <p className={fr.cx("fr-text--xs")}>
            {resultat.services.services.length} rendu(s), seuil appliqué {resultat.seuilServices.toFixed(2)}. Ce seuil
            est appliqué <strong>par l&apos;API</strong>, pas recalculé ici — et la route publique ne l&apos;expose pas
            : le contrat interdit de faire traverser un critère de sélection au client.
          </p>
          <ul>
            {resultat.services.services.map((s) => (
              <li key={s.id}>
                <strong>{s.nom}</strong>
                {s.ajoutManuel && (
                  <>
                    {" "}
                    <Badge severity="info" noIcon small>
                      {s.ajoutManuel.horsCatalogue ? "ajout manuel, hors catalogue" : "ajout manuel"}
                    </Badge>
                    {s.ajoutManuel.message && (
                      <span className={fr.cx("fr-text--xs")}> « {s.ajoutManuel.message} »</span>
                    )}
                  </>
                )}
              </li>
            ))}
          </ul>
          {resultat.services.services.length === 0 && <p className={fr.cx("fr-text--sm")}>Aucun service rendu.</p>}

          <h3 className={fr.cx("fr-h5", "fr-mt-4w")}>Questionnaires</h3>
          <ul>
            {resultat.questionnaires.questionnaires.map((q) => (
              <li key={q.slug}>
                <strong>{q.slug}</strong> (v{q.version}, {q.statut}) — {q.banniere.titre}
              </li>
            ))}
          </ul>
          {resultat.questionnaires.questionnaires.length === 0 && (
            <p className={fr.cx("fr-text--sm")}>Aucun questionnaire proposé.</p>
          )}

          <h3 className={fr.cx("fr-h5", "fr-mt-4w")}>Recommandations</h3>
          <ul>
            {resultat.recommandations.recommandations.map((r) => (
              <li key={r.id}>
                <strong>{r.titre}</strong>
                {/* `aideId` est ce qui permet à MEC de proposer « ajouter cette aide au projet ». */}
                {r.financements
                  ?.filter((f) => f.aideId)
                  .map((f) => (
                    <span key={f.libelle} className={fr.cx("fr-text--xs")}>
                      {" "}
                      — aide {f.aideId} : {f.libelle}
                    </span>
                  ))}
              </li>
            ))}
          </ul>
          {resultat.recommandations.recommandations.length === 0 && (
            <p className={fr.cx("fr-text--sm")}>Aucune recommandation.</p>
          )}
        </>
      )}
    </section>
  );
}
