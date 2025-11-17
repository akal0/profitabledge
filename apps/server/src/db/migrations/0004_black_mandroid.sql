CREATE TABLE "historical_prices" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" varchar(64) NOT NULL,
	"timeframe" varchar(16) NOT NULL,
	"time" timestamp NOT NULL,
	"open" numeric NOT NULL,
	"high" numeric NOT NULL,
	"low" numeric NOT NULL,
	"close" numeric NOT NULL
);
