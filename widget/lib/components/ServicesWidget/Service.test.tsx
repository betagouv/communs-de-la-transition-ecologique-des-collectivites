import { beforeAll, describe, expect, it, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Service } from "./Service";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import userEvent from "@testing-library/user-event";

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
    id: "1",
    name: "Test Service",
    description: "A".repeat(500), // Create a long description
    logoUrl: "test-logo.png",
    redirectionUrl: "https://test.com",
    redirectionLabel: null,
    extendLabel: null,
    isListed: true,
    extraFields: [],
    sousTitre: "Sous titre",
    iframeUrl: null,
  };

  // Global mock matchMedia return false
  it("should truncate description to 400 characters on desktop", async () => {
    const user = userEvent.setup();
    // Desktop view (default mock above is fine)
    renderWithQueryClient(
      <Service service={mockService} projectExtraFields={[]} projectId="123" isStagingEnv={false} />,
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
        <Service service={mockService} projectExtraFields={[]} projectId="123" isStagingEnv={false} />,
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
          projectId="123"
          isStagingEnv={false}
        />,
      );

      expect(screen.queryByRole("button", { name: /voir plus/i })).not.toBeInTheDocument();
    });
  });
});
