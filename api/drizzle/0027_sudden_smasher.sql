CREATE TABLE "api_requests" (
	"id" uuid PRIMARY KEY NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"method" text NOT NULL,
	"endpoint" text NOT NULL,
	"full_url" text NOT NULL,
	"status_code" integer NOT NULL,
	"response_time" integer NOT NULL,
	"service_name" text
);
