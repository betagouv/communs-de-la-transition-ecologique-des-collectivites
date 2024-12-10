import { useEffect, useState } from "react";

interface LesCommunsProps {
  projectId: string;
}

interface Service {
  id: string;
  name: string;
  description: string;
}

export const LesCommuns = ({ projectId }: LesCommunsProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        const response = await fetch(
          `http://localhost:3000/services/project/${projectId}`,
        );

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
  }, [projectId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (services.length === 0)
    return <div>No services found for this project</div>;

  return (
    <div
      className="fr-container fr-pb-2w fr-shadow-md"
      style={{ border: "black solid 1px" }}
    >
      <h2>Services associés</h2>
      <div className="fr-grid-row fr-grid-row--gutters">
        {services.map((service) => (
          <div key={service.id} className="fr-col-12 fr-col-md-4">
            <div className="fr-card fr-enlarge-link">
              <div className="fr-card__body">
                <h3 className="fr-card__title">{service.name}</h3>
                <p className="fr-card__desc">{service.description}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
