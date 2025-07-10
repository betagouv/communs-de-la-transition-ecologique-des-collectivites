import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InternalServicesWidget } from "./InternalServicesWidget.tsx";
import { ServicesWidgetProps } from "./types.ts";

const queryClient = new QueryClient();

export const ServicesWidget = (props: ServicesWidgetProps) => {
  if (props.projectId && props.context) {
    throw new Error(
      "ServicesWidget: Cannot use both 'projectId' and 'context' props. " +
        "Use 'projectId' for project mode or 'context' for context mode, but not both.",
    );
  }

  if (!props.projectId && !props.context) {
    throw new Error(
      "ServicesWidget: Must provide either 'projectId' or 'context' prop. " +
        "Use 'projectId' for project mode or 'context' for context mode.",
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <InternalServicesWidget {...props} />
    </QueryClientProvider>
  );
};
