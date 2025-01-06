import { fr } from "@codegouvfr/react-dsfr";
import classNames from "classnames";
import { useEffect, useState } from "react";
import { Service } from "./components/Service.tsx";
import styles from "./LesCommuns.module.css";

export interface LesCommunsProps {
  projectId: string;
  isStagingEnv?: boolean;
}

interface Service {
  id: string;
  name: string;
  description: string;
  iframeUrl?: string;
  redirectionUrl: string;
  logoUrl: string;
}

export const LesCommuns = ({ projectId, isStagingEnv }: LesCommunsProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const apiUrl = `https://les-communs-transition-ecologique-api-${isStagingEnv ? "staging" : "prod"}.osc-fr1.scalingo.io`;

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch(`${apiUrl}/services/project/${projectId}`);

        if (!response.ok) {
          throw new Error("Failed to fetch services");
        }

        const data = (await response.json()) as Service[];
        setServices(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "An error occurred");
      } finally {
        setLoading(false);
      }
    };

    void fetchServices();
  }, [apiUrl, projectId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (services.length === 0) return <div>No services found for this project</div>;

  return (
    <div className={classNames(fr.cx("fr-container", "fr-p-3w", "fr-pt-4w"), styles.container)}>
      <h6 className={classNames(fr.cx("fr-h6", "fr-mb-2w"), styles.title)}>Services</h6>
      <span className={fr.cx("fr-text--sm")}>
        Ces services sont en lien avec les <strong>thématiques, l’état d’avancement</strong> ainsi que la{" "}
        <strong>localisation</strong> de votre projet. En savoir plus
      </span>
      <div className={classNames(fr.cx("fr-mt-3w"), styles.services)}>
        {services.map((service) => (
          <Service key={service.id} {...service} />
        ))}
      </div>
    </div>
  );
};
