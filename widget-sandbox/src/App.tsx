import { ServicesWidget } from "@betagouv/les-communs-widget";

function App() {
  const PROJECT_ID_WITHOUT_EXTRAFIELD = "0195af5a-6c42-7acd-9db4-e4b8582aa366";
  return (
    <div className="fr-container">
      <h1>Widget Test Sandbox</h1>
      <ServicesWidget projectId={PROJECT_ID_WITHOUT_EXTRAFIELD} isStagingEnv debug />
    </div>
  );
}

export default App;

//https://les-communs-transition-ecologique-api-prod.osc-fr1.scalingo.io/services/project/your-test-project-id
