using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace WordQuest.Infrastructure.Migrations
{
    /// <inheritdoc />
    public partial class VocabularyPictures : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "vocabulary_picture",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    tenant_id = table.Column<Guid>(type: "uuid", nullable: false),
                    version = table.Column<Guid>(type: "uuid", nullable: false),
                    data = table.Column<byte[]>(type: "bytea", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_vocabulary_picture", x => x.id);
                    table.ForeignKey(
                        name: "fk_vocabulary_picture_vocabulary_entry_id",
                        column: x => x.id,
                        principalTable: "vocabulary_entry",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_vocabulary_picture_version",
                table: "vocabulary_picture",
                column: "version",
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "vocabulary_picture");
        }
    }
}
