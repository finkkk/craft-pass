-- CreateTable
CREATE TABLE "applications" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "qq_number" TEXT NOT NULL,
    "minecraft_id" TEXT NOT NULL,
    "minecraft_id_normalized" TEXT NOT NULL,
    "score" INTEGER NOT NULL,
    "passed_quiz" BOOLEAN NOT NULL,
    "status" TEXT NOT NULL,
    "agreement_version" TEXT NOT NULL,
    "signed_at" DATETIME NOT NULL,
    "reviewed_at" DATETIME,
    "reviewer_id" TEXT,
    "reject_reason" TEXT,
    "ip_address" TEXT,
    "user_agent" TEXT,
    "answers_json" JSONB NOT NULL,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL,
    CONSTRAINT "applications_reviewer_id_fkey" FOREIGN KEY ("reviewer_id") REFERENCES "admins" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "admins" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password_hash" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'admin',
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "admin_logs" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "admin_id" TEXT,
    "action" TEXT NOT NULL,
    "target_application_id" TEXT,
    "detail" JSONB,
    "ip_address" TEXT,
    "created_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "admin_logs_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "admin_logs_target_application_id_fkey" FOREIGN KEY ("target_application_id") REFERENCES "applications" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "rcon_attempts" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "application_id" TEXT NOT NULL,
    "admin_id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "response" TEXT,
    "error_message" TEXT,
    "started_at" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finished_at" DATETIME,
    CONSTRAINT "rcon_attempts_application_id_fkey" FOREIGN KEY ("application_id") REFERENCES "applications" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "rcon_attempts_admin_id_fkey" FOREIGN KEY ("admin_id") REFERENCES "admins" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE INDEX "applications_status_created_at_idx" ON "applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "applications_minecraft_id_normalized_idx" ON "applications"("minecraft_id_normalized");

-- CreateIndex
CREATE INDEX "applications_qq_number_created_at_idx" ON "applications"("qq_number", "created_at");

-- CreateIndex
CREATE INDEX "applications_ip_address_created_at_idx" ON "applications"("ip_address", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "admins_username_key" ON "admins"("username");

-- CreateIndex
CREATE INDEX "admin_logs_admin_id_created_at_idx" ON "admin_logs"("admin_id", "created_at");

-- CreateIndex
CREATE INDEX "admin_logs_target_application_id_created_at_idx" ON "admin_logs"("target_application_id", "created_at");

-- CreateIndex
CREATE INDEX "rcon_attempts_application_id_started_at_idx" ON "rcon_attempts"("application_id", "started_at");

-- CreateIndex
CREATE INDEX "rcon_attempts_status_started_at_idx" ON "rcon_attempts"("status", "started_at");
