// Set test environment
process.env.NODE_ENV = "test";

// Set required environment variables for tests
process.env.DATABASE_URL = process.env.DATABASE_URL || "postgres://postgres:mypassword@localhost:5432/testdb";
process.env.REDIS_URL = process.env.REDIS_URL || "redis://localhost:6379";
process.env.CORS_ALLOWED_DOMAINS = process.env.CORS_ALLOWED_DOMAINS || "http://localhost:5173,http://localhost:5174";

process.env.QUEUE_BOARD_PWD = process.env.QUEUE_BOARD_PWD || "test-password";
process.env.SERVICE_MANAGEMENT_API_KEY = process.env.SERVICE_MANAGEMENT_API_KEY || "test-service-management-api-key";

process.env.MEC_API_KEY = process.env.MEC_API_KEY || "test-mec-api-key";
process.env.TET_API_KEY = process.env.TET_API_KEY || "test-tet-api-key";
process.env.RECOCO_API_KEY = process.env.RECOCO_API_KEY || "test-recoco-api-key";
process.env.URBAN_VITALIZ_API_KEY = process.env.URBAN_VITALIZ_API_KEY || "test-urban-vitaliz-api-key";
process.env.SOS_PONTS_API_KEY = process.env.SOS_PONTS_API_KEY || "test-sos-ponts-api-key";
process.env.FOND_VERT_API_KEY = process.env.FOND_VERT_API_KEY || "test-fond-vert-api-key";
