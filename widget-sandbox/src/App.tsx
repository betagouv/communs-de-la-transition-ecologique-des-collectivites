import { ServicesWidget } from "@betagouv/les-communs-widget";

function App() {
  const PROJECT_ID_WITHOUT_EXTRAFIELD = "01950465-1384-7332-88ff-b535cb868ed8";
  return (
    <div className="fr-container">
      <h1>Widget Test Sandbox</h1>
      <ServicesWidget projectId={PROJECT_ID_WITHOUT_EXTRAFIELD} isStagingEnv debug />
    </div>
  );
}

export default App;

//https://les-communs-transition-ecologique-api-prod.osc-fr1.scalingo.io/services/project/your-test-project-id
