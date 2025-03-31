import { CorsMiddleware, isOriginAllowed } from "./cors.middleware";
import { Request, Response } from "express";

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

        expect(nextFunction).toHaveBeenNthCalledWith(index + 1, new Error(`${origin} not allowed by CORS`));
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

      expect(nextFunction).toHaveBeenCalledWith(new Error(`invalid-url not allowed by CORS`));
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

    it("should throw an error when CORS_ALLOWED_DOMAINS is not set", () => {
      process.env.CORS_ALLOWED_DOMAINS = "";
      expect(isOriginAllowed("http://localhost:3000")).toThrow("CORS_ALLOWED_DOMAINS is not set");
    });
  });
});
