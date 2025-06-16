import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { fr } from "@codegouvfr/react-dsfr";
import type { ChartDataPoint } from "../types";

interface InteractionsChartProps {
  data: ChartDataPoint[];
}

export function InteractionsChart({ data }: InteractionsChartProps) {
  //todo replace this by a date lib ?
  const monthNames = ["Jan", "Fév", "Mar", "Avr", "Mai", "Jun", "Jul", "Aoû", "Sep", "Oct", "Nov", "Déc"];
  const monthNamesFull = [
    "Janvier",
    "Février",
    "Mars",
    "Avril",
    "Mai",
    "Juin",
    "Juillet",
    "Août",
    "Septembre",
    "Octobre",
    "Novembre",
    "Décembre",
  ];

  const formatDate = (date: string, useFullNames = false) => {
    const [year, month] = date.split("-");
    const names = useFullNames ? monthNamesFull : monthNames;
    return `${names[parseInt(month) - 1]} ${year}`;
  };

  return (
    <div className={fr.cx("fr-mt-6w")}>
      <h2 className={fr.cx("fr-h4", "fr-mb-4w")}>Évolution des interactions avec le widget sur les 6 derniers mois</h2>

      <div style={{ width: "100%", height: 400, backgroundColor: "#f8f9fa", padding: "20px", borderRadius: "8px" }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
            <XAxis dataKey="date" stroke="#666" fontSize={12} tickFormatter={(date: string) => formatDate(date)} />
            <YAxis stroke="#666" fontSize={12} />
            <Tooltip
              contentStyle={{
                backgroundColor: "#ffffff",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
              labelFormatter={(date: string) => formatDate(date, true)}
              formatter={(value: number) => [value, "Interactions"]}
            />
            <Line
              type="monotone"
              dataKey="interactions"
              stroke="#000091"
              strokeWidth={3}
              dot={{ fill: "#000091", strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6, stroke: "#000091", strokeWidth: 2 }}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
