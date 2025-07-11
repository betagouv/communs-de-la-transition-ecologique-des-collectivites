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
      <label className={fr.cx("fr-label")} htmlFor="leviers-select">
        Leviers de transition écologique
      </label>

      <select
        className={fr.cx("fr-select")}
        id="leviers-select"
        multiple
        value={value}
        onChange={handleChange}
        size={8}
        disabled={allSelected}
      >
        {leviers.map((levier) => (
          <option key={levier} value={levier}>
            {levier}
          </option>
        ))}
      </select>

      <div className={fr.cx("fr-checkbox-group", "fr-mt-2w")}>
        <input
          type="checkbox"
          id="leviers-select-all"
          className="fr-checkbox"
          checked={allSelected}
          onChange={(e) => handleSelectAll(e.target.checked)}
        />
        <label className={fr.cx("fr-label", "fr-text--sm")} htmlFor="leviers-select-all">
          Sélectionner tous les leviers
        </label>
      </div>
    </div>
  );
};
