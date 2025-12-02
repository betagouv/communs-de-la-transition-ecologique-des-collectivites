# Changelog

All notable changes to this project will be documented in this file. See [commit-and-tag-version](https://github.com/absolute-version/commit-and-tag-version) for commit guidelines.

## [0.1.3](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.1.2...v0.1.3) (2025-12-02)


### Bug Fixes

* **ci:** add working-directory override for production deployment ([c8b1908](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/c8b1908372d0a7b29b16c290c8807d1ed21e9bf2))

## [0.1.2](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.1.1...v0.1.2) (2025-12-02)


### Bug Fixes

* **ci:** add prettier formatting after package.json patching in deployments ([736af43](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/736af43ad9e0714db000bccaba793e3144531b25))
* **ci:** bypass pre-commit hooks for ephemeral deployment commits ([74d24f4](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/74d24f4e5bbecce88b500414275a48bc1576c6fb))

## [0.1.1](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.1.0...v0.1.1) (2025-12-02)


### Bug Fixes

* **ci:** resolve silent production deployment failures ([d7e2dd7](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/d7e2dd740f355c05eba545255384ca5d74b0b8f5)), closes [#306](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/306)

## [0.1.0](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.28...v0.1.0) (2025-12-01)


### ⚠ BREAKING CHANGES

* **deps:** Developers must use pnpm exclusively. Using npm or
yarn will result in blocked commits and installation errors from any
directory in the project, including workspace subdirectories.

* **deps:** enhance supply chain security with multi-layered pnpm enforcement ([febe3a4](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/febe3a4c4375409576f393ed81ef86d521178f6a))


### Features

* **api:** add /qualification/leviers endpoint ([629890d](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/629890d6e0f97fd2827f33c40c9153ea32b65fe9))
* **api:** remove raisonnement field from leviers API response ([1ae1208](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/1ae1208d0218ceeb0b0dd2990b61ebdf07f8693d))
* **security:** add 7-day minimum release age for packages ([54b34b5](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/54b34b5fecc107bf4329a2def3c3cf35bce0b772))


### Bug Fixes

* **ci:** patch BOTH package.json files for Scalingo deployment ([01fae9e](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/01fae9e81e17f7674203ddff15ad74689b891daa)), closes [#301](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/301)
* **ci:** patch package.json during deployment to fix Scalingo buildpack ([50b211e](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/50b211e200ed79b708fd57f7765823e7e1ce21ff)), closes [#300](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/300)
* **ci:** resolve Scalingo deployment failures and add error detection ([1d404bb](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/1d404bb9413bb3b40abf89618076414717837f1f))
* **ci:** resolve silent deployment failures with force push and PIPESTATUS ([84cc9bc](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/84cc9bcb7e69242ebebf99535f1b1f0bc4adee8b))
* **ci:** run install and prepare from root directory ([24d365a](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/24d365ae951c0f8f2c95c8e9e32bec6eb7ab9a3b)), closes [#296](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/296) [#296](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/296)
* **ci:** run pnpm prepare from root directory in GitHub Actions ([a2d515a](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/a2d515adeec15c0b60f11096f40da5da13696b6f)), closes [#296](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/296)
* **ci:** set working-directory to root for package.json patching step ([c82dfa7](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/c82dfa7cba1f15f12db66e54faa24a33713e1585))
* **tests:** replace toBeInstanceOf(Array) with Array.isArray() ([0f38b19](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/0f38b19a591f642ab0beb1189f7d7b60e6cc58d3))
* **tests:** resolve E2E pool lifecycle and test isolation issues ([251826c](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/251826cf8a83885ffd0474407648af0c43aba73b))
* use onlyBuiltDependencies instead of ignore-scripts ([3379ddc](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/3379ddcf8b6d119da70512d396988bc7be8d805d)), closes [#296](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/296) [#298](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/298)

## [0.0.28](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.27...v0.0.28) (2025-11-24)


### Bug Fixes

* **deploy:** remove Python buildpack after TypeScript migration ([0082aeb](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/0082aebe0dfb718238f1448827b71e576c8c55e6))
* **deploy:** update Node.js engines to fix Scalingo corepack issue ([2b7d6e0](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/2b7d6e0d9a0f03197b410c7bd2f1de3af98eab8e))

## [0.0.27](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.26...v0.0.27) (2025-11-24)


### Features

* ajout leviers thématique FNV "Mieux s'adapter" ([bea8580](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/bea858018fec93f53cb7b5574530d2fbfa0d9450))
* **projet-qualification:** add 23 new climate adaptation levers ([c9bcfaf](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/c9bcfaf3e75608a489a99e87133e9e8d5a17b527))
* **projet-qualification:** add analyzeLeviers method with integration test coverage ([815839c](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/815839c7b0119ddf0796d2387f6fa0ac5d91945d))


### Bug Fixes

* **test:** add 10s timeout to afterAll hooks for CI stability ([fa51fc2](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/fa51fc2bdbe126972cd4bb036957c637fddc88d9))

## [0.0.26](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.25...v0.0.26) (2025-08-04)


### Features

* remove MATOMO_SITE_ID_PROD in favor of existing matomo_site_id ([#243](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/243)) ([a5e39b0](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/a5e39b03b5c9dc472cf914a8247f7834e37c036c))


### Bug Fixes

* only trigger sentry error on real error in job queue ([#242](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/242)) ([c1fa288](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/c1fa28815fe9b6d8a7e4f159ee677e755c666c3a))

## [0.0.25](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.24...v0.0.25) (2025-08-04)

## [0.0.24](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.23...v0.0.24) (2025-08-04)


### Features

* make dev env the default env ([#233](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/233)) ([4d8313e](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/4d8313e2e2119863e8142e157310df98463ae83b))
* queue job errors uploaded on sentry ([#239](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/239)) ([6101c7d](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/6101c7dba854e1f58b3242c44710b817c6603bd9))

## [0.0.23](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.22...v0.0.23) (2025-07-30)


### Features

* add debug mode button for widget sandbox ([#223](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/223)) ([0492831](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/04928316cd57392de8a70da6579cfb70d19e516d))
* add more api keys for services ([#225](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/225)) ([6768e25](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/6768e2526418b2366ea1f4f0eb98b8df17cc89dc))

## [0.0.22](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.21...v0.0.22) (2025-07-15)

## [0.0.21](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.20...v0.0.21) (2025-07-15)


### Features

* add database section for statistics page ([#213](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/213)) ([e66ccb7](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/e66ccb7b17aa9313700abd51539d9b149d63a236))
* integrate early feedback on widget stats ([#211](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/211)) ([5607829](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/56078294b9b09ec52168e3944141e7bf3bb9ceac))
* remove wip banner ([#214](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/214)) ([7b9e42a](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/7b9e42a196a1331bde190a1fa9ee53963affe5e3))


### Bug Fixes

* typo in stat page ([#212](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/212)) ([cb3b8ed](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/cb3b8eda0d13cfce3133f7bae89c9de8ce8aa3a9))

## [0.0.20](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.19...v0.0.20) (2025-06-11)


### Features

* add communes project to tet import ([#196](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/196)) ([cd46a66](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/cd46a66440b208e2b356aa380605a911969abbd3))
* add individual logging for failing record during update ([#205](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/205)) ([02084c7](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/02084c7fdb7c4126290c6ae7f1b3d6d0b6e25812))
* add leviers qualification job ([#199](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/199)) ([296f1b3](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/296f1b37cc5841be65c91599ec36e0c0411b99b1))
* bump widget version ([#198](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/198)) ([f76e13b](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/f76e13b2d7c0837d2350bc1134a97bcf65a46e50))
* preserve description formatting ([#197](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/197)) ([0d47b53](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/0d47b530df67ee0cfb4764b733e48c4465efd50e))
* support epciCodeSiren param in iframe ([#201](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/201)) ([70e65b9](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/70e65b9c2f64d3945c7bdd787b96f64d11929888))

## [0.0.19](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.17...v0.0.19) (2025-05-28)


### Features

* add nom to description for llm qualification job ([#193](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/193)) ([5ad8794](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/5ad879485f6f6a58a5f481c2aca0b12ac2ed40d0))

## [0.0.18](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.17...v0.0.18) (2025-05-23)

## [0.0.17](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.16...v0.0.17) (2025-05-22)

## [0.0.16](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.15...v0.0.16) (2025-05-21)


### Features

* wip import script for tet ([#49](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/49)) ([1719573](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/1719573864d05ef908efa4cbd131aaaab7b5f612))

## [0.0.15](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.14...v0.0.15) (2025-05-19)

## [0.0.14](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.13...v0.0.14) (2025-05-08)

## [0.0.13](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.12...v0.0.13) (2025-04-08)


### Features

* add 4xx errors as warning in logs ([#137](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/137)) ([2525d0b](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/2525d0ba7e740cd3054ab14632afdf621ab9479e))
* add body to 4xx error logs ([#139](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/139)) ([972d403](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/972d403d4885e8421ae022126ad5d9ff47d20201))
* add new csv service context following leviers changes ([#136](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/136)) ([aeeae8a](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/aeeae8af7a2806db09c695713ced36171bb8833e))
* remove en savoir plus and publish new version of the widget ([#141](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/141)) ([79c5b56](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/79c5b56bf4327c03a5a657bba5ae8e336e51f951))

## [0.0.12](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.11...v0.0.12) (2025-04-08)

## [0.0.11](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.10...v0.0.11) (2025-04-07)


### Features

* adapt widget following project endpoint rename ([d5c171e](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/d5c171ea8eeea74912227ecc4dc3f508e9c6f3fa))
* add isListed badge in debug mode ([#109](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/109)) ([135ef6f](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/135ef6f120f0cd10e2495c2a507b7c8dc807d599))
* adjust subtitle according to design ([#126](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/126)) ([ba1f7f9](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/ba1f7f9b20317909af58b0adf51b257cb3bda398))
* init matomo ([526a447](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/526a4478c98281cb2f42c6674319d28c5c681af0))
* make backend serve demo-widget ([7709383](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/7709383d87d3aa914495b962aa911528fbda1e7e))
* make create endpoint using upsert instead of create ([#120](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/120)) ([7c38fed](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/7c38fed7756bdee12a45f6743a9113aea71be422))
* make import service script compatible with null value for matching criteria ([#114](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/114)) ([636d854](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/636d85407a29f0f8dfbbfdaa4a33f8c005f0575f))
* make matching criteria nullable for service context ([#113](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/113)) ([316a259](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/316a259839ea1c32223583a4376141958a3a2bd5))
* rename Etude to Etude with accent ([#133](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/133)) ([da618b5](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/da618b583cd7bfeafb8891d8880a3a64f7d2a504))


### Bug Fixes

* adapt apiproperty to allow null value for service create dto ([95ce5ab](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/95ce5abee61675a2a6ee6b1bff9b833d66528f6a))
* allow request for widget when no origin ([#131](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/131)) ([a86c7cd](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/a86c7cd19da39655cd237d415d41b1df456fed72))
* make swagger example valid commune and epci ([#122](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/122)) ([de0f096](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/de0f096beaa705e2dd4be13200ef207d6f50da24))

## [0.0.10](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.9...v0.0.10) (2025-03-11)

## [0.0.9](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.8...v0.0.9) (2025-03-10)

## [0.0.8](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/compare/v0.0.7...v0.0.8) (2025-03-10)


### Features

* add competences and sous competences ([#31](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/31)) ([ad02056](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/ad02056063c56fa932472bec4451015edf7bf004))
* add isListed flag in service ([#44](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/44)) ([589de85](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/589de850a387fe24fd69e2ab99877ba016a45c07))
* add proper nested validation error message ([#36](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/36)) ([ba29868](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/ba29868adbfc1af63438f2e12fccfd59175a683d))
* add props to setup api url ([#30](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/30)) ([8f7078c](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/8f7078c37fd01d73842a25f6613aa27cfc165167))
* add script to import service ([#46](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/issues/46)) ([7417743](https://github.com/betagouv/communs-de-la-transition-ecologique-des-collectivites/commit/74177432db049e54d60a9a8c82b799086188ceea))

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
