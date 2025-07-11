import { fr } from "@codegouvfr/react-dsfr";
import { leviers, Leviers } from "@betagouv/les-communs-widget";

interface LeviersFilterProps {
  value: Leviers;
  onChange: (value: Leviers) => void;
}

export const LeviersFilter = ({ value, onChange }: LeviersFilterProps) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions).map((option) => option.value) as Leviers;
    onChange(selectedOptions);
  };

  return (
    <div className={fr.cx("fr-select-group")}>
      <label className={fr.cx("fr-label")} htmlFor="leviers-select">
        Leviers de transition écologique
        <span className={fr.cx("fr-hint-text")}>Sélectionnez un ou plusieurs leviers de transition écologique</span>
      </label>
      <select
        className={fr.cx("fr-select")}
        id="leviers-select"
        multiple
        value={value}
        onChange={handleChange}
        size={8}
      >
        {leviers.map((levier) => (
          <option key={levier} value={levier}>
            {levier}
          </option>
        ))}
      </select>
      {value.length > 0 && (
        <p className={fr.cx("fr-hint-text")}>
          {value.length} levier{value.length > 1 ? "s" : ""} sélectionné{value.length > 1 ? "s" : ""}
        </p>
      )}
    </div>
  );
};
