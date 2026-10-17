using WordQuest.Modules.Content.Entities;
using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api.Tests;

/// <summary>
/// Gemeinsame Testdaten fuer Api.Tests. Alle Namen und E-Mails sind je Aufruf
/// eindeutig, damit Klassen mit gemeinsamer Factory sich nicht in die Quere
/// kommen (Isolationsregel ApiFactory).
/// </summary>
public static class TestData
{
    public const string ChildPin = "4711";

    /// <summary>Eine angelegte Familie: Elternkonto und Kinder im selben Mandanten.</summary>
    public sealed record SeededFamily(Tenant Tenant, User Owner, IReadOnlyList<User> Children)
    {
        /// <summary>Das erste Kind, fuer Faelle mit genau einem Kind.</summary>
        public User Child => Children[0];
    }

    /// <summary>Ein angelegtes Set mit seinen Eintraegen und je zwei Karten pro Eintrag.</summary>
    public sealed record SeededSet(VocabularySet Set, IReadOnlyList<VocabularyEntry> Entries, IReadOnlyList<Card> Cards)
    {
        /// <summary>
        /// Richtige Antwort zur angezeigten Aufgabe: Gefragt ist immer die andere
        /// Seite des Eintrags.
        /// </summary>
        public string AnswerFor(string prompt)
        {
            foreach (VocabularyEntry entry in Entries)
            {
                if (entry.SourceText == prompt)
                {
                    return entry.TargetText;
                }

                if (entry.TargetText == prompt)
                {
                    return entry.SourceText;
                }
            }

            throw new InvalidOperationException($"Keine Antwort zu \"{prompt}\".");
        }
    }

    /// <summary>Legt Mandant, Elternkonto und Kinder mit Lern- und Spielprofil an.</summary>
    public static async Task<SeededFamily> SeedFamilyAsync(
        ApiFactory factory, int children = 1, int dailyNewLimit = 5)
    {
        string unique = Guid.NewGuid().ToString("N");
        var tenant = new Tenant { Name = $"Familie {unique}", Type = TenantType.Family };
        var owner = new User
        {
            TenantId = tenant.Id,
            Role = UserRole.Owner,
            DisplayName = "Eltern",
            Email = $"eltern-{unique}@example.de",
            PasswordHash = PasswordHasher.Hash("geheim-123"),
        };

        await using var db = factory.CreateSystemDbContext();
        db.Tenants.Add(tenant);
        db.Users.Add(owner);

        var kids = new List<User>(children);
        for (int index = 0; index < children; index++)
        {
            var child = new User
            {
                TenantId = tenant.Id,
                Role = UserRole.Learner,
                DisplayName = $"Kind {index} {unique}",
            };
            kids.Add(child);
            db.Users.Add(child);
            db.LearnerProfiles.Add(new LearnerProfile
            {
                Id = child.Id,
                TenantId = tenant.Id,
                PinHash = PasswordHasher.Hash(ChildPin),
                DailyNewLimit = dailyNewLimit,
            });
            db.GamificationProfiles.Add(new GamificationProfile { Id = child.Id, TenantId = tenant.Id });
        }

        await db.SaveChangesAsync();
        return new SeededFamily(tenant, owner, kids);
    }

    /// <summary>Legt ein Set mit <paramref name="entries"/> Eintraegen und deren Standardkarten an.</summary>
    public static async Task<SeededSet> SeedSetAsync(ApiFactory factory, SeededFamily family, int entries = 3)
    {
        string unique = Guid.NewGuid().ToString("N")[..8];
        var set = new VocabularySet
        {
            TenantId = family.Tenant.Id,
            Title = $"Set {unique}",
            CreatedByUserId = family.Owner.Id,
        };

        var created = new List<VocabularyEntry>(entries);
        var cards = new List<Card>(entries * 2);
        for (int index = 0; index < entries; index++)
        {
            var entry = new VocabularyEntry
            {
                TenantId = family.Tenant.Id,
                SetId = set.Id,
                SourceText = $"wort{index}x{unique}",
                TargetText = $"word{index}x{unique}",
                Position = index,
            };
            created.Add(entry);
            cards.AddRange(entry.CreateDefaultCards());
        }

        await using var db = factory.CreateSystemDbContext();
        db.VocabularySets.Add(set);
        db.VocabularyEntries.AddRange(created);
        db.Cards.AddRange(cards);
        await db.SaveChangesAsync();
        return new SeededSet(set, created, cards);
    }
}
