import type { CustomLogger } from "@logging/logger.service";

/** Posts to a Mattermost incoming webhook; never throws, a failed notification is only logged. */
export async function notifyMattermost(
  webhookUrl: string | undefined,
  text: string,
  logger: Pick<CustomLogger, "warn">,
): Promise<void> {
  if (!webhookUrl) return;

  try {
    await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });
  } catch (error) {
    logger.warn("Failed to send Mattermost notification", {
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }
}
