using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace WordQuest.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "app_user",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    role = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    display_name = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    email = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    password_hash = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    is_active = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_login_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_app_user", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "gamification_profile",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    xp = table.Column<int>(type: "integer", nullable: false),
                    coins = table.Column<int>(type: "integer", nullable: false),
                    current_streak = table.Column<int>(type: "integer", nullable: false),
                    longest_streak = table.Column<int>(type: "integer", nullable: false),
                    last_active_date = table.Column<DateOnly>(type: "date", nullable: true),
                    streak_savers_left = table.Column<int>(type: "integer", nullable: false, defaultValue: 2),
                    streak_saver_period = table.Column<string>(type: "character varying(7)", maxLength: 7, nullable: true),
                    mastered_since_last_card = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_gamification_profile", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "learning_session",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    learner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    set_id = table.Column<Guid>(type: "uuid", nullable: true),
                    game_key = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    completed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    xp_awarded = table.Column<int>(type: "integer", nullable: false),
                    coins_awarded = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_learning_session", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "refresh_token",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    replaced_by_token_hash = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_refresh_token", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "review_log",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    learner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    card_id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: true),
                    game_key = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    grade = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    answer_ms = table.Column<int>(type: "integer", nullable: false),
                    given_answer = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    resulting_interval_days = table.Column<double>(type: "double precision", nullable: false),
                    reviewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_review_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "review_state",
                columns: table => new
                {
                    learner_id = table.Column<Guid>(type: "uuid", nullable: false),
                    card_id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    ease_factor = table.Column<double>(type: "double precision", nullable: false, defaultValue: 2.5),
                    interval_days = table.Column<double>(type: "double precision", nullable: false),
                    repetitions = table.Column<int>(type: "integer", nullable: false),
                    lapses = table.Column<int>(type: "integer", nullable: false),
                    due_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    first_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_reviewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    last_grade = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    state = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_review_state", x => new { x.learner_id, x.card_id });
                });

            migrationBuilder.CreateTable(
                name: "tenant",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    type = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    require_pin_every_session = table.Column<bool>(type: "boolean", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_tenant", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "vocabulary_set",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    title = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    description = table.Column<string>(type: "character varying(2000)", maxLength: 2000, nullable: true),
                    source_language = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    target_language = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    created_by_user_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_vocabulary_set", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "learner_profile",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    avatar_key = table.Column<string>(type: "character varying(50)", maxLength: 50, nullable: false),
                    pin_hash = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    daily_new_limit = table.Column<int>(type: "integer", nullable: false, defaultValue: 5),
                    speed = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    sound_enabled = table.Column<bool>(type: "boolean", nullable: false),
                    failed_pin_attempts = table.Column<int>(type: "integer", nullable: false),
                    pin_locked_until = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_learner_profile", x => x.id);
                    table.ForeignKey(
                        name: "fk_learner_profile_app_user_id",
                        column: x => x.id,
                        principalTable: "app_user",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "session_item",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    card_id = table.Column<Guid>(type: "uuid", nullable: false),
                    position = table.Column<int>(type: "integer", nullable: false),
                    is_retry = table.Column<bool>(type: "boolean", nullable: false),
                    answered_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    grade = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    given_answer = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    answer_ms = table.Column<int>(type: "integer", nullable: true),
                    client_answer_id = table.Column<Guid>(type: "uuid", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_session_item", x => x.id);
                    table.ForeignKey(
                        name: "fk_session_item_learning_session_session_id",
                        column: x => x.session_id,
                        principalTable: "learning_session",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "vocabulary_entry",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    set_id = table.Column<Guid>(type: "uuid", nullable: false),
                    source_text = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    target_text = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    target_alternatives = table.Column<string[]>(type: "text[]", nullable: false),
                    source_alternatives = table.Column<string[]>(type: "text[]", nullable: false),
                    part_of_speech = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    example_source = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    example_target = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    emoji = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    audio_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    position = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_vocabulary_entry", x => x.id);
                    table.ForeignKey(
                        name: "fk_vocabulary_entry_vocabulary_set_set_id",
                        column: x => x.set_id,
                        principalTable: "vocabulary_set",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "card",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    entry_id = table.Column<Guid>(type: "uuid", nullable: false),
                    direction = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_card", x => x.id);
                    table.ForeignKey(
                        name: "fk_card_vocabulary_entry_entry_id",
                        column: x => x.entry_id,
                        principalTable: "vocabulary_entry",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_app_user_tenant_id_email",
                table: "app_user",
                columns: new[] { "tenant_id", "email" },
                unique: true,
                filter: "email IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_app_user_tenant_id_role",
                table: "app_user",
                columns: new[] { "tenant_id", "role" });

            migrationBuilder.CreateIndex(
                name: "ix_card_entry_id_direction",
                table: "card",
                columns: new[] { "entry_id", "direction" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_learning_session_learner_id_started_at",
                table: "learning_session",
                columns: new[] { "learner_id", "started_at" });

            migrationBuilder.CreateIndex(
                name: "ix_refresh_token_token_hash",
                table: "refresh_token",
                column: "token_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_refresh_token_user_id_expires_at",
                table: "refresh_token",
                columns: new[] { "user_id", "expires_at" });

            migrationBuilder.CreateIndex(
                name: "ix_review_log_learner_id_card_id",
                table: "review_log",
                columns: new[] { "learner_id", "card_id" });

            migrationBuilder.CreateIndex(
                name: "ix_review_log_learner_id_reviewed_at",
                table: "review_log",
                columns: new[] { "learner_id", "reviewed_at" });

            migrationBuilder.CreateIndex(
                name: "ix_review_state_learner_id_due_at",
                table: "review_state",
                columns: new[] { "learner_id", "due_at" });

            migrationBuilder.CreateIndex(
                name: "ix_review_state_learner_id_state",
                table: "review_state",
                columns: new[] { "learner_id", "state" });

            migrationBuilder.CreateIndex(
                name: "ix_session_item_client_answer_id",
                table: "session_item",
                column: "client_answer_id",
                unique: true,
                filter: "client_answer_id IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_session_item_session_id_position",
                table: "session_item",
                columns: new[] { "session_id", "position" });

            migrationBuilder.CreateIndex(
                name: "ix_vocabulary_entry_set_id_position",
                table: "vocabulary_entry",
                columns: new[] { "set_id", "position" });

            migrationBuilder.CreateIndex(
                name: "ix_vocabulary_set_tenant_id_title",
                table: "vocabulary_set",
                columns: new[] { "tenant_id", "title" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "card");

            migrationBuilder.DropTable(
                name: "gamification_profile");

            migrationBuilder.DropTable(
                name: "learner_profile");

            migrationBuilder.DropTable(
                name: "refresh_token");

            migrationBuilder.DropTable(
                name: "review_log");

            migrationBuilder.DropTable(
                name: "review_state");

            migrationBuilder.DropTable(
                name: "session_item");

            migrationBuilder.DropTable(
                name: "tenant");

            migrationBuilder.DropTable(
                name: "vocabulary_entry");

            migrationBuilder.DropTable(
                name: "app_user");

            migrationBuilder.DropTable(
                name: "learning_session");

            migrationBuilder.DropTable(
                name: "vocabulary_set");
        }
    }
}
