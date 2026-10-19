using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordQuest.Modules.Content.Entities;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Learning.Entities;

namespace WordQuest.Infrastructure.Configurations;

public sealed class ReviewStateConfiguration : IEntityTypeConfiguration<ReviewState>
{
    public void Configure(EntityTypeBuilder<ReviewState> builder)
    {
        builder.ToTable("review_state");
        builder.HasKey(s => new { s.LearnerId, s.CardId });

        builder.Property(s => s.State).HasConversion<string>().HasMaxLength(20);
        builder.Property(s => s.LastGrade).HasConversion<string>().HasMaxLength(10);
        builder.Property(s => s.EaseFactor).HasDefaultValue(2.5d);

        // Jede Antwort setzt last_reviewed_at. Das UPDATE prueft den gelesenen
        // Wert: Eine gleichzeitige Antwort auf dieselbe Karte in einer anderen
        // Runde trifft keine Zeile mehr, SaveChanges wirft und rollt Aufgabe,
        // Protokoll und XP zurueck (D-10). Kein xmin, keine Migration.
        builder.Property(s => s.LastReviewedAt).IsConcurrencyToken();

        // Der Index, auf dem jede Session-Zusammenstellung laeuft.
        builder.HasIndex(s => new { s.LearnerId, s.DueAt });
        builder.HasIndex(s => new { s.LearnerId, s.State });

        // Integritaet in der Datenbank (AGENTS.md, D-06): Wird die Karte oder
        // das Kind geloescht, verschwindet der Lernstand mit, ohne Loeschliste
        // im Code (FIX-02, PAR-03).
        builder.HasOne<Card>().WithMany().HasForeignKey(s => s.CardId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<LearnerProfile>().WithMany().HasForeignKey(s => s.LearnerId).OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class ReviewLogConfiguration : IEntityTypeConfiguration<ReviewLog>
{
    public void Configure(EntityTypeBuilder<ReviewLog> builder)
    {
        builder.ToTable("review_log");
        builder.HasKey(l => l.Id);

        builder.Property(l => l.Id).ValueGeneratedOnAdd();
        builder.Property(l => l.GameKey).HasMaxLength(40).IsRequired();
        builder.Property(l => l.Grade).HasConversion<string>().HasMaxLength(10);
        builder.Property(l => l.GivenAnswer).HasMaxLength(300);

        builder.HasIndex(l => new { l.LearnerId, l.ReviewedAt });
        builder.HasIndex(l => new { l.LearnerId, l.CardId });

        // Das Protokoll gehoert zu Karte und Kind und geht mit ihnen (FIX-02,
        // PAR-03). Eine geloeschte Runde laesst den Eintrag stehen, nur ohne Bezug.
        builder.HasOne<Card>().WithMany().HasForeignKey(l => l.CardId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<LearnerProfile>().WithMany().HasForeignKey(l => l.LearnerId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<LearningSession>().WithMany().HasForeignKey(l => l.SessionId).OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class LearningSessionConfiguration : IEntityTypeConfiguration<LearningSession>
{
    public void Configure(EntityTypeBuilder<LearningSession> builder)
    {
        builder.ToTable("learning_session");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.GameKey).HasMaxLength(40).IsRequired();
        builder.HasIndex(s => new { s.LearnerId, s.StartedAt });

        builder.HasMany(s => s.Items)
            .WithOne(i => i.Session)
            .HasForeignKey(i => i.SessionId)
            .OnDelete(DeleteBehavior.Cascade);

        // Runden gehen mit dem Kind (PAR-03). Ein geloeschtes Set laesst das
        // Sitzungsprotokoll stehen, nur ohne Set-Bezug (FIX-02).
        builder.HasOne<LearnerProfile>().WithMany().HasForeignKey(s => s.LearnerId).OnDelete(DeleteBehavior.Cascade);
        builder.HasOne<VocabularySet>().WithMany().HasForeignKey(s => s.SetId).OnDelete(DeleteBehavior.SetNull);
    }
}

public sealed class SessionItemConfiguration : IEntityTypeConfiguration<SessionItem>
{
    public void Configure(EntityTypeBuilder<SessionItem> builder)
    {
        builder.ToTable("session_item");
        builder.HasKey(i => i.Id);

        builder.Property(i => i.Grade).HasConversion<string>().HasMaxLength(10);
        builder.Property(i => i.GivenAnswer).HasMaxLength(300);

        // Eine Aufgabe wird genau einmal gewertet: Das UPDATE prueft den alten
        // Wert (answered_at IS NULL). Die zweite gleichzeitige Antwort trifft
        // keine Zeile mehr, SaveChanges wirft und rollt Lernstand, Protokoll
        // und XP zurueck (FIX-04).
        builder.Property(i => i.AnsweredAt).IsConcurrencyToken();

        builder.HasIndex(i => new { i.SessionId, i.Position });

        // Macht das Einspielen offline erfasster Antworten idempotent:
        // dieselbe Client-Antwort-Id kann nicht zweimal gewertet werden.
        builder.HasIndex(i => i.ClientAnswerId)
            .IsUnique()
            .HasFilter("client_answer_id IS NOT NULL");

        // Eine geloeschte Karte nimmt ihre Aufgaben mit; eine Antwort darauf
        // ergibt danach 404 statt 500 (FIX-02).
        builder.HasOne<Card>().WithMany().HasForeignKey(i => i.CardId).OnDelete(DeleteBehavior.Cascade);
    }
}
