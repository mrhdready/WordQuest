using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using WordQuest.Modules.Content.Entities;
using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Infrastructure.Seed;

/// <summary>
/// Legt beim ersten Start ein Demo-Elternkonto, ein Kind und ein Vokabelset an,
/// damit direkt nach der Installation etwas zu sehen ist.
///
/// Laeuft nur, wenn die Datenbank noch leer ist — ein zweiter Start darf
/// niemals Nutzerdaten ueberschreiben.
/// </summary>
public static class DemoDataSeeder
{
    public const string DemoEmail = "demo@wordquest.local";
    public const string DemoPassword = "demo1234";
    public const string DemoPin = "1234";

    public static async Task SeedAsync(
        WordQuestDbContext db, ILogger logger, CancellationToken ct = default)
    {
        ArgumentNullException.ThrowIfNull(db);
        ArgumentNullException.ThrowIfNull(logger);

        if (await db.Tenants.IgnoreQueryFilters().AnyAsync(ct))
        {
            logger.LogInformation("Datenbank enthaelt bereits Daten — Seed uebersprungen.");
            return;
        }

        logger.LogWarning(
            "Lege Demo-Daten an. Zugang: {Email} / {Password}, Kind-PIN {Pin}. "
            + "Bitte nach der Ersteinrichtung aendern und WQ_SEED_DEMO_DATA=false setzen.",
            DemoEmail, DemoPassword, DemoPin);

        var tenant = new Tenant { Name = "Familie Demo", Type = TenantType.Family };

        var guardian = new User
        {
            TenantId = tenant.Id,
            Role = UserRole.Owner,
            DisplayName = "Demo-Elternteil",
            Email = DemoEmail,
            PasswordHash = PasswordHasher.Hash(DemoPassword),
        };

        var child = new User
        {
            TenantId = tenant.Id,
            Role = UserRole.Learner,
            DisplayName = "Max",
        };

        var childProfile = new LearnerProfile
        {
            Id = child.Id,
            TenantId = tenant.Id,
            AvatarKey = "fox",
            PinHash = PasswordHasher.Hash(DemoPin),
            DailyNewLimit = 5,
        };

        var gamification = new GamificationProfile { Id = child.Id, TenantId = tenant.Id };

        var set = new VocabularySet
        {
            TenantId = tenant.Id,
            Title = "Unit 1 — Around the house",
            Description = "Beispielset zum Ausprobieren. Kann gefahrlos geloescht werden.",
            SourceLanguage = "de",
            TargetLanguage = "en",
            CreatedByUserId = guardian.Id,
        };

        int position = 0;
        var entries = new List<VocabularyEntry>();
        foreach ((string de, string en, string? emoji, PartOfSpeech pos) in DemoWords)
        {
            var entry = new VocabularyEntry
            {
                TenantId = tenant.Id,
                SetId = set.Id,
                SourceText = de,
                TargetText = en,
                Emoji = emoji,
                PartOfSpeech = pos,
                Position = position++,
            };

            entries.Add(entry);
        }

        db.Tenants.Add(tenant);
        db.Users.AddRange(guardian, child);
        db.LearnerProfiles.Add(childProfile);
        db.GamificationProfiles.Add(gamification);
        db.VocabularySets.Add(set);
        db.VocabularyEntries.AddRange(entries);

        foreach (VocabularyEntry entry in entries)
        {
            db.Cards.AddRange(entry.CreateDefaultCards());
        }

        await db.SaveChangesAsync(ct);
        logger.LogInformation("Demo-Daten angelegt: {Count} Vokabeln.", entries.Count);
    }

    /// <summary>
    /// Bewusst alltagsnah und bebilderbar — das Memory-Spiel braucht Emojis,
    /// und ein Kind soll beim ersten Start Woerter sehen, die es kennt.
    /// </summary>
    private static readonly (string De, string En, string? Emoji, PartOfSpeech Pos)[] DemoWords =
    [
        ("Hund", "dog", "🐶", PartOfSpeech.Noun),
        ("Katze", "cat", "🐱", PartOfSpeech.Noun),
        ("Haus", "house", "🏠", PartOfSpeech.Noun),
        ("Tür", "door", "🚪", PartOfSpeech.Noun),
        ("Fenster", "window", "🪟", PartOfSpeech.Noun),
        ("Tisch", "table", "🪑", PartOfSpeech.Noun),
        ("Stuhl", "chair", "🪑", PartOfSpeech.Noun),
        ("Bett", "bed", "🛏️", PartOfSpeech.Noun),
        ("Küche", "kitchen", "🍳", PartOfSpeech.Noun),
        ("Garten", "garden", "🌳", PartOfSpeech.Noun),
        ("Buch", "book", "📚", PartOfSpeech.Noun),
        ("Schule", "school", "🏫", PartOfSpeech.Noun),
        ("Apfel", "apple", "🍎", PartOfSpeech.Noun),
        ("Brot", "bread", "🍞", PartOfSpeech.Noun),
        ("Milch", "milk", "🥛", PartOfSpeech.Noun),
        ("Wasser", "water", "💧", PartOfSpeech.Noun),
        ("Freund", "friend", "🧑‍🤝‍🧑", PartOfSpeech.Noun),
        ("Auto", "car", "🚗", PartOfSpeech.Noun),
        ("Fahrrad", "bike", "🚲", PartOfSpeech.Noun),
        ("Baum", "tree", "🌲", PartOfSpeech.Noun),
        ("gehen", "to go", null, PartOfSpeech.Verb),
        ("laufen", "to run", null, PartOfSpeech.Verb),
        ("essen", "to eat", null, PartOfSpeech.Verb),
        ("trinken", "to drink", null, PartOfSpeech.Verb),
        ("lesen", "to read", null, PartOfSpeech.Verb),
        ("schreiben", "to write", null, PartOfSpeech.Verb),
        ("spielen", "to play", null, PartOfSpeech.Verb),
        ("schlafen", "to sleep", null, PartOfSpeech.Verb),
        ("groß", "big", null, PartOfSpeech.Adjective),
        ("klein", "small", null, PartOfSpeech.Adjective),
        ("schnell", "fast", null, PartOfSpeech.Adjective),
        ("schön", "beautiful", null, PartOfSpeech.Adjective),
    ];
}
