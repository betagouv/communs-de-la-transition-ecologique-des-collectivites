import { ServicesWidget } from "@les-communs/widget";

function App() {
  return (
    <div className="fr-container">
      <h1>Widget Test Sandbox</h1>
      <ServicesWidget projectId="your-test-project-id" />
    </div>
  );
}

export default App;

//https://les-communs-transition-ecologique-api-prod.osc-fr1.scalingo.io/services/project/your-test-project-id
