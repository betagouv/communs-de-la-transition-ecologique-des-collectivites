import { fr } from "@codegouvfr/react-dsfr";
import { projetPhases, ProjetPhases } from "@betagouv/les-communs-widget";

interface PhasesFilterProps {
  value: ProjetPhases;
  onChange: (value: ProjetPhases) => void;
}

export const PhasesFilter = ({ value, onChange }: PhasesFilterProps) => {
  const handleChange = (phase: ProjetPhases[number], checked: boolean) => {
    if (checked) {
      onChange([...value, phase]);
    } else {
      onChange(value.filter((p) => p !== phase));
    }
  };

  return (
    <fieldset className={fr.cx("fr-fieldset")}>
      <legend className={fr.cx("fr-fieldset__legend", "fr-text--regular")}>Phases de projet</legend>
      <div className={fr.cx("fr-fieldset__content")}>
        {/* Individual phase checkboxes in a row */}
        <div className={fr.cx("fr-grid-row", "fr-grid-row--gutters")}>
          {projetPhases.map((phase) => (
            <div key={phase} className={fr.cx("fr-col-12", "fr-col-md-4")}>
              <div className={fr.cx("fr-checkbox-group")}>
                <input
                  type="checkbox"
                  id={`phase-${phase}`}
                  className="fr-checkbox"
                  checked={value.includes(phase)}
                  onChange={(e) => handleChange(phase, e.target.checked)}
                />
                <label className={fr.cx("fr-label")} htmlFor={`phase-${phase}`}>
                  {phase}
                </label>
              </div>
            </div>
          ))}
        </div>
      </div>
    </fieldset>
  );
};
