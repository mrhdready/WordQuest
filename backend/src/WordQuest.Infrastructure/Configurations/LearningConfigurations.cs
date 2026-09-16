using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
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

        // Der Index, auf dem jede Session-Zusammenstellung laeuft.
        builder.HasIndex(s => new { s.LearnerId, s.DueAt });
        builder.HasIndex(s => new { s.LearnerId, s.State });
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

        builder.HasIndex(i => new { i.SessionId, i.Position });

        // Macht das Einspielen offline erfasster Antworten idempotent:
        // dieselbe Client-Antwort-Id kann nicht zweimal gewertet werden.
        builder.HasIndex(i => i.ClientAnswerId)
            .IsUnique()
            .HasFilter("client_answer_id IS NOT NULL");
    }
}
