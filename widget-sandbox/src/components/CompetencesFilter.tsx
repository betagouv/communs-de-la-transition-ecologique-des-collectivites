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

  return (
    <div className={fr.cx("fr-select-group")}>
      <label className={fr.cx("fr-label")} htmlFor="competences-select">
        Compétences
        <span className={fr.cx("fr-hint-text")}>Sélectionnez une ou plusieurs compétences du référentiel M57</span>
      </label>
      <select
        className={fr.cx("fr-select")}
        id="competences-select"
        multiple
        value={value}
        onChange={handleChange}
        size={8}
      >
        {Object.entries(competencesFromM57Referentials).map(([code, label]) => (
          <option key={code} value={code}>
            {code} - {label}
          </option>
        ))}
      </select>
      {value.length > 0 && (
        <p className={fr.cx("fr-hint-text")}>
          {value.length} compétence{value.length > 1 ? "s" : ""} sélectionnée{value.length > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
};
