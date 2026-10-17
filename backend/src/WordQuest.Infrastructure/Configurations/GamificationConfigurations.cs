using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Identity.Entities;

namespace WordQuest.Infrastructure.Configurations;

public sealed class GamificationProfileConfiguration : IEntityTypeConfiguration<GamificationProfile>
{
    public void Configure(EntityTypeBuilder<GamificationProfile> builder)
    {
        builder.ToTable("gamification_profile");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.StreakSaverPeriod).HasMaxLength(7);
        builder.Property(p => p.StreakSaversLeft)
            .HasDefaultValue(GamificationProfile.MonthlyStreakSavers);

        // Level ist berechnet und wird nicht gespeichert - sonst driftet es
        // irgendwann von der XP-Kurve weg.
        builder.Ignore(p => p.Level);

        // XP und Serie gehoeren zum Kind und gehen mit ihm (PAR-03, D-07).
        builder.HasOne<LearnerProfile>().WithOne().HasForeignKey<GamificationProfile>(g => g.Id)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
