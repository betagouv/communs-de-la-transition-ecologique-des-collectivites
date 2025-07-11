import { fr } from "@codegouvfr/react-dsfr";
import { CompetenceCodes, competencesFromM57Referentials } from "@betagouv/les-communs-widget";

interface CompetencesFilterProps {
  value: CompetenceCodes;
  onChange: (value: CompetenceCodes) => void;
}

export const CompetencesFilter = ({ value, onChange }: CompetencesFilterProps) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions).map((option) => option.value) as CompetenceCodes;
    onChange(selectedOptions);
  };

  const handleSelectAll = (checked: boolean) => {
    if (checked) {
      onChange(["all"]);
    } else {
      onChange([]);
    }
  };

  const allSelected = value.includes("all");

  return (
    <div className={fr.cx("fr-select-group")}>
      <label className={fr.cx("fr-label")} htmlFor="competences-select">
        Compétences
      </label>

      <select
        className={fr.cx("fr-select")}
        id="competences-select"
        multiple
        value={value}
        onChange={handleChange}
        size={8}
        disabled={allSelected}
      >
        {Object.entries(competencesFromM57Referentials).map(([code, label]) => (
          <option key={code} value={code}>
            {code} - {label}
          </option>
        ))}
      </select>
      <div className={fr.cx("fr-checkbox-group", "fr-mt-2w")}>
        <input
          type="checkbox"
          id="competences-select-all"
          className="fr-checkbox"
          checked={allSelected}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
        <label className={fr.cx("fr-label", "fr-text--sm")} htmlFor="competences-select-all">
          Sélectionner toutes les compétences
        </label>
      </div>
    </div>
  );
};
