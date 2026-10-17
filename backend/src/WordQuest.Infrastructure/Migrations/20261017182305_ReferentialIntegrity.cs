using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordQuest.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class ReferentialIntegrity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateIndex(
                name: "ix_session_item_card_id",
                table: "session_item",
                column: "card_id");

            migrationBuilder.CreateIndex(
                name: "ix_review_state_card_id",
                table: "review_state",
                column: "card_id");

            migrationBuilder.CreateIndex(
                name: "ix_review_log_card_id",
                table: "review_log",
                column: "card_id");

            migrationBuilder.CreateIndex(
                name: "ix_review_log_session_id",
                table: "review_log",
                column: "session_id");

            migrationBuilder.CreateIndex(
                name: "ix_learning_session_set_id",
                table: "learning_session",
                column: "set_id");

            migrationBuilder.AddForeignKey(
                name: "fk_gamification_profile_learner_profile_id",
                table: "gamification_profile",
                column: "id",
                principalTable: "learner_profile",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_learning_session_learner_profile_learner_id",
                table: "learning_session",
                column: "learner_id",
                principalTable: "learner_profile",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_learning_session_vocabulary_set_set_id",
                table: "learning_session",
                column: "set_id",
                principalTable: "vocabulary_set",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_refresh_token_app_user_user_id",
                table: "refresh_token",
                column: "user_id",
                principalTable: "app_user",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_review_log_card_card_id",
                table: "review_log",
                column: "card_id",
                principalTable: "card",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_review_log_learner_profile_learner_id",
                table: "review_log",
                column: "learner_id",
                principalTable: "learner_profile",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_review_log_learning_session_session_id",
                table: "review_log",
                column: "session_id",
                principalTable: "learning_session",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);

            migrationBuilder.AddForeignKey(
                name: "fk_review_state_card_card_id",
                table: "review_state",
                column: "card_id",
                principalTable: "card",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_review_state_learner_profile_learner_id",
                table: "review_state",
                column: "learner_id",
                principalTable: "learner_profile",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            migrationBuilder.AddForeignKey(
                name: "fk_session_item_card_card_id",
                table: "session_item",
                column: "card_id",
                principalTable: "card",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_gamification_profile_learner_profile_id",
                table: "gamification_profile");

            migrationBuilder.DropForeignKey(
                name: "fk_learning_session_learner_profile_learner_id",
                table: "learning_session");

            migrationBuilder.DropForeignKey(
                name: "fk_learning_session_vocabulary_set_set_id",
                table: "learning_session");

            migrationBuilder.DropForeignKey(
                name: "fk_refresh_token_app_user_user_id",
                table: "refresh_token");

            migrationBuilder.DropForeignKey(
                name: "fk_review_log_card_card_id",
                table: "review_log");

            migrationBuilder.DropForeignKey(
                name: "fk_review_log_learner_profile_learner_id",
                table: "review_log");

            migrationBuilder.DropForeignKey(
                name: "fk_review_log_learning_session_session_id",
                table: "review_log");

            migrationBuilder.DropForeignKey(
                name: "fk_review_state_card_card_id",
                table: "review_state");

            migrationBuilder.DropForeignKey(
                name: "fk_review_state_learner_profile_learner_id",
                table: "review_state");

            migrationBuilder.DropForeignKey(
                name: "fk_session_item_card_card_id",
                table: "session_item");

            migrationBuilder.DropIndex(
                name: "ix_session_item_card_id",
                table: "session_item");

            migrationBuilder.DropIndex(
                name: "ix_review_state_card_id",
                table: "review_state");

            migrationBuilder.DropIndex(
                name: "ix_review_log_card_id",
                table: "review_log");

            migrationBuilder.DropIndex(
                name: "ix_review_log_session_id",
                table: "review_log");

            migrationBuilder.DropIndex(
                name: "ix_learning_session_set_id",
                table: "learning_session");
        }
    }
}
