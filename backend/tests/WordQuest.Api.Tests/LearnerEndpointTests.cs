using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using WordQuest.Api.Contracts;
using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;
using WordQuest.Modules.Learning.Entities;
using WordQuest.Shared.Kernel;

namespace WordQuest.Api.Tests;

/// <summary>
/// POST /api/v1/learners und PATCH /api/v1/learners/{id}/settings (PAR-05,
/// PAR-01, PAR-02, D-15). Gemeinsame Factory, deshalb legt jeder Fall eine
/// eigene Familie mit eindeutigen Namen an und prueft keine globalen
/// Zaehlungen (Isolationsregel ApiFactory). Hoechstens 6 Aufrufe der Policy
/// "auth" (learner-login), Grenze 10 pro Minute; GET /auth/profiles verlangt
/// genau einen Mandanten und wird hier nicht aufgerufen.
/// </summary>
public sealed class LearnerEndpointTests : IClassFixture<ApiFactory>
{
    private const string Path = "/api/v1/learners";
    private const string PinMissing = "Bitte gib eine PIN mit 4 bis 6 Ziffern ein.";
    private const string PinInvalid = "Die PIN muss aus 4 bis 6 Ziffern bestehen.";
    private const string OldPin = "9999";

    private readonly ApiFactory _factory;

    public LearnerEndpointTests(ApiFactory factory) => _factory = factory;

    // Familie mit Elternkonto und einem Kind, Namen eindeutig je Aufruf.
    private async Task<(User Owner, User Child)> SeedFamilyAsync(string? pin = null)
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
        var child = new User { TenantId = tenant.Id, Role = UserRole.Learner, DisplayName = $"Kind {unique}" };

        await using var db = _factory.CreateSystemDbContext();
        db.Tenants.Add(tenant);
        db.Users.AddRange(owner, child);
        db.LearnerProfiles.Add(new LearnerProfile
        {
            Id = child.Id,
            TenantId = tenant.Id,
            PinHash = pin is null ? null : PasswordHasher.Hash(pin),
        });
        await db.SaveChangesAsync();
        return (owner, child);
    }

    private async Task<HttpResponseMessage> PatchAsync(User owner, Guid learnerId, object body)
    {
        using HttpClient client = _factory.CreateClientFor(owner);
        return await client.PatchAsJsonAsync($"{Path}/{learnerId}/settings", body);
    }

    private async Task<HttpResponseMessage> LearnerLoginAsync(Guid learnerId, string pin)
    {
        using HttpClient client = _factory.CreateClient();
        return await client.PostAsJsonAsync("/api/v1/auth/learner-login", new { learnerId, pin });
    }

    private async Task<LearnerProfile> ProfileAsync(Guid learnerId)
    {
        await using var db = _factory.CreateSystemDbContext();
        return await db.LearnerProfiles.AsNoTracking().Include(p => p.User).SingleAsync(p => p.Id == learnerId);
    }

    private async Task<HttpResponseMessage> CreateAsync(object body)
    {
        (User owner, _) = await SeedFamilyAsync();
        using HttpClient client = _factory.CreateClientFor(owner);
        return await client.PostAsJsonAsync(Path, body);
    }

    private static string UniqueName() => $"Kind {Guid.NewGuid():N}";

    private static async Task<IDictionary<string, string[]>> ErrorsAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.BadRequest, response.StatusCode);
        HttpValidationProblemDetails? problem =
            await response.Content.ReadFromJsonAsync<HttpValidationProblemDetails>();
        Assert.NotNull(problem);
        return problem.Errors;
    }

    private static async Task<string> FieldErrorAsync(HttpResponseMessage response, string key)
    {
        IDictionary<string, string[]> errors = await ErrorsAsync(response);
        Assert.True(errors.ContainsKey(key), $"Schluessel {key} fehlt: {string.Join(", ", errors.Keys)}");
        return errors[key][0];
    }

    private static async Task<LearnerDto> CreatedAsync(HttpResponseMessage response)
    {
        Assert.Equal(HttpStatusCode.Created, response.StatusCode);
        LearnerDto? learner = await response.Content.ReadFromJsonAsync<LearnerDto>();
        Assert.NotNull(learner);
        return learner;
    }

    [Theory]
    [InlineData("1234")]
    [InlineData("123456")]
    public async Task Pin_with_4_to_6_digits_is_accepted(string pin)
    {
        LearnerDto learner = await CreatedAsync(await CreateAsync(new { displayName = UniqueName(), pin }));

        Assert.True(learner.HasPin);
    }

    [Theory]
    [InlineData("123")]
    [InlineData("1234567")]
    [InlineData("12a4")]
    [InlineData("١٢٣٤")]
    public async Task Invalid_pin_returns_400_on_pin(string pin)
    {
        HttpResponseMessage response = await CreateAsync(new { displayName = UniqueName(), pin });

        Assert.Equal(PinInvalid, await FieldErrorAsync(response, "pin"));
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task Missing_pin_returns_400_on_pin(string? pin)
    {
        HttpResponseMessage response = await CreateAsync(new { displayName = UniqueName(), pin });

        Assert.Equal(PinMissing, await FieldErrorAsync(response, "pin"));
    }

    [Fact]
    public async Task Name_with_100_characters_is_accepted()
    {
        string name = new('a', 100);

        LearnerDto learner = await CreatedAsync(await CreateAsync(new { displayName = name, pin = "1234" }));

        Assert.Equal(name, learner.DisplayName);
    }

    [Fact]
    public async Task Name_with_101_characters_returns_400_not_500()
    {
        HttpResponseMessage response = await CreateAsync(new { displayName = new string('a', 101), pin = "1234" });

        Assert.Equal("Der Name darf höchstens 100 Zeichen lang sein.", await FieldErrorAsync(response, "displayName"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Empty_name_returns_400_on_displayName(string name)
    {
        HttpResponseMessage response = await CreateAsync(new { displayName = name, pin = "1234" });

        Assert.Equal("Wie soll das Kind heißen? Ein Spitzname genügt.", await FieldErrorAsync(response, "displayName"));
    }

    [Fact]
    public async Task Empty_name_and_invalid_pin_report_both_fields()
    {
        HttpResponseMessage response = await CreateAsync(new { displayName = "", pin = "12" });

        IDictionary<string, string[]> errors = await ErrorsAsync(response);
        Assert.Equal(["displayName", "pin"], errors.Keys.Order());
        Assert.Equal(PinInvalid, errors["pin"][0]);
    }

    [Fact]
    public async Task Umlauts_and_emoji_are_stored_unchanged()
    {
        (User owner, _) = await SeedFamilyAsync();
        using HttpClient client = _factory.CreateClientFor(owner);
        const string name = "Jürgen 🦊";

        HttpResponseMessage response = await client.PostAsJsonAsync(Path, new { displayName = name, pin = "1234" });

        LearnerDto created = await CreatedAsync(response);
        List<LearnerDto>? learners = await client.GetFromJsonAsync<List<LearnerDto>>(Path);
        Assert.NotNull(learners);
        Assert.Equal(name, Assert.Single(learners, l => l.Id == created.Id).DisplayName);
    }

    [Theory]
    [InlineData(3, 3)]
    [InlineData(15, 15)]
    [InlineData(2, 3)]
    [InlineData(16, 15)]
    [InlineData(null, 5)]
    public async Task Daily_new_limit_is_clamped_to_3_to_15_with_default_5(int? limit, int expected)
    {
        LearnerDto learner = await CreatedAsync(
            await CreateAsync(new { displayName = UniqueName(), pin = "1234", dailyNewLimit = limit }));

        Assert.Equal(expected, learner.DailyNewLimit);
    }

    [Fact]
    public async Task Child_token_returns_403()
    {
        (_, User child) = await SeedFamilyAsync();
        using HttpClient client = _factory.CreateClientFor(child);

        HttpResponseMessage response = await client.PostAsJsonAsync(Path, new { displayName = UniqueName(), pin = "1234" });

        Assert.Equal(HttpStatusCode.Forbidden, response.StatusCode);
    }

    [Fact]
    public async Task Child_of_another_family_is_not_listed()
    {
        (User owner, _) = await SeedFamilyAsync();
        (User other, _) = await SeedFamilyAsync();
        using HttpClient client = _factory.CreateClientFor(owner);
        using HttpClient otherClient = _factory.CreateClientFor(other);

        LearnerDto created = await CreatedAsync(
            await client.PostAsJsonAsync(Path, new { displayName = UniqueName(), pin = "1234" }));

        List<LearnerDto>? own = await client.GetFromJsonAsync<List<LearnerDto>>(Path);
        List<LearnerDto>? foreign = await otherClient.GetFromJsonAsync<List<LearnerDto>>(Path);
        Assert.Contains(own!, l => l.Id == created.Id);
        Assert.DoesNotContain(foreign!, l => l.Id == created.Id);
    }

    [Fact]
    public async Task Created_child_logs_in_with_its_pin()
    {
        LearnerDto learner = await CreatedAsync(await CreateAsync(new { displayName = UniqueName(), pin = "482913" }));
        using HttpClient client = _factory.CreateClient();

        HttpResponseMessage login = await client.PostAsJsonAsync(
            "/api/v1/auth/learner-login", new { learnerId = learner.Id, pin = "482913" });

        Assert.Equal(HttpStatusCode.OK, login.StatusCode);
    }

    // Spalte HasMaxLength(50): vorher endete ein laengerer Schluessel als 500 aus der Datenbank.
    [Fact]
    public async Task Avatar_key_with_51_characters_returns_400_not_500()
    {
        HttpResponseMessage response = await CreateAsync(
            new { displayName = UniqueName(), pin = "1234", avatarKey = new string('a', 51) });

        Assert.Equal("Das Bild darf höchstens 50 Zeichen lang sein.", await FieldErrorAsync(response, "avatarKey"));
    }

    [Fact]
    public async Task Avatar_key_with_50_characters_is_accepted()
    {
        await CreatedAsync(await CreateAsync(
            new { displayName = UniqueName(), pin = "1234", avatarKey = new string('a', 50) }));
    }

    // --- PATCH /learners/{id}/settings (PAR-01, PAR-02 beim Aendern) -------

    // Invariante: dieselbe Regel auf beiden Wegen, auch bei direktem API-Aufruf.
    [Theory]
    [InlineData("123")]
    [InlineData("1234567")]
    [InlineData("12a4")]
    [InlineData("12 34")]
    [InlineData("   ")]
    [InlineData("١٢٣٤")]
    public async Task Invalid_pin_returns_400_on_post_and_patch(string pin)
    {
        (User owner, User child) = await SeedFamilyAsync(OldPin);

        HttpResponseMessage post = await CreateAsync(new { displayName = UniqueName(), pin });
        HttpResponseMessage patch = await PatchAsync(owner, child.Id, new { pin });

        Assert.Equal(PinInvalid, await FieldErrorAsync(post, "pin"));
        Assert.Equal(PinInvalid, await FieldErrorAsync(patch, "pin"));
    }

    [Theory]
    [InlineData("1234")]
    [InlineData("123456")]
    public async Task New_pin_replaces_the_old_one(string pin)
    {
        (User owner, User child) = await SeedFamilyAsync(OldPin);

        HttpResponseMessage patch = await PatchAsync(owner, child.Id, new { pin });

        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LearnerLoginAsync(child.Id, pin)).StatusCode);
        HttpResponseMessage old = await LearnerLoginAsync(child.Id, OldPin);
        Assert.Equal(HttpStatusCode.Unauthorized, old.StatusCode);
        ProblemDetails? problem = await old.Content.ReadFromJsonAsync<ProblemDetails>();
        Assert.Equal("Die PIN stimmt nicht.", problem?.Detail);
    }

    [Theory]
    [InlineData(null)]
    [InlineData("")]
    public async Task Missing_pin_keeps_the_pin(string? pin)
    {
        (User owner, User child) = await SeedFamilyAsync(OldPin);
        string? before = (await ProfileAsync(child.Id)).PinHash;

        HttpResponseMessage patch = await PatchAsync(owner, child.Id, new { dailyNewLimit = 8, pin });

        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        LearnerProfile after = await ProfileAsync(child.Id);
        Assert.Equal(before, after.PinHash);
        Assert.Equal(8, after.DailyNewLimit);
    }

    [Fact]
    public async Task Patch_name_with_100_characters_is_saved()
    {
        (User owner, User child) = await SeedFamilyAsync();
        string name = new('b', 100);

        HttpResponseMessage patch = await PatchAsync(owner, child.Id, new { displayName = name });

        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        Assert.Equal(name, (await ProfileAsync(child.Id)).User!.DisplayName);
    }

    [Fact]
    public async Task Patch_name_with_101_characters_returns_400()
    {
        (User owner, User child) = await SeedFamilyAsync();

        HttpResponseMessage patch = await PatchAsync(owner, child.Id, new { displayName = new string('b', 101) });

        Assert.Equal("Der Name darf höchstens 100 Zeichen lang sein.", await FieldErrorAsync(patch, "displayName"));
    }

    [Theory]
    [InlineData("")]
    [InlineData("   ")]
    public async Task Patch_empty_name_returns_400_on_displayName(string name)
    {
        (User owner, User child) = await SeedFamilyAsync();

        HttpResponseMessage patch = await PatchAsync(owner, child.Id, new { displayName = name });

        Assert.Equal("Wie soll das Kind heißen? Ein Spitzname genügt.", await FieldErrorAsync(patch, "displayName"));
    }

    [Fact]
    public async Task Patch_umlauts_and_emoji_are_listed_unchanged()
    {
        (User owner, User child) = await SeedFamilyAsync();
        const string name = "Jürgen 🦊";

        HttpResponseMessage patch = await PatchAsync(owner, child.Id, new { displayName = name });

        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        using HttpClient client = _factory.CreateClientFor(owner);
        List<LearnerDto>? learners = await client.GetFromJsonAsync<List<LearnerDto>>(Path);
        Assert.Equal(name, Assert.Single(learners!, l => l.Id == child.Id).DisplayName);
    }

    [Fact]
    public async Task Patch_without_name_keeps_the_name()
    {
        (User owner, User child) = await SeedFamilyAsync();

        HttpResponseMessage patch = await PatchAsync(owner, child.Id, new { dailyNewLimit = 4 });

        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        Assert.Equal(child.DisplayName, (await ProfileAsync(child.Id)).User!.DisplayName);
    }

    // Alle Pruefungen vor der ersten Zuweisung: kein Teil der Anfrage wird gespeichert.
    [Fact]
    public async Task Invalid_patch_changes_nothing()
    {
        (User owner, User child) = await SeedFamilyAsync(OldPin);
        LearnerProfile before = await ProfileAsync(child.Id);

        HttpResponseMessage patch = await PatchAsync(
            owner, child.Id, new { displayName = UniqueName(), dailyNewLimit = 12, pin = "12" });

        Assert.Equal(PinInvalid, await FieldErrorAsync(patch, "pin"));
        LearnerProfile after = await ProfileAsync(child.Id);
        Assert.Equal(child.DisplayName, after.User!.DisplayName);
        Assert.Equal(before.DailyNewLimit, after.DailyNewLimit);
        Assert.Equal(before.PinHash, after.PinHash);
    }

    [Fact]
    public async Task Patch_on_a_child_of_another_family_returns_404()
    {
        (User owner, _) = await SeedFamilyAsync();
        (_, User foreignChild) = await SeedFamilyAsync(OldPin);

        HttpResponseMessage patch = await PatchAsync(owner, foreignChild.Id, new { displayName = "Fremd", pin = "1111" });

        Assert.Equal(HttpStatusCode.NotFound, patch.StatusCode);
        LearnerProfile after = await ProfileAsync(foreignChild.Id);
        Assert.Equal(foreignChild.DisplayName, after.User!.DisplayName);
    }

    [Fact]
    public async Task Patch_with_child_token_returns_403()
    {
        (_, User child) = await SeedFamilyAsync();

        HttpResponseMessage patch = await PatchAsync(child, child.Id, new { pin = "1111" });

        Assert.Equal(HttpStatusCode.Forbidden, patch.StatusCode);
    }

    // Phasenziel: vergessene PIN ohne Hilfe ersetzen, auch wenn das Kind gesperrt ist.
    [Fact]
    public async Task New_pin_lifts_the_lockout()
    {
        (User owner, User child) = await SeedFamilyAsync(OldPin);
        await using (var db = _factory.CreateSystemDbContext())
        {
            LearnerProfile profile = await db.LearnerProfiles.SingleAsync(p => p.Id == child.Id);
            profile.FailedPinAttempts = 10;
            profile.PinLockedUntil = DateTimeOffset.UtcNow.AddMinutes(15);
            await db.SaveChangesAsync();
        }

        HttpResponseMessage patch = await PatchAsync(owner, child.Id, new { pin = "2580" });

        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        Assert.Equal(HttpStatusCode.OK, (await LearnerLoginAsync(child.Id, "2580")).StatusCode);
    }

    // Bearbeiten aendert nie den Lernstand: jedes Feld einzeln, Werte bewusst abseits der Standardwerte.
    [Fact]
    public async Task Patch_leaves_learning_and_gamification_state_unchanged()
    {
        (User owner, User child) = await SeedFamilyAsync(OldPin);
        await using (var db = _factory.CreateSystemDbContext())
        {
            db.ReviewStates.Add(new ReviewState
            {
                TenantId = owner.TenantId,
                LearnerId = child.Id,
                CardId = Guid.CreateVersion7(),
                EaseFactor = 1.7,
                IntervalDays = 12.5,
                Repetitions = 4,
                Lapses = 2,
                DueAt = new DateTimeOffset(2026, 11, 3, 8, 15, 0, TimeSpan.Zero),
                FirstSeenAt = new DateTimeOffset(2026, 9, 1, 7, 0, 0, TimeSpan.Zero),
                LastReviewedAt = new DateTimeOffset(2026, 10, 10, 18, 30, 0, TimeSpan.Zero),
                LastGrade = Grade.Hard,
                State = ReviewCardState.Review,
            });
            db.GamificationProfiles.Add(new GamificationProfile
            {
                Id = child.Id,
                TenantId = owner.TenantId,
                Xp = 120,
                CurrentStreak = 3,
            });
            await db.SaveChangesAsync();
        }

        (List<ReviewState> statesBefore, GamificationProfile gameBefore) = await LearningStateAsync(child.Id);

        HttpResponseMessage patch = await PatchAsync(
            owner, child.Id, new { displayName = UniqueName(), dailyNewLimit = 11, pin = "4321" });

        Assert.Equal(HttpStatusCode.OK, patch.StatusCode);
        (List<ReviewState> statesAfter, GamificationProfile gameAfter) = await LearningStateAsync(child.Id);
        Assert.Equal(statesBefore.Count, statesAfter.Count);
        ReviewState before = Assert.Single(statesBefore);
        ReviewState after = Assert.Single(statesAfter);
        Assert.Equal(before.CardId, after.CardId);
        Assert.Equal(before.EaseFactor, after.EaseFactor);
        Assert.Equal(before.IntervalDays, after.IntervalDays);
        Assert.Equal(before.Repetitions, after.Repetitions);
        Assert.Equal(before.Lapses, after.Lapses);
        Assert.Equal(before.DueAt, after.DueAt);
        Assert.Equal(before.FirstSeenAt, after.FirstSeenAt);
        Assert.Equal(before.LastReviewedAt, after.LastReviewedAt);
        Assert.Equal(before.LastGrade, after.LastGrade);
        Assert.Equal(before.State, after.State);
        Assert.Equal(120, gameAfter.Xp);
        Assert.Equal(3, gameAfter.CurrentStreak);
        Assert.Equal(gameBefore.Xp, gameAfter.Xp);
        Assert.Equal(gameBefore.CurrentStreak, gameAfter.CurrentStreak);
    }

    private async Task<(List<ReviewState> States, GamificationProfile Game)> LearningStateAsync(Guid learnerId)
    {
        await using var db = _factory.CreateSystemDbContext();
        List<ReviewState> states = await db.ReviewStates.AsNoTracking().Where(r => r.LearnerId == learnerId).ToListAsync();
        GamificationProfile game = await db.GamificationProfiles.AsNoTracking().SingleAsync(g => g.Id == learnerId);
        return (states, game);
    }
}
