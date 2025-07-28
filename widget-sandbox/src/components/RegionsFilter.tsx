import { regionCodes, RegionCodes } from "@betagouv/les-communs-widget";
import { fr } from "@codegouvfr/react-dsfr";

interface RegionsFilterProps {
  value: RegionCodes;
  onChange: (regions: RegionCodes) => void;
}

export const RegionsFilter = ({ value, onChange }: RegionsFilterProps) => {
  const handleChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const selectedOptions = Array.from(event.target.selectedOptions).map((option) => option.value) as RegionCodes;
    onChange(selectedOptions);
  };

  const regionOptions = Object.entries(regionCodes).map(([code, name]) => ({
    value: code,
    label: name,
  }));

  return (
    <div className={fr.cx("fr-select-group")}>
      <label className={fr.cx("fr-label")} htmlFor="regions-select">
        Régions
        <span className={fr.cx("fr-hint-text")}>Sélectionnez les régions pour filtrer les services</span>
      </label>
      <select
        id="regions-select"
        className={fr.cx("fr-select")}
        multiple
        value={value}
        onChange={handleChange}
        size={5}
      >
        {regionOptions.map(({ value: regionCode, label }) => (
          <option key={regionCode} value={regionCode}>
            {label}
          </option>
        ))}
      </select>
    </div>
  );
};
