CREATE TYPE "public"."incident_event_type" AS ENUM('CREATED', 'UPDATED', 'ASSIGNED', 'STATUS_CHANGED');--> statement-breakpoint
CREATE TYPE "public"."incident_status" AS ENUM('OPEN', 'IN_PROGRESS', 'PENDING_THIRD_PARTY', 'RESOLVED', 'CLOSED', 'REJECTED', 'REOPENED');--> statement-breakpoint
CREATE TYPE "public"."priority" AS ENUM('LOW', 'MEDIUM', 'HIGH', 'URGENT');--> statement-breakpoint
CREATE TABLE "code_counters" (
	"year" integer PRIMARY KEY NOT NULL,
	"last_value" integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"incident_id" uuid NOT NULL,
	"type" "incident_event_type" NOT NULL,
	"actor_id" uuid NOT NULL,
	"data" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "incident_types" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"default_department_id" uuid NOT NULL,
	CONSTRAINT "incident_types_code_unique" UNIQUE("code")
);
--> statement-breakpoint
CREATE TABLE "incidents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"title" varchar(150) NOT NULL,
	"description" text NOT NULL,
	"type_id" uuid NOT NULL,
	"department_id" uuid NOT NULL,
	"priority" "priority" NOT NULL,
	"status" "incident_status" DEFAULT 'OPEN' NOT NULL,
	"created_by" uuid NOT NULL,
	"assigned_to" uuid,
	"due_date" date,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"resolved_at" timestamp with time zone,
	"closed_at" timestamp with time zone,
	CONSTRAINT "incidents_code_unique" UNIQUE("code")
);
--> statement-breakpoint
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_incident_id_incidents_id_fk" FOREIGN KEY ("incident_id") REFERENCES "public"."incidents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_events" ADD CONSTRAINT "incident_events_actor_id_users_id_fk" FOREIGN KEY ("actor_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incident_types" ADD CONSTRAINT "incident_types_default_department_id_departments_id_fk" FOREIGN KEY ("default_department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_type_id_incident_types_id_fk" FOREIGN KEY ("type_id") REFERENCES "public"."incident_types"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_department_id_departments_id_fk" FOREIGN KEY ("department_id") REFERENCES "public"."departments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "incidents" ADD CONSTRAINT "incidents_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "incident_events_incident_id_created_at_idx" ON "incident_events" USING btree ("incident_id","created_at");--> statement-breakpoint
CREATE INDEX "incidents_department_id_idx" ON "incidents" USING btree ("department_id");--> statement-breakpoint
CREATE INDEX "incidents_created_by_idx" ON "incidents" USING btree ("created_by");--> statement-breakpoint
CREATE INDEX "incidents_assigned_to_idx" ON "incidents" USING btree ("assigned_to");--> statement-breakpoint
CREATE INDEX "incidents_created_at_idx" ON "incidents" USING btree ("created_at");