using System.Net;
using System.Net.Http.Json;
using Microsoft.AspNetCore.Http;
using WordQuest.Api.Contracts;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Identity.Services;

namespace WordQuest.Api.Tests;

/// <summary>
/// POST /api/v1/learners (PAR-05, PAR-02 beim Anlegen, D-15). Gemeinsame
/// Factory, deshalb legt jeder Fall eine eigene Familie mit eindeutigen Namen
/// an und prueft keine globalen Zaehlungen (Isolationsregel ApiFactory).
/// Genau ein Aufruf der Policy "auth" (learner-login); GET /auth/profiles
/// verlangt genau einen Mandanten und wird hier nicht aufgerufen.
/// </summary>
public sealed class LearnerEndpointTests : IClassFixture<ApiFactory>
{
    private const string Path = "/api/v1/learners";
    private const string PinMissing = "Bitte gib eine PIN mit 4 bis 6 Ziffern ein.";
    private const string PinInvalid = "Die PIN muss aus 4 bis 6 Ziffern bestehen.";

    private readonly ApiFactory _factory;

    public LearnerEndpointTests(ApiFactory factory) => _factory = factory;

    // Familie mit Elternkonto und einem Kind, Namen eindeutig je Aufruf.
    private async Task<(User Owner, User Child)> SeedFamilyAsync()
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
        db.LearnerProfiles.Add(new LearnerProfile { Id = child.Id, TenantId = tenant.Id });
        await db.SaveChangesAsync();
        return (owner, child);
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
}
