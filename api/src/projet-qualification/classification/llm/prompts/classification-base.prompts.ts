/**
 * System prompt for project classification — terse, as in the Python pipeline.
 */
export const SYSTEM_PROMPT_CLASSIFICATION = `Tu es un expert en classification sémantique.`;

/**
 * System prompt for aide classification.
 *
 * Une aide se classifie INDIRECTEMENT : l'objet de la classification n'est pas
 * l'aide mais le type de projet qu'elle finance. Sans ce cadrage, le LLM colle
 * à l'aide ses propres caractéristiques — typiquement les labels de financement,
 * une aide étant par nature un dispositif financier.
 */
export const SYSTEM_PROMPT_CLASSIFICATION_AIDE = `Tu es un expert en classification sémantique des aides publiques.

Tu ne classifies pas l'aide elle-même, mais le type de projet qu'elle finance.
Une aide étant par nature un dispositif financier, ne lui attribue pas les
labels de financement (ex. « Structuration du financement ») pour cette seule
raison : réserve-les aux cas où le projet soutenu porte lui-même sur le
financement (ex. une aide à l'achat de vélos électriques).`;
