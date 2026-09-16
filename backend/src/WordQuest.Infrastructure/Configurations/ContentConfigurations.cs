using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;
using WordQuest.Modules.Content.Entities;

namespace WordQuest.Infrastructure.Configurations;

public sealed class VocabularySetConfiguration : IEntityTypeConfiguration<VocabularySet>
{
    public void Configure(EntityTypeBuilder<VocabularySet> builder)
    {
        builder.ToTable("vocabulary_set");
        builder.HasKey(s => s.Id);

        builder.Property(s => s.Title).HasMaxLength(200).IsRequired();
        builder.Property(s => s.Description).HasMaxLength(2000);
        builder.Property(s => s.SourceLanguage).HasMaxLength(5).IsRequired();
        builder.Property(s => s.TargetLanguage).HasMaxLength(5).IsRequired();

        builder.HasIndex(s => new { s.TenantId, s.Title });

        builder.HasMany(s => s.Entries)
            .WithOne(e => e.Set)
            .HasForeignKey(e => e.SetId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class VocabularyEntryConfiguration : IEntityTypeConfiguration<VocabularyEntry>
{
    public void Configure(EntityTypeBuilder<VocabularyEntry> builder)
    {
        builder.ToTable("vocabulary_entry");
        builder.HasKey(e => e.Id);

        builder.Property(e => e.SourceText).HasMaxLength(200).IsRequired();
        builder.Property(e => e.TargetText).HasMaxLength(200).IsRequired();

        // Npgsql bildet string[] direkt auf text[] ab - keine Hilfstabelle
        // und keine JSON-Serialisierung noetig.
        builder.Property(e => e.TargetAlternatives).HasColumnType("text[]");
        builder.Property(e => e.SourceAlternatives).HasColumnType("text[]");

        builder.Property(e => e.PartOfSpeech).HasConversion<string>().HasMaxLength(20);
        builder.Property(e => e.ExampleSource).HasMaxLength(500);
        builder.Property(e => e.ExampleTarget).HasMaxLength(500);
        builder.Property(e => e.Emoji).HasMaxLength(16);
        builder.Property(e => e.AudioUrl).HasMaxLength(500);

        builder.HasIndex(e => new { e.SetId, e.Position });

        builder.HasMany(e => e.Cards)
            .WithOne(c => c.Entry)
            .HasForeignKey(c => c.EntryId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}

public sealed class CardConfiguration : IEntityTypeConfiguration<Card>
{
    public void Configure(EntityTypeBuilder<Card> builder)
    {
        builder.ToTable("card");
        builder.HasKey(c => c.Id);

        builder.Property(c => c.Direction).HasConversion<string>().HasMaxLength(20);

        // Je Vokabelpaar hoechstens eine Karte pro Richtung.
        builder.HasIndex(c => new { c.EntryId, c.Direction }).IsUnique();
    }
}
