CREATE TABLE "daily_vocabulary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"latvian_word" text NOT NULL,
	"english_translation" text NOT NULL,
	"context" text,
	"topic" text NOT NULL,
	"date" date NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
