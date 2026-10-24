using System.Threading.RateLimiting;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.HttpOverrides;
using Microsoft.AspNetCore.RateLimiting;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using Microsoft.EntityFrameworkCore.Storage;
using WordQuest.Api;
using WordQuest.Api.Auth;
using WordQuest.Api.Endpoints;
using WordQuest.Infrastructure;
using WordQuest.Infrastructure.Seed;
using WordQuest.Modules.Learning.Services;
using WordQuest.Shared.Kernel;

WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// Ausserhalb von Development keine fehlenden oder bekannten Standard-Secrets
// (SETUP-05). Laeuft vor jedem Datenbankzugriff und vor jedem CLI-Verb.
if (!builder.Environment.IsDevelopment())
{
    string? explicitConnection = builder.Configuration.GetConnectionString("Default");
    string? secretProblem =
        SecretCheck.SigningKeyProblem(ReadSecret("WQ_JWT_SIGNING_KEY", builder.Configuration["Auth:SigningKey"]))
        ?? (string.IsNullOrWhiteSpace(explicitConnection)
            ? SecretCheck.Problem("WQ_DB_PASSWORD", ReadSecret("WQ_DB_PASSWORD", null))
            : SecretCheck.ConnectionStringProblem(explicitConnection));

    if (secretProblem is not null)
    {
        Console.Error.WriteLine(secretProblem);
        Environment.ExitCode = 1;
        return;
    }

    // Demo-Daten nur in Development (CR-01): ein Demo-Konto hat ein bekanntes Passwort.
    string? seedProblem = DemoAccountCheck.SeedProblem(builder.Configuration.GetValue("WQ_SEED_DEMO_DATA", false));
    if (seedProblem is not null)
    {
        Console.Error.WriteLine(seedProblem);
        Environment.ExitCode = 1;
        return;
    }
}

// --- Konfiguration ----------------------------------------------------------
// Secrets kommen als Datei (Docker Secrets), nicht als Umgebungsvariable:
// Umgebungsvariablen tauchen in Prozesslisten, Crashdumps und `docker inspect`
// auf, Dateien unter /run/secrets nicht.
string signingKey = ReadSecret("WQ_JWT_SIGNING_KEY", builder.Configuration["Auth:SigningKey"])
    ?? throw new InvalidOperationException(
        "Kein JWT-Signaturschluessel. WQ_JWT_SIGNING_KEY_FILE setzen oder setup.sh ausfuehren.");

// Greift nur noch in Development; sonst meldet SecretCheck die Laenge vorher lesbar.
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
builder.Services.AddScoped<PictureService>();
builder.Services.AddScoped<AuthService>();
builder.Services.AddScoped<AccountService>();
builder.Services.AddSingleton<JwtTokenService>();

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        var tokenService = new JwtTokenService(
            Microsoft.Extensions.Options.Options.Create(new AuthOptions { SigningKey = signingKey }),
            TimeProvider.System);
        options.TokenValidationParameters = tokenService.ValidationParameters;
        // Claims unveraendert lassen: Die Standard-Zuordnung benennt "tid"
        // in einen langen Claim-Typ um, HttpTenantContext findet den
        // Mandanten dann nicht und jede Abfrage liefert leere Ergebnisse.
        options.MapInboundClaims = false;
    });

// AddAuthentication registriert DataProtection mit, dessen Hintergrunddienst den
// Schluesselring schon beim Start anlegt. WordQuest schuetzt damit nichts (JWT mit
// eigenem Schluessel, Refresh-Token als SHA256-Hash). Ohne das Vorladen entfallen
// die zwei warn:-Zeilen zu Schluesseln im Container. Braucht spaeter etwas
// DataProtection (z. B. Antiforgery), kommen sie beim ersten Zugriff wieder; dann
// gehoeren die Schluessel in ein Volume.
// ImplementationType wirft bei Keyed-Registrierungen, deshalb die erste Bedingung.
ServiceDescriptor? keyRingPreload = builder.Services.SingleOrDefault(descriptor =>
    !descriptor.IsKeyedService
    && descriptor.ImplementationType?.FullName == "Microsoft.AspNetCore.DataProtection.Internal.DataProtectionHostedService");
if (keyRingPreload is not null)
{
    builder.Services.Remove(keyRingPreload);
}

builder.Services.AddAuthorizationBuilder()
    .AddPolicy("Guardian", policy => policy.RequireRole("Owner", "Guardian"))
    .AddPolicy("Learner", policy => policy.RequireRole("Learner"));

// Begrenzt Rateversuche auf Login und PIN (Konzept §12), Standard 10 pro Minute,
// Partition pro echter Client-IP (FIX-01). nginx setzt X-Forwarded-For selbst auf
// die Adresse seines Absenders (im Traefik-Stack auf die Adresse, die Traefik
// meldet). Vertraut werden nur private Netze: Die API ist in keinem Stack
// veroeffentlicht, nur nginx erreicht sie, und Docker-Pools weichen je nach Host
// ab. ForwardLimit = 1, weil genau eine Stufe (nginx) direkt vor der API steht;
// ein vom Geraet vorangestellter Wert zaehlt so nie. Der e2e-Teststack setzt
// einen hoeheren Wert, weil Playwright alle Anfragen von einer IP schickt.
int authRequestsPerMinute = builder.Configuration.GetValue("Auth:RequestsPerMinute", 10);
if (authRequestsPerMinute < 1)
{
    // Sonst startet die API und jeder Login endet erst beim ersten Aufruf mit 500.
    throw new InvalidOperationException("Start abgebrochen: Auth:RequestsPerMinute muss mindestens 1 sein.");
}
builder.Services.Configure<ForwardedHeadersOptions>(options =>
{
    options.ForwardedHeaders = ForwardedHeaders.XForwardedFor;
    options.ForwardLimit = 1;
    // Loopback bleibt aus dem Standard erhalten.
    options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse("10.0.0.0/8"));
    options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse("172.16.0.0/12"));
    options.KnownIPNetworks.Add(System.Net.IPNetwork.Parse("192.168.0.0/16"));
});
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", context => RateLimitPartition.GetFixedWindowLimiter(
        context.Connection.RemoteIpAddress?.ToString() ?? "unknown",
        _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = authRequestsPerMinute,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
        }));
});

// Fehlender oder kaputter JSON-Body bzw. nicht bindbarer Parameter (direkter API-Aufruf):
// in jeder Umgebung 400 mit deutschem Text. Ohne das: 500 in Development, englisches
// "Bad Request" in Production.
builder.Services.Configure<RouteHandlerOptions>(options => options.ThrowOnBadRequest = true);
builder.Services.Configure<ExceptionHandlerOptions>(options =>
{
    options.StatusCodeSelector = exception =>
        exception is BadHttpRequestException bad ? bad.StatusCode : StatusCodes.Status500InternalServerError;
    // Fehler des Aufrufers, kein Serverfehler: nicht als Error protokollieren.
    options.SuppressDiagnosticsCallback = context => context.Exception is BadHttpRequestException;
});
builder.Services.AddProblemDetails(options => options.CustomizeProblemDetails = context =>
{
    if (context.Exception is BadHttpRequestException { StatusCode: StatusCodes.Status400BadRequest })
    {
        context.ProblemDetails.Title = "Ungültige Anfrage";
        context.ProblemDetails.Detail = "Die Anfrage ist unvollständig oder nicht lesbar.";
    }
});
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

// Wartungsverben laufen vor dem Start-Block: keine Migration, kein Kestrel.
// Aufruf per exec im laufenden Container (setup.sh) oder per run, wenn die API
// nach einem Startabbruch nicht laeuft (DemoAccountCheck); das Schema ist dann
// schon migriert.
if (AccountCommands.IsCommand(args))
{
    Environment.ExitCode = await AccountCommands.RunAsync(app.Services, args, Console.In, Console.Out);
    return;
}

// --- Pipeline ---------------------------------------------------------------
app.UseExceptionHandler();
app.UseStatusCodePages();
// Vor dem Rate-Limiter: setzt Connection.RemoteIpAddress auf die Adresse des Geraets.
app.UseForwardedHeaders();

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
app.MapAccountEndpoints();
app.MapLearnerEndpoints();
app.MapSetEndpoints();
app.MapPictureEndpoints();
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

    // Erster Start gegen die leere Datenbank aus Compose: Die Migrationshistorie
    // anlegen, wie es MigrateAsync ohnehin als Erstes tut. Sonst lesen OrphanCleanup
    // und NpgsqlMigrator.MigrateAsync die noch fehlende Tabelle; Npgsql faengt den
    // Fehler ab, EF loggt die Abfrage vorher aber als fail:, und das sieht fuer
    // Eltern nach einem Fehler aus. Fehlt die Datenbank ganz, legt MigrateAsync sie an.
    if (await db.GetService<IRelationalDatabaseCreator>().ExistsAsync())
    {
        await db.GetService<IHistoryRepository>().CreateIfNotExistsAsync();
    }

    // Waisen aus Altinstallationen vor den Fremdschluesseln entfernen (D-18).
    // Die CLI-Verben oben migrieren nicht und brauchen das deshalb nicht.
    await OrphanCleanup.RunAsync(db);
    await db.Database.MigrateAsync();
    logger.LogInformation("Datenbankschema ist aktuell.");

    if (app.Configuration.GetValue("WQ_SEED_DEMO_DATA", false))
    {
        await DemoDataSeeder.SeedAsync(db, logger);
    }

    // Nach der Migration, aber hinter den CLI-Verben: reset-password bleibt der Ausweg.
    if (!app.Environment.IsDevelopment()
        && await DemoAccountCheck.AccountProblemAsync(db) is { } demoProblem)
    {
        Console.Error.WriteLine(demoProblem);
        Environment.ExitCode = 1;
        return;
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

    // GSS aus: Npgsql versucht sonst libgssapi zu laden, die das Alpine-Image
    // nicht hat, und schreibt bei jedem Verbindungsaufbau einen Fehler nach stderr.
    return $"Host={host};Port={port};Database={name};Username={user};Password={password};GSS Encryption Mode=Disable";
}

/// <summary>Erlaubt Integrationstests via WebApplicationFactory.</summary>
public partial class Program;
