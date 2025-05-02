import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { replaceIframeUrlParams, Service } from "./Service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";
import { ExtraFields } from "./types";
import { Bénéfriche } from "../../test/stub/service.ts";
import { project } from "../../test/stub/project.ts";

describe("Service", () => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });

  const renderWithQueryClient = (component: React.ReactElement) => {
    return render(<QueryClientProvider client={queryClient}>{component}</QueryClientProvider>);
  };

  const mockService = {
    ...Bénéfriche,
    description: "A".repeat(500), // Create a long description
  };

  it("should truncate description to 400 characters on desktop", async () => {
    const user = userEvent.setup();
    // Desktop view (default mock above is fine)
    renderWithQueryClient(
      <Service
        service={mockService}
        projectExtraFields={[]}
        projectId="123"
        isStagingEnv={false}
        projectData={project}
      />,
    );

    const displayedText = screen.getByText(/A+\.{3}$/);
    expect(displayedText.textContent).toHaveLength(400);
    await user.click(screen.getByRole("button", { name: /voir plus/i }));

    const expandedText = screen.getByText(/A+$/);
    expect(expandedText.textContent).toHaveLength(500);
  });

  it("should not display voir plus button when description is less than 400 characters", () => {
    renderWithQueryClient(
      <Service
        service={{ ...mockService, description: "A".repeat(399) }}
        projectExtraFields={[]}
        projectId="123"
        projectData={project}
        isStagingEnv={false}
      />,
    );

    expect(screen.queryByRole("button", { name: /voir plus/i })).not.toBeInTheDocument();
  });

  describe("Mobile", () => {
    beforeAll(() => {
      // Override matchMedia mock for mobile
      window.matchMedia = vi.fn().mockImplementation((query) => ({
        matches: true, // true = mobile
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      }));
    });

    it("should truncate description to 200 characters on mobile", async () => {
      const user = userEvent.setup();

      renderWithQueryClient(
        <Service
          service={mockService}
          projectExtraFields={[]}
          projectId="123"
          isStagingEnv={false}
          projectData={project}
        />,
      );

      const displayedText = screen.getByText(/A+\.{3}$/);
      expect(displayedText.textContent).toHaveLength(200);

      await user.click(screen.getByRole("button", { name: /voir plus/i }));

      const expandedText = screen.getByText(/A+$/);
      expect(expandedText.textContent).toHaveLength(500);
    });

    it("should not display voir plus button when description is less than 200 characters on mobile", () => {
      renderWithQueryClient(
        <Service
          service={{ ...mockService, description: "A".repeat(199) }}
          projectExtraFields={[]}
          projectData={project}
          projectId="123"
          isStagingEnv={false}
        />,
      );

      expect(screen.queryByRole("button", { name: /voir plus/i })).not.toBeInTheDocument();
    });
  });

  describe("replaceIframeUrlParams", () => {
    const collectivite = project.collectivites[0];
    it("should replace hardcoded parameters from projectData", () => {
      const url = "https://example.com?type={collectiviteType}&code={collectiviteCode}";

      const result = replaceIframeUrlParams(url, project, []);
      expect(result).toBe(`https://example.com?type=${collectivite.type}&code=${collectivite.siren}`);
    });

    it("should replace parameters from extraFields", () => {
      const url = "https://example.com?param1={param1}&param2={param2}";
      const extraFields: ExtraFields = [
        { name: "param1", value: "value1" },
        { name: "param2", value: "value2" },
      ];
      const result = replaceIframeUrlParams(url, project, extraFields);
      expect(result).toBe("https://example.com?param1=value1&param2=value2");
    });

    it("should handle both projectData and extraFields parameters", () => {
      const url =
        "https://example.com?type={collectiviteType}&code={collectiviteCode}&libelle={collectiviteLabel}&param={customParam}";

      const extraFields: ExtraFields = [{ name: "customParam", value: "customValue" }];
      const result = replaceIframeUrlParams(url, project, extraFields);
      expect(result).toBe(
        `https://example.com?type=${collectivite.type}&code=${collectivite.siren}&libelle=L'Abergement-Cl%C3%A9menciat&param=customValue`,
      );
    });

    it("should remove unfilled parameters", () => {
      const url = "https://example.com?type={collectiviteType}&missing={missingParam}";

      const result = replaceIframeUrlParams(url, project, []);
      expect(result).toBe(`https://example.com?type=${collectivite.type}&missing=`);
    });

    it("should prioritize hardcoded parameters over extraFields with the same name", () => {
      const url = "https://example.com?type={collectiviteType}";

      const extraFields: ExtraFields = [{ name: "collectiviteType", value: "fromExtraFields" }];
      const result = replaceIframeUrlParams(url, project, extraFields);
      expect(result).toBe(`https://example.com?type=${collectivite.type}`);
    });
  });
});
