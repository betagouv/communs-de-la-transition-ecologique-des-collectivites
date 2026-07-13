-- « À intégrer MEC » devient « profil généraliste ».
--
-- POURQUOI. La colonne servait de VERROU DE CURATION : seuls les services `oui` étaient
-- proposés (28 sur 125). Elle décrivait une décision prise SUR MEC — un critère de sélection,
-- que l'API ne pouvait donc pas exposer sans le faire traverser la frontière (§1 de la spec :
-- aucun critère de sélection ne franchit la frontière, sinon la règle métier existe en deux
-- exemplaires et diverge).
--
-- Renommée, elle décrit une PROPRIÉTÉ DU SERVICE (est-il utilisable par un agent non
-- spécialiste ?), au même titre que `niveau_expertise`. À ce titre elle peut être exposée, et
-- le client peut filtrer dessus sans dupliquer la moindre règle.
--
-- Conséquence : le verrou disparaît. C'est désormais le SCORE seul (plus le fallback
-- générique) qui décide qu'un service est proposé — comme pour les aides et les
-- questionnaires. Le catalogue utile passe d'environ 28 à environ 70 services : les 51 lignes
-- non renseignées du benchmark (ni thématique, ni catégorie) s'éliminent d'elles-mêmes, leur
-- score étant nul.
ALTER TABLE "services_numeriques" RENAME COLUMN "a_integrer_mec" TO "profil_generaliste";

ALTER INDEX "services_numeriques_a_integrer_mec_idx" RENAME TO "services_numeriques_profil_generaliste_idx";
