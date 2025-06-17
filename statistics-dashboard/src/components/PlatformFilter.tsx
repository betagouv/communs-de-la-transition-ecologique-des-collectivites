import { Select } from "@codegouvfr/react-dsfr/Select";

interface PlatformFilterProps {
  value: string;
  onChange: (value: string) => void;
  platforms: string[];
}

export function PlatformFilter({ value, onChange, platforms }: PlatformFilterProps) {
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
        {platforms.map((platform) => (
          <option key={platform} value={platform}>
            {platform}
          </option>
        ))}
      </Select>
    </div>
  );
}
