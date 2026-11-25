import { CorsMiddleware, isOriginAllowed } from "./cors.middleware";
import { Request, Response } from "express";
import { ForbiddenException } from "@nestjs/common";
import * as Sentry from "@sentry/node";

jest.mock("@sentry/node", () => ({ captureMessage: jest.fn() }));

describe("CorsMiddleware", () => {
  let middleware: CorsMiddleware;
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let nextFunction: jest.Mock;

  beforeEach(() => {
    process.env.CORS_ALLOWED_DOMAINS = undefined;

    middleware = new CorsMiddleware();
    mockResponse = {
      setHeader: jest.fn(),
      getHeader: jest.fn(),
      end: jest.fn(),
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    nextFunction = jest.fn();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // A rejected origin must surface as a 403 (handled by the global exception filter),
  // not as a bare Error that the filter turns into a 500 "Unhandled Exception".
  const expectOriginRejected = (callNumber: number, origin: string) => {
    expect(nextFunction).toHaveBeenCalledTimes(callNumber);
    const [error] = nextFunction.mock.calls[callNumber - 1] as [unknown];
    expect(error).toBeInstanceOf(ForbiddenException);
    expect((error as ForbiddenException).getStatus()).toBe(403);
    expect((error as ForbiddenException).message).toBe(`${origin} not allowed by CORS`);
    // HttpExceptions are not sent to Sentry: a dedicated warning keeps a forgotten partner
    // domain visible, one issue per origin.
    expect(Sentry.captureMessage).toHaveBeenNthCalledWith(callNumber, `CORS origin rejected: ${origin}`, {
      level: "warning",
      tags: { origin },
      fingerprint: ["cors-origin-rejected", origin],
    });
  };

  // in all test when nextFunction is called this means the route was not blocked by CORS middleware
  // either because the route is not CORS enabled or because the origin is allowed

  describe("CORS domain matching", () => {
    const corsEnabledRoute = "/services/project/123";

    beforeEach(() => {
      mockRequest = {
        originalUrl: corsEnabledRoute,
      };
    });

    it("should allow localhost with different ports when localhost is in allowed domains", () => {
      process.env.CORS_ALLOWED_DOMAINS = "localhost,example.com";

      const testCases = [
        "http://localhost:3000",
        "http://localhost:5173",
        "http://localhost",
        "https://localhost:8080",
      ];

      testCases.forEach((origin) => {
        mockRequest.headers = { origin };
        middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalledWith();
      });
      expect(Sentry.captureMessage).not.toHaveBeenCalled();
    });

    it("should allow matching domains and subdomains", () => {
      process.env.CORS_ALLOWED_DOMAINS = "*.example.com,test.com";

      const testCases = ["https://sub.example.com", "https://another.sub.example.com", "https://test.com"];

      testCases.forEach((origin) => {
        mockRequest.headers = { origin };
        middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

        expect(nextFunction).toHaveBeenCalledWith();
      });
    });

    it("should block non-matching domains", () => {
      process.env.CORS_ALLOWED_DOMAINS = "example.com";

      const testCases = ["https://malicious.com", "https://fake-example.com", "https://example.com.malicious.com"];

      testCases.forEach((origin, index) => {
        mockRequest.headers = { origin };
        middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

        expectOriginRejected(index + 1, origin);
      });
    });

    it("should handle non-CORS routes correctly", () => {
      process.env.CORS_ALLOWED_DOMAINS = "example.com";
      mockRequest = {
        originalUrl: "/some-other-route",
        headers: { origin: "https://otherexample.com" },
      };

      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });

    it("should handle invalid URLs", () => {
      process.env.CORS_ALLOWED_DOMAINS = "example.com";

      mockRequest.headers = { origin: "invalid-url" };
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expectOriginRejected(1, "invalid-url");
    });

    it("should allow specific full URLs", () => {
      process.env.CORS_ALLOWED_DOMAINS = "https://mon-espace-collectivite-staging.osc-fr1.scalingo.io,example.com";

      const testCases = ["https://mon-espace-collectivite-staging.osc-fr1.scalingo.io", "https://example.com"];

      testCases.forEach((origin) => {
        mockRequest.headers = { origin };
        middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
        expect(nextFunction).toHaveBeenCalledWith();
      });
    });

    it("should block other same domains urls when specific URL is allowed", () => {
      process.env.CORS_ALLOWED_DOMAINS = "https://mon-espace-collectivite-staging.osc-fr1.scalingo.io";

      const testCases = ["https://other-app.osc-fr1.scalingo.io", "https://malicious-app.osc-fr1.scalingo.io"];

      testCases.forEach((origin, index) => {
        mockRequest.headers = { origin };
        middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);
        expectOriginRejected(index + 1, origin);
      });
    });

    it("should allow requests with no origin (same domain origin)", () => {
      process.env.CORS_ALLOWED_DOMAINS = "example.com";

      mockRequest.headers = { origin: undefined };
      middleware.use(mockRequest as Request, mockResponse as Response, nextFunction);

      expect(nextFunction).toHaveBeenCalledWith();
    });
  });

  describe("isOriginAllowed", () => {
    it("should return true when origin is localhost", () => {
      process.env.CORS_ALLOWED_DOMAINS = "localhost";
      const origin = "http://localhost:3000";
      expect(isOriginAllowed(origin)).toBe(true);
    });

    it("should return true when origin is localhost with different ports", () => {
      process.env.CORS_ALLOWED_DOMAINS = "localhost";
      const origin = "http://localhost:5173";
      expect(isOriginAllowed(origin)).toBe(true);
    });

    it("should return true when domain with subdomain", () => {
      process.env.CORS_ALLOWED_DOMAINS = "*.example.com,test.com";
      const origin = "https://sub.example.com";
      expect(isOriginAllowed(origin)).toBe(true);
    });

    it("should allow full URLs", () => {
      process.env.CORS_ALLOWED_DOMAINS = "https://mon-espace-collectivite-staging.osc-fr1.scalingo.io";
      const origin = "https://mon-espace-collectivite-staging.osc-fr1.scalingo.io";
      expect(isOriginAllowed(origin)).toBe(true);
    });

    it("should throw an error when CORS_ALLOWED_DOMAINS is not set", () => {
      delete process.env.CORS_ALLOWED_DOMAINS;
      expect(() => isOriginAllowed("http://localhost:3000")).toThrow("CORS_ALLOWED_DOMAINS is not set");
    });
  });
});
