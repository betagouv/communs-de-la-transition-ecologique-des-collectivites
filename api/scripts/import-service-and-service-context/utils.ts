export function parseExtraField(extraFieldString: string | undefined): { name: string; label: string }[] {
  if (!extraFieldString) {
    return [];
  }
  // Replace single quotes with double quotes to make a JSON valid string
  let jsonString = extraFieldString.replace(/'/g, '"');

  // Add quotes around keys if they are missing
  jsonString = jsonString.replace(/(\w+):/g, '"$1":');

  // Parse the JSON string into an Array
  try {
    const extraFields = JSON.parse(jsonString) as { name: string; label: string };
    return [extraFields];
  } catch (error) {
    console.error("Failed to parse extraField:", error);
    throw new Error("Invalid extraField format");
  }
}

export const makeNullIfEmptyString = (value: string | undefined): string | null => {
  if (!value) {
    return null;
  }
  return value;
};

// Helper functions
export function parseFieldToArray(
  field: string,
  validList: readonly string[],
  mode: "competence" | "levier" | "etapes",
  invalidItemsFile: string[],
): string[] {
  // Remove curly braces and quotes
  const cleanedField = field.replace(/[{}"]/g, "");

  // this regex is useful as some leviers and competences have a "," inside their own name
  // like Agriculture, pêche et agro-alimentaire therefore we only want to split
  // when the comma is followed by a capital letter or a digit regardless of whistepace which can be present or not based on the csv generation
  const splitCleanedField = cleanedField.split(/,(?=\s*[A-Z0-9])/);

  return splitCleanedField
    .map((item) => item.trim())
    .filter((item) => {
      if (item === "NULL" || item === "") {
        return false;
      }
      if (!validList.includes(item)) {
        invalidItemsFile.push(`Invalid ${mode}: ${item}`);
        return false;
      }
      return true;
    });
}
