import { LesCommuns } from 'les-communs-widget'
import '@gouvfr/dsfr/dist/dsfr.min.css'

function App() {
  return (
    <div className="fr-container">
      <h1>Widget Test Sandbox</h1>
      <LesCommuns projectId="your-test-project-id" />
    </div>
  )
}

export default App