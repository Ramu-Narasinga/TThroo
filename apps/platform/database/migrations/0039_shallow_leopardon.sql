CREATE TABLE "inbox_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"type" text NOT NULL,
	"severity" text DEFAULT 'info' NOT NULL,
	"repository_id" uuid NOT NULL,
	"issue_board_state_id" uuid,
	"issue_number" integer NOT NULL,
	"issue_title" text NOT NULL,
	"title" text NOT NULL,
	"body" text,
	"actor_type" text DEFAULT 'agent' NOT NULL,
	"agent_id" uuid,
	"details" text,
	"read" boolean DEFAULT false NOT NULL,
	"archived" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "inbox_items" ENABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_repository_id_repositories_id_fk" FOREIGN KEY ("repository_id") REFERENCES "public"."repositories"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "inbox_items" ADD CONSTRAINT "inbox_items_issue_board_state_id_issue_board_states_id_fk" FOREIGN KEY ("issue_board_state_id") REFERENCES "public"."issue_board_states"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE POLICY "inbox_items_select" ON "inbox_items" AS PERMISSIVE FOR SELECT TO "authenticated" USING ((auth.uid() = "inbox_items"."user_id"));--> statement-breakpoint
CREATE POLICY "inbox_items_update" ON "inbox_items" AS PERMISSIVE FOR UPDATE TO "authenticated" USING ((auth.uid() = "inbox_items"."user_id"));