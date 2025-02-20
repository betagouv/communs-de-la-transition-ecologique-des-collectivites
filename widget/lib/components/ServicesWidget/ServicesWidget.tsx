import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InternalServicesWidget } from "./InternalServicesWidget.tsx";
import { ServicesWidgetProps } from "./types.ts";

const queryClient = new QueryClient();

export const ServicesWidget = ({ projectId, isStagingEnv, debug }: ServicesWidgetProps) => {
  return (
    <QueryClientProvider client={queryClient}>
      <InternalServicesWidget projectId={projectId} isStagingEnv={isStagingEnv} debug={debug} />
    </QueryClientProvider>
  );
};
