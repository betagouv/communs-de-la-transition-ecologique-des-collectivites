import { Select } from "@codegouvfr/react-dsfr/Select";

interface PlatformFilterProps {
  value: string;
  onChange: (value: string) => void;
}

export function PlatformFilter({ value, onChange }: PlatformFilterProps) {
  return (
    <div style={{ maxWidth: "300px" }}>
      <Select
        label="Plateforme"
        nativeSelectProps={{
          value,
          onChange: (e) => onChange(e.target.value),
        }}
      >
        <option value="all">Toutes les plateformes</option>
        <option value="production">Production</option>
        <option value="staging">Staging</option>
        <option value="development">Development</option>
      </Select>
    </div>
  );
}
