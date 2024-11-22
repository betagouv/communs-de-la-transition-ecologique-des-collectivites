import { useEffect, useState } from 'react';
import { Service } from '../types';

interface LesCommunsProps {
  projectId: string;
}

export const LesCommuns = ({ projectId }: LesCommunsProps) => {
  const [services, setServices] = useState<Service[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchServices = async () => {
      try {
        // Replace with your actual API endpoint
        const response = await fetch(`/api/projects/${projectId}/services`);
        if (!response.ok) {
          throw new Error('Failed to fetch services');
        }
        const data = await response.json();
        setServices(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };

    fetchServices();
  }, [projectId]);

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error}</div>;
  if (services.length === 0) return <div>No services found for this project</div>;

  return (
    <div className="fr-container">
      <h2>Services associés</h2>
      <div className="fr-grid-row fr-grid-row--gutters">
        {services.map((service) => (
          <div key={service.id} className="fr-col-12 fr-col-md-4">
            <div className="fr-card fr-enlarge-link">
              <div className="fr-card__body">
                <h3 className="fr-card__title">
                  {service.name}
                </h3>
                <p className="fr-card__desc">
                  {service.description}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}; 