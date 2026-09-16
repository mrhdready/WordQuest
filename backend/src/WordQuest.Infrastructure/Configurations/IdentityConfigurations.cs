using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordQuest.Modules.Identity.Entities;

namespace WordQuest.Infrastructure.Configurations;

public sealed class TenantConfiguration : IEntityTypeConfiguration<Tenant>
{
    public void Configure(EntityTypeBuilder<Tenant> builder)
    {
        builder.ToTable("tenant");
        builder.HasKey(t => t.Id);
        builder.Property(t => t.Name).HasMaxLength(200).IsRequired();
        builder.Property(t => t.Type).HasConversion<string>().HasMaxLength(20);
    }
}

public sealed class UserConfiguration : IEntityTypeConfiguration<User>
{
    public void Configure(EntityTypeBuilder<User> builder)
    {
        builder.ToTable("app_user");
        builder.HasKey(u => u.Id);

        builder.Property(u => u.DisplayName).HasMaxLength(100).IsRequired();
        builder.Property(u => u.Email).HasMaxLength(320);
        builder.Property(u => u.PasswordHash).HasMaxLength(400);
        builder.Property(u => u.Role).HasConversion<string>().HasMaxLength(20);

        // E-Mail ist pro Mandant eindeutig, aber nur wo gesetzt: Kinder haben
        // bewusst keine E-Mail-Adresse.
        builder.HasIndex(u => new { u.TenantId, u.Email })
            .IsUnique()
            .HasFilter("email IS NOT NULL");

        builder.HasIndex(u => new { u.TenantId, u.Role });

        builder.HasOne(u => u.LearnerProfile)
            .WithOne(p => p.User)
            .HasForeignKey<LearnerProfile>(p => p.Id)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class LearnerProfileConfiguration : IEntityTypeConfiguration<LearnerProfile>
{
    public void Configure(EntityTypeBuilder<LearnerProfile> builder)
    {
        builder.ToTable("learner_profile");
        builder.HasKey(p => p.Id);

        builder.Property(p => p.AvatarKey).HasMaxLength(50).IsRequired();
        builder.Property(p => p.PinHash).HasMaxLength(400);
        builder.Property(p => p.Speed).HasConversion<string>().HasMaxLength(20);
        builder.Property(p => p.DailyNewLimit).HasDefaultValue(5);
    }
}

public sealed class RefreshTokenConfiguration : IEntityTypeConfiguration<RefreshToken>
{
    public void Configure(EntityTypeBuilder<RefreshToken> builder)
    {
        builder.ToTable("refresh_token");
        builder.HasKey(t => t.Id);

        builder.Property(t => t.TokenHash).HasMaxLength(64).IsRequired();
        builder.Property(t => t.ReplacedByTokenHash).HasMaxLength(64);

        builder.HasIndex(t => t.TokenHash).IsUnique();
        builder.HasIndex(t => new { t.UserId, t.ExpiresAt });
    }
}
