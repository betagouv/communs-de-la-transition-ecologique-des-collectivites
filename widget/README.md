# Les Communs Widget

A React widget that displays associated services for ecological transition projects. This widget is designed to be embedded in various platforms to provide a consistent service discovery experience.

## Features

- Displays services associated with a project
- Responsive design using DSFR (Design System de l'État)
- TypeScript support
- Built with Vite

## Usage in Other Projects

To use this widget in your project:

```bash
pnpm add @betagouv/les-communs-widget
```

Then import and use the component:

```tsx
import { ServicesWidget } from "@betagouv/les-communs-widget";

function App() {
  return <ServicesWidget projectId="0195af3a-6b26-7a5c-a091-712901a4498d" />;
}
```

### Project mode

By default the widget needs to consume the projectId from the Communs database. This ID is a uuid and you will get a 400 if you try any other format

Depending on the widget consumers, you might be able to use your own id as such. For now we only support tet

```tsx
import { ServicesWidget } from "@betagouv/les-communs-widget";

function App() {
  <ServicesWidget projectId="your-project-id-from-your-base" idType={"tetId"} />;
}
```

### Context mode

For platforms that don't have projects in the Communs database or don't have the concept of projects, you can use the context mode. This allows you to specify competences, leviers, and phases directly to get relevant services.

```tsx
import { ServicesWidget } from "@betagouv/les-communs-widget";

function App() {
  return (
    <ServicesWidget
      context={{
        competences: ["90-11", "90-21"], // Police, sécurité, justice & Enseignement du premier degré
        leviers: ["Gestion des forêts et produits bois", "Sobriété des bâtiments (résidentiel)"],
        phases: ["Idée", "Étude"],
      }}
    />
  );
}
```

**Available competences** (from M57 referential):

- `90-11`: Police, sécurité, justice
- `90-21`: Enseignement du premier degré
- `90-31`: Culture
- `90-41`: Santé
- `90-51`: Aménagement des territoires et habitat
- `90-61`: Action économique
- `90-71`: Environnement
- `90-81`: Transports scolaires
- And many more... ([see full list in shared-types.ts](lib/shared-types.ts))

**Available leviers** (ecological transition levers):

- `Gestion des forêts et produits bois`
- `Changements de pratiques de fertilisation azotée`
- `Elevage durable`
- `Gestion des haies`
- `Sobriété des bâtiments (résidentiel)`
- `Electricité renouvelable`
- And many more... ([see full list in shared-types.ts](lib/shared-types.ts))

**Available phases**:

- `Idée`
- `Étude`
- `Opération`

### Debug mode

When testing the widget integration in can be useful to check how each service is displayed (since some iframe might have specific CSP rules against your domain)

In order to see all services regardless of their matching with the current project, you can pass prop `debug` as such:

```tsx
import { ServicesWidget } from "@betagouv/les-communs-widget";

function App() {
  return <ServicesWidget projectId="your-project-id" debug />;
}
```

### Staging environment

You can test against the staging environment by passing prop `isStagingEnv`:

```tsx
import { ServicesWidget } from "@betagouv/les-communs-widget";

function App() {
  return <ServicesWidget projectId="your-project-id" isStagingEnv />;
}
```

### Test Configuration

If you encounter an error related to unknown file extensions in your test (e.g., `.css`), you may need to adjust your Vite configuration. Add the following to your `vite.config.ts` file.

The inlined package will be processed and bundled directly into the application rather than being treated as an external dependency. This is particularly useful for dependencies that include non-JavaScript assets (like CSS).

```
// ... existing code ...
export default defineConfig({
  server: {
    deps: {
      inline: ['@betagouv/les-communs-widget'], // Ensure this dependency is processed correctly
    },
  },
  // ... existing code ...
});
```

## Local Development

### Prerequisites

- Node.js (>= 20)
- pnpm (>= 9.x)
- Running instance of Les Communs API (see api/README.md)

### Setup

1. First, build the widget:

```bash
cd les-communs-widget
pnpm install
pnpm build
```

2. Then, set up the sandbox environment:

```bash
cd ../les-communs-widget-widget-sandbox
pnpm install
```

### Development Workflow

1. Start the API (in a separate terminal):

```bash
cd api
pnpm start:dev
```

2. Start the sandbox development server:

```bash
cd les-communs-widget-widget-sandbox
pnpm dev
```

The sandbox will automatically reload when you make changes to the widget code.

### Testing Your Changes

1. When you want to test your changes, you need to publish the widget locally (we use yalc):

```bash
pnpm dev:widget:publish
```

2. Link the widget sandbox to the published yalc package

```bash
pnpm dev:widget-sandbox:link
```

3. Should you make further updates run the below command to avoid having to re-link the widget sandbox

```bash
pnpm dev:widget:push
```

4. When your testing is done, unlink the widget sandbox

```bash
pnpm dev:widget-sandbox:unlink
```

## Publishing

1. Increase the version number in your package json
2. Update the file CHANGELOG.md accordingly
3. Publish through script below (this will build the widget beforehand)

   ```bash
   pnpm release
   ```
