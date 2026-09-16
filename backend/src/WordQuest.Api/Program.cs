using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using WordQuest.Api.Auth;
using WordQuest.Api.Endpoints;
using WordQuest.Infrastructure;
using WordQuest.Infrastructure.Seed;
using WordQuest.Modules.Learning.Services;
using WordQuest.Shared.Kernel;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// --- Konfiguration ----------------------------------------------------------
// Secrets kommen als Datei (Docker Secrets), nicht als Umgebungsvariable:
// Umgebungsvariablen tauchen in Prozesslisten, Crashdumps und `docker inspect`
// auf, Dateien unter /run/secrets nicht.
string signingKey = ReadSecret("WQ_JWT_SIGNING_KEY", builder.Configuration["Auth:SigningKey"])
    ?? throw new InvalidOperationException(
        "Kein JWT-Signaturschluessel. WQ_JWT_SIGNING_KEY_FILE setzen oder setup.sh ausfuehren.");

if (signingKey.Length < 32)
{
    throw new InvalidOperationException(
        "Der JWT-Signaturschluessel ist zu kurz (mindestens 32 Zeichen).");
}

string connectionString = BuildConnectionString(builder.Configuration);

builder.Services.Configure<AuthOptions>(options =>
{
    builder.Configuration.GetSection(AuthOptions.Section).Bind(options);
    options.SigningKey = signingKey;
});

// --- Dienste ----------------------------------------------------------------
builder.Services.AddHttpContextAccessor();
builder.Services.AddSingleton(TimeProvider.System);
builder.Services.AddScoped<ITenantContext, HttpTenantContext>();

builder.Services.AddDbContext<WordQuestDbContext>(options =>
    options.UseNpgsql(connectionString, npgsql => npgsql.EnableRetryOnFailure(3)));

builder.Services.AddSingleton(new SchedulerOptions
{
    TimeZoneId = builder.Configuration["WQ_TIMEZONE"] ?? "Europe/Berlin",
});
builder.Services.AddSingleton(sp => new Sm2Scheduler(sp.GetRequiredService<SchedulerOptions>()));
builder.Services.AddSingleton(sp => new SessionComposer(sp.GetRequiredService<SchedulerOptions>()));
builder.Services.AddSingleton(sp => new AnswerEvaluator(sp.GetRequiredService<SchedulerOptions>()));

builder.Services.AddScoped<LearningService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddSingleton<JwtTokenService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var tokenService = new JwtTokenService(
            Microsoft.Extensions.Options.Options.Create(new AuthOptions { SigningKey = signingKey }),
            TimeProvider.System);
        options.TokenValidationParameters = tokenService.ValidationParameters;
    });

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("Guardian", policy => policy.RequireRole("Owner", "Guardian"))
    .AddPolicy("Learner", policy => policy.RequireRole("Learner"));

// Begrenzt Rateversuche auf Login und PIN (Konzept §12).
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});

builder.Services.AddProblemDetails();
builder.Services.AddHealthChecks()
    .AddDbContextCheck<WordQuestDbContext>("database");

builder.Services.ConfigureHttpJsonOptions(options =>
{
    options.SerializerOptions.PropertyNamingPolicy = System.Text.Json.JsonNamingPolicy.CamelCase;
    options.SerializerOptions.Converters.Add(
        new System.Text.Json.Serialization.JsonStringEnumConverter());
});

if (builder.Environment.IsDevelopment())
{
    builder.Services.AddOpenApi();
    builder.Services.AddCors(options => options.AddDefaultPolicy(policy => policy
        .WithOrigins("http://localhost:5173")
        .AllowAnyHeader()
        .AllowAnyMethod()));
}

WebApplication app = builder.Build();

// --- Pipeline ---------------------------------------------------------------
app.UseExceptionHandler();
app.UseStatusCodePages();

if (app.Environment.IsDevelopment())
{
    app.MapOpenApi();
    app.UseCors();
}
else
{
    app.UseHsts();
}

app.UseRateLimiter();
app.UseAuthentication();
app.UseAuthorization();

app.MapHealthChecks("/health/live");
app.MapHealthChecks("/health/ready");

app.MapAuthEndpoints();
app.MapLearnerEndpoints();
app.MapSetEndpoints();
app.MapSessionEndpoints();

// --- Start ------------------------------------------------------------------
await using (AsyncServiceScope scope = app.Services.CreateAsyncScope())
{
    ILogger logger = scope.ServiceProvider
        .GetRequiredService<ILoggerFactory>()
        .CreateLogger("Startup");

    DbContextOptions<WordQuestDbContext> options =
        scope.ServiceProvider.GetRequiredService<DbContextOptions<WordQuestDbContext>>();

    // Fuer Migration und Seed bewusst ein eigener Kontext ohne
    // Mandantenfilter — der Request-Kontext kennt hier noch keinen Mandanten.
    await using var db = new WordQuestDbContext(options, new SystemTenantContext());

    await db.Database.MigrateAsync();
    logger.LogInformation("Datenbankschema ist aktuell.");

    if (app.Configuration.GetValue("WQ_SEED_DEMO_DATA", false))
    {
        await DemoDataSeeder.SeedAsync(db, logger);
    }
}

await app.RunAsync();

// --- Hilfen -----------------------------------------------------------------

static string? ReadSecret(string name, string? fallback)
{
    string? path = Environment.GetEnvironmentVariable($"{name}_FILE");
    if (!string.IsNullOrWhiteSpace(path) && File.Exists(path))
    {
        return File.ReadAllText(path).Trim();
    }

    string? direct = Environment.GetEnvironmentVariable(name);
    return string.IsNullOrWhiteSpace(direct) ? fallback : direct.Trim();
}

static string BuildConnectionString(IConfiguration configuration)
{
    string? explicitConnection = configuration.GetConnectionString("Default");
    if (!string.IsNullOrWhiteSpace(explicitConnection))
    {
        return explicitConnection;
    }

    string host = Environment.GetEnvironmentVariable("WQ_DB_HOST") ?? "localhost";
    string port = Environment.GetEnvironmentVariable("WQ_DB_PORT") ?? "5432";
    string name = Environment.GetEnvironmentVariable("WQ_DB_NAME") ?? "wordquest";
    string user = Environment.GetEnvironmentVariable("WQ_DB_USER") ?? "wordquest";
    string password = ReadSecret("WQ_DB_PASSWORD", "devpassword")!;

    return $"Host={host};Port={port};Database={name};Username={user};Password={password}";
}

/// <summary>Erlaubt Integrationstests via WebApplicationFactory.</summary>
public partial class Program;
