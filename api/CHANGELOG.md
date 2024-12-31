# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.0.7](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.6...v0.0.7) (2024-12-31)


### Features

* add basic api key guard ([17c4ce2](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/17c4ce2f8c3fb970e1a6c4b5bfac46804ab8de58))
* add basic rate limit ([383f3cf](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/383f3cfd48f6310786bf6dcbbe4319a15dcc54e8))
* add basic service feature ([5e10531](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/5e10531809aab3e93aa810ff2b41d6064f5cbd2b))
* add custom logger ([0ce248b](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/0ce248b1319c8156923a450c8613f40640ae1137))
* add import alias ([2bcde02](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/2bcde021b3d6b53a8ced08a64d8b0d248601e42c))
* add logging interceptor to log requests ([3c35cd1](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/3c35cd124184ff90a01af1c379694bd15eeb9843))
* add permission creation ([#20](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/20)) ([4269648](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/426964830c5deb8997c80b735b53be5c935f65d3))
* add_custom_error_filter ([bb68b1b](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/bb68b1b76f9f503e57ac5de7982fd77a3d55ab4f))
* make log silent in test mode ([d297f14](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/d297f1481b280d745b0b308d45c67aa12710a1d9))
* modify projects controller, service and schema to match latest project modelization ([f642752](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/f642752110a19e2ae93ae2a4debde5fd424a67e1))
* register logging interceptor ([7c1c123](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/7c1c123fee6c516e84c16f215da1858d7a3e78d8))


### Bug Fixes

* adapt tests following data change ([52645c0](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/52645c0cb0c8a3a56e0b9616024ff6065a8e5539))
* add missing dependency for commitlint ([64aa508](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/64aa508cf866ce6e5e213281f853e6e9d3d8efb6))
* add missing files ([0eb011b](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/0eb011b49d8599959457dec92e8e00648c013bce))
* add missing helmet middleware ([be38c63](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/be38c63577ebe4b940983cda0660a27a7544d32a))
* add missing helper file ([efc1ccb](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/efc1ccb9f899de2853947d4bfd38f3bb62398617))
* change import to relative one ([50ca39e](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/50ca39e6a707c9a1288b81dcd4c623ea4e8a8266))
* change path in logger alias resolution ([9dbd29a](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/9dbd29aea00bb0bf598ca3259718e676ff90e15b))
* package json location for dependabot ([310fc12](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/310fc12fcd99bb04d93fc20af4032d23de433c19))

## [0.0.6](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.5...v0.0.6) (2024-11-12)

## [0.0.5](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.3...v0.0.5) (2024-11-12)

### Features

- add project creation ([34d3cb6](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/34d3cb603e28ebb65f08733f834139ceec22698a))

### Bug Fixes

- add missing e2e steps in github action ([b96471c](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/b96471c844abecc0c489f90f57834864ce91b30e))
- add missing setup file ([6c8e836](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/6c8e836c43aa0a7381e6435871b7c98a146f2332))
- add missing updated lockfile ([887aa81](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/887aa818a184d1bb212b4a23b36a5b77dbf0edd2))
- increase e2e timeout to allow time for db to spin up ([e21b29c](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/e21b29c908f6c8b8679cea683fffc6c0b2ae8229))
- make jest timeout in beforeAll test setup ([bcd3039](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/bcd3039d2ee5d176ef1c4558bf2a06a5705a5700))
- use proper syntax for jest hook timeout ([f68ea64](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/f68ea64a382a4193ff542948989b062164ad9226))

## [0.0.4](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.3...v0.0.4) (2024-11-12)

### Features

- add project creation ([34d3cb6](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/34d3cb603e28ebb65f08733f834139ceec22698a))

### Bug Fixes

- add missing e2e steps in github action ([b96471c](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/b96471c844abecc0c489f90f57834864ce91b30e))
- add missing setup file ([6c8e836](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/6c8e836c43aa0a7381e6435871b7c98a146f2332))
- add missing updated lockfile ([887aa81](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/887aa818a184d1bb212b4a23b36a5b77dbf0edd2))
- increase e2e timeout to allow time for db to spin up ([e21b29c](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/e21b29c908f6c8b8679cea683fffc6c0b2ae8229))
- make jest timeout in beforeAll test setup ([bcd3039](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/bcd3039d2ee5d176ef1c4558bf2a06a5705a5700))
- use proper syntax for jest hook timeout ([f68ea64](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/f68ea64a382a4193ff542948989b062164ad9226))

## 0.0.3 (2024-11-08)

### Features

- add husky ([7400a0b](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/7400a0b51eb196ef02f0e0be374272911e51de26))
- add nestjs basic structure with cli ([3622224](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/36222246a11739285fbde7eb02f2dd5dcee99ef6))
- add prisma orm, local db and init migrations ([3bdf872](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/3bdf87261ca6c3f39ddd937cce9adba66076b2a7))
- add prisma seed data ([82f7fa4](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/82f7fa47783799b5b06f31491b8dbcfa87e19cbb))
- add project nest resource ([06e5c62](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/06e5c62b0874da036f2ad38eeb7ba3add3c5cb62))
- add talisman check for secret ([5f5cab0](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/5f5cab0b8c110564820d477fd0ca551657fe5eec))
- add ts and lint check on precommit ([e0f7017](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/e0f7017541d39d98ab89d13f990a0673ecdee448))

### Bug Fixes

- adapt script to launch the server without nest cli ([84cc99e](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/84cc99e4398493a4ddb9f18a1679345c27acb365))
- add back lost licence ([14817b5](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/14817b5b5e259d74b8685f8cf90a91e9d3a81035))
- add prisma generate as part of the build command ([fb4a62b](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/fb4a62b6596242331bc78f78caab584b162d827b))
- add procfile to apply migration postdeployment ([7242911](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/7242911371e6cecf8755446de6f0e65343549a53))
- add the commit-msg script ([02cddab](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/02cddab4bf0ec43f024cad7044cf20ec19311940))
- change local db user for default postgres one ([883cef1](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/883cef159ffcffcadfa1e72087a35c3635734496))
- make use of Nest ConfigModule to load .env properly ([4f57a4e](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/4f57a4e24c0e8db60a8a4946e0102c2d97e2e904))
- modify path to start server ([6a0d474](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/6a0d47425ce6baeeb9b77c7dd229f16db2b4673b))

## 0.0.2 (2024-11-08)

### Features

- add husky ([7400a0b](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/7400a0b51eb196ef02f0e0be374272911e51de26))
- add nestjs basic structure with cli ([3622224](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/36222246a11739285fbde7eb02f2dd5dcee99ef6))
- add prisma orm, local db and init migrations ([3bdf872](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/3bdf87261ca6c3f39ddd937cce9adba66076b2a7))
- add prisma seed data ([82f7fa4](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/82f7fa47783799b5b06f31491b8dbcfa87e19cbb))
- add project nest resource ([06e5c62](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/06e5c62b0874da036f2ad38eeb7ba3add3c5cb62))
- add talisman check for secret ([5f5cab0](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/5f5cab0b8c110564820d477fd0ca551657fe5eec))
- add ts and lint check on precommit ([e0f7017](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/e0f7017541d39d98ab89d13f990a0673ecdee448))

### Bug Fixes

- adapt script to launch the server without nest cli ([84cc99e](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/84cc99e4398493a4ddb9f18a1679345c27acb365))
- add back lost licence ([14817b5](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/14817b5b5e259d74b8685f8cf90a91e9d3a81035))
- add prisma generate as part of the build command ([fb4a62b](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/fb4a62b6596242331bc78f78caab584b162d827b))
- add procfile to apply migration postdeployment ([7242911](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/7242911371e6cecf8755446de6f0e65343549a53))
- add the commit-msg script ([02cddab](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/02cddab4bf0ec43f024cad7044cf20ec19311940))
- change local db user for default postgres one ([883cef1](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/883cef159ffcffcadfa1e72087a35c3635734496))
- make use of Nest ConfigModule to load .env properly ([4f57a4e](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/4f57a4e24c0e8db60a8a4946e0102c2d97e2e904))
- modify path to start server ([6a0d474](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/6a0d47425ce6baeeb9b77c7dd229f16db2b4673b))
