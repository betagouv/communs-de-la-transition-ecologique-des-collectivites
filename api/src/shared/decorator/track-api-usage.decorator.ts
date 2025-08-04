import { SetMetadata } from "@nestjs/common";

export const TRACK_API_USAGE_KEY = "shouldTrackApiUsage";

export const TrackApiUsage = () => SetMetadata(TRACK_API_USAGE_KEY, true);
