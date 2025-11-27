# Communs de la transition écologique des collectivités


**Les Communs** are a project that has 2 main objectives :

- "dites-le nous une fois" : make sure that a project entered on a platform is available on other platforms. 
- help with service deployment by making services discoverable through the project page on the different platforms

To achieve those objectives, there are 2 main components :

- an API / database to centralize project information  ([API documentation](api/README.md))
- a front widget responsible for linking project with services ([Widget documentation](widget/README.md))

## 📦 Package Manager

> **⚠️ CRITICAL: This project uses [pnpm](https://pnpm.io/) exclusively.**
>
> **DO NOT use `npm install` or `yarn install`.** Using npm/yarn will:
> - Bypass security protections (script execution controls)
> - Create wrong lockfiles (package-lock.json)
> - Break dependency resolution
> - Be rejected by Git hooks during commit
>
> **Always use `pnpm install` or `pnpm add <package>`**

### 🚀 Initial Setup

After cloning the repository, follow these steps:

```bash
# 1. Enable Corepack (one-time setup per machine)
corepack enable

# 2. Install dependencies (with script execution disabled for security)
pnpm install

# 3. Setup Git hooks (required for commit validation)
pnpm prepare

# 4. Verify hooks are installed
ls -la .git/hooks/pre-commit
```

**⚠️ Important**: Step 3 (`pnpm prepare`) is **required** to enable Git hooks. Without it:
- Pre-commit validation won't run
- Commit message linting won't work
- Wrong lockfiles could be committed

You can verify hooks are set up by running:
```bash
pnpm check-hooks
```

### 🔒 Security: Script Execution Disabled

This project uses `ignore-scripts=true` in `.npmrc` to **prevent automatic execution of dependency scripts** during installation. This protects against supply chain attacks where malicious packages execute code via `preinstall`/`postinstall` scripts.

**What this means:**
- ✅ **Safer installations**: Dependency scripts don't run automatically
- ✅ **Supply chain protection**: Malicious preinstall scripts are blocked
- ⚠️ **Manual Husky setup**: Must run `pnpm prepare` after `pnpm install`

### Why pnpm?

- **Disk space efficiency**: Shared dependency storage across projects
- **Security**: Strict dependency resolution and non-flat node_modules
- **Performance**: Faster installation and better monorepo support
- **Reliability**: Lockfile consistency and version enforcement

### Enforcement

The project enforces pnpm-only usage through multiple defensive layers:

1. **Engine version blocking**:
   - `engines.npm: "use-pnpm-instead"` and `engines.yarn: "use-pnpm-instead"` in package.json
   - Blocks npm/yarn with engine incompatibility errors
   - Works regardless of `ignore-scripts` setting (native package manager feature)
   - Immediate, hard blocking at install time

2. **Pre-commit validation**:
   - Git hooks block npm/yarn lockfiles from being committed
   - Prevents accidental commits of wrong dependencies

3. **Manual verification**:
   ```bash
   pnpm check-package-manager  # Verify no npm/yarn lockfiles exist
   ```

4. **Configuration**:
   - `engine-strict=true` in `.npmrc` enforces version requirements
   - `ignore-scripts=true` disables dependency scripts for security

5. **CI/CD**: GitHub Actions validates pnpm usage

**Why this works**: The `engines.npm` and `engines.yarn` fields with invalid versions + `engine-strict=true` cause npm/yarn to fail immediately with clear error messages, while pnpm ignores these constraints and works normally.

---

Roadmap is here : (ask for permission to access it if you do not have it yet) https://github.com/orgs/betagouv/projects/129/views/2

