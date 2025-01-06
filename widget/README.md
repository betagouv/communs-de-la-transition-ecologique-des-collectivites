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
import { LesCommuns } from "@betagouv/les-communs-widget";

function App() {
  return <LesCommuns projectId="your-project-id" />;
}
```

### Staging environment

You can test against the staging environment by passing prop `isStagingEnv`:

```tsx
import { LesCommuns } from "@betagouv/les-communs-widget";

function App() {
  return <LesCommuns projectId="your-project-id" isStagingEnv />;
}
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

1. After making changes to the widget, rebuild it:

```bash
cd les-communs-widget
pnpm build
```

2. The sandbox will automatically pick up the changes since it uses a local file reference:

```json
{
  "dependencies": {
    "les-communs-widget": "file:../les-communs-widget"
  }
}
```

## Publishing

1. Increase the version number in your package json
2. Update the file CHANGELOG.md accordingly
3. Publish through script below (this will build the widget beforehand)

   ```bash
   pnpm release
   ```
