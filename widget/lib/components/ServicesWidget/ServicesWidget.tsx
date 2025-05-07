import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { InternalServicesWidget } from "./InternalServicesWidget.tsx";
import { useEffect } from "react";
import { initMatomo } from "../../matomo/initMatomo.ts";
import { ServicesWidgetProps } from "./types.ts";

const queryClient = new QueryClient();

export const ServicesWidget = (props: ServicesWidgetProps) => {
  useEffect(() => {
    initMatomo();
  }, []);

  return (
    <QueryClientProvider client={queryClient}>
      <InternalServicesWidget {...props} />
    </QueryClientProvider>
  );
};
