import fs from "fs";
import path from "path";

type CompetencesData = Record<string, string[]>;

async function generateCompetencesList() {
  try {
    const jsonPath = path.join(__dirname, "../src/shared/const/competences_collectivites.json");
    const jsonContent = await fs.promises.readFile(jsonPath, "utf-8");
    const competencesData = JSON.parse(jsonContent) as CompetencesData;

    // Generate the sorted list
    const combinedStrings = Object.entries(competencesData)
      .flatMap(([competence, sousCompetences]) =>
        sousCompetences.length > 0 ? sousCompetences.map((sous) => `${competence} > ${sous}`) : [competence],
      )
      .sort((a, b) => {
        const aHasSousCompetence = a.includes(" > ");
        const bHasSousCompetence = b.includes(" > ");

        if (aHasSousCompetence === bHasSousCompetence) {
          return a.localeCompare(b);
        }

        return aHasSousCompetence ? 1 : -1;
      });

    const outputContent = `// Generated file - do not edit directly
export const competencesWithSousCompetences = ${JSON.stringify(combinedStrings, null, 2)} as const;
`;

    const outputPath = path.join(__dirname, "../src/shared/const/competences-list.ts");
    await fs.promises.writeFile(outputPath, outputContent);

    console.log("Competences list generated successfully!");
  } catch (error) {
    console.error("Error generating competences list:", error);
    process.exit(1);
  }
}

void generateCompetencesList();
