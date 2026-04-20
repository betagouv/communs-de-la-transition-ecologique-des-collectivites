export const BATCH_CLASSIFICATION_QUEUE_NAME = "batch-classification";
export const BATCH_SUBMIT_JOB = "submit";
export const BATCH_POLL_JOB = "poll";
export const BATCH_PROCESS_JOB = "process";

/** Max requests per Anthropic batch */
export const ANTHROPIC_BATCH_MAX_REQUESTS = 100_000;

/** Polling interval for batch status checks */
export const POLL_DELAY_MS = 5 * 60 * 1000; // 5 minutes

/** Max poll attempts (~25h at 5 min intervals) */
export const MAX_POLL_ATTEMPTS = 300;

/** DB write chunk size */
export const DB_WRITE_CHUNK_SIZE = 500;

/** Classification axes */
export const CLASSIFICATION_AXES = ["thematiques", "sites", "interventions"] as const;
export type ClassificationAxis = (typeof CLASSIFICATION_AXES)[number];
