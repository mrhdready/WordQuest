using Microsoft.EntityFrameworkCore;
using WordQuest.Api.Auth;
using WordQuest.Api.Contracts;
using WordQuest.Infrastructure;
using WordQuest.Modules.Content.Entities;
using WordQuest.Modules.Content.Services;

namespace WordQuest.Api.Endpoints;

public static class SetEndpoints
{
    public static void MapSetEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder group = app.MapGroup("/api/v1/sets")
            .WithTags("Sets")
            .RequireAuthorization();

        // Lesen darf auch das Kind — es waehlt ja aus, was es ueben moechte.
        group.MapGet("/", ListAsync);
        group.MapGet("/{setId:guid}/entries", ListEntriesAsync);

        group.MapPost("/", CreateAsync).RequireAuthorization("Guardian");
        group.MapDelete("/{setId:guid}", DeleteAsync).RequireAuthorization("Guardian");
        group.MapPost("/{setId:guid}/entries", AddEntryAsync).RequireAuthorization("Guardian");
        group.MapDelete("/{setId:guid}/entries/{entryId:guid}", DeleteEntryAsync).RequireAuthorization("Guardian");
        group.MapPost("/import/preview", PreviewImport).RequireAuthorization("Guardian");
        group.MapPost("/{setId:guid}/import", ConfirmImportAsync).RequireAuthorization("Guardian");
    }

    private static async Task<IResult> ListAsync(WordQuestDbContext db, CancellationToken ct)
    {
        List<VocabularySetDto> sets = await db.VocabularySets
            .OrderBy(s => s.Title)
            .Select(s => new VocabularySetDto(
                s.Id, s.Title, s.Description, s.SourceLanguage, s.TargetLanguage, s.Entries.Count))
            .ToListAsync(ct);

        return Results.Ok(sets);
    }

    private static async Task<IResult> CreateAsync(
        CreateSetRequest request,
        WordQuestDbContext db,
        HttpContext http,
        CancellationToken ct)
    {
        if (string.IsNullOrWhiteSpace(request.Title))
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["title"] = ["Ein Set braucht einen Titel."],
            });
        }

        var set = new VocabularySet
        {
            Title = request.Title.Trim(),
            Description = request.Description?.Trim(),
            SourceLanguage = request.SourceLanguage ?? "de",
            TargetLanguage = request.TargetLanguage ?? "en",
            CreatedByUserId = http.User.UserId(),
        };

        db.VocabularySets.Add(set);
        await db.SaveChangesAsync(ct);

        return Results.Created(
            $"/api/v1/sets/{set.Id}",
            new VocabularySetDto(set.Id, set.Title, set.Description,
                set.SourceLanguage, set.TargetLanguage, 0));
    }

    private static async Task<IResult> DeleteAsync(
        Guid setId, WordQuestDbContext db, CancellationToken ct)
    {
        VocabularySet? set = await db.VocabularySets.FirstOrDefaultAsync(s => s.Id == setId, ct);
        if (set is null)
        {
            return Results.NotFound();
        }

        db.VocabularySets.Remove(set);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    private static async Task<IResult> ListEntriesAsync(
        Guid setId, WordQuestDbContext db, CancellationToken ct)
    {
        List<VocabularyEntryDto> entries = await db.VocabularyEntries
            .Where(e => e.SetId == setId)
            .OrderBy(e => e.Position)
            .Select(e => new VocabularyEntryDto(
                e.Id, e.SourceText, e.TargetText,
                e.TargetAlternatives, e.SourceAlternatives,
                e.PartOfSpeech.ToString(), e.Emoji,
                e.ExampleSource, e.ExampleTarget, e.Position))
            .ToListAsync(ct);

        return Results.Ok(entries);
    }

    private static async Task<IResult> AddEntryAsync(
        Guid setId, CreateEntryRequest request, WordQuestDbContext db, CancellationToken ct)
    {
        if (!await db.VocabularySets.AnyAsync(s => s.Id == setId, ct))
        {
            return Results.NotFound();
        }

        int nextPosition = await db.VocabularyEntries
            .Where(e => e.SetId == setId)
            .Select(e => (int?)e.Position)
            .MaxAsync(ct) ?? -1;

        VocabularyEntry entry = BuildEntry(setId, request, nextPosition + 1);
        if (entry.SourceText.Length == 0 || entry.TargetText.Length == 0)
        {
            return Results.ValidationProblem(new Dictionary<string, string[]>
            {
                ["entry"] = ["Beide Spalten muessen befuellt sein."],
            });
        }

        db.VocabularyEntries.Add(entry);
        db.Cards.AddRange(entry.CreateDefaultCards());
        await db.SaveChangesAsync(ct);

        return Results.Created($"/api/v1/sets/{setId}/entries/{entry.Id}", ToDto(entry));
    }

    private static async Task<IResult> DeleteEntryAsync(
        Guid setId, Guid entryId, WordQuestDbContext db, CancellationToken ct)
    {
        VocabularyEntry? entry = await db.VocabularyEntries
            .FirstOrDefaultAsync(e => e.Id == entryId && e.SetId == setId, ct);

        if (entry is null)
        {
            return Results.NotFound();
        }

        db.VocabularyEntries.Remove(entry);
        await db.SaveChangesAsync(ct);
        return Results.NoContent();
    }

    /// <summary>
    /// Zeigt, was der Import erkennen wuerde — ohne etwas zu schreiben.
    /// Eine Vorschau mit Korrekturmoeglichkeit ist der Unterschied zwischen
    /// einem brauchbaren und einem gefuerchteten Import.
    /// </summary>
    private static IResult PreviewImport(ImportPreviewRequest request)
    {
        CsvParseResult parsed = CsvVocabularyParser.Parse(request.Content);

        return Results.Ok(new ImportPreviewResponse(
            parsed.Delimiter.ToString(),
            parsed.HadHeader,
            parsed.ValidCount,
            parsed.ProblemCount,
            [.. parsed.Rows.Select(r => new ImportRowDto(r.LineNumber, r.Source, r.Target, r.Emoji, r.Problem))]));
    }

    private static async Task<IResult> ConfirmImportAsync(
        Guid setId, ImportConfirmRequest request, WordQuestDbContext db, CancellationToken ct)
    {
        if (!await db.VocabularySets.AnyAsync(s => s.Id == setId, ct))
        {
            return Results.NotFound();
        }

        int position = (await db.VocabularyEntries
            .Where(e => e.SetId == setId)
            .Select(e => (int?)e.Position)
            .MaxAsync(ct) ?? -1) + 1;

        var created = new List<VocabularyEntry>();
        foreach (CreateEntryRequest row in request.Entries)
        {
            VocabularyEntry entry = BuildEntry(setId, row, position++);
            if (entry.SourceText.Length == 0 || entry.TargetText.Length == 0)
            {
                continue;
            }

            created.Add(entry);
            db.VocabularyEntries.Add(entry);
            db.Cards.AddRange(entry.CreateDefaultCards());
        }

        await db.SaveChangesAsync(ct);
        return Results.Ok(new { imported = created.Count });
    }

    private static VocabularyEntry BuildEntry(Guid setId, CreateEntryRequest request, int position) =>
        new()
        {
            SetId = setId,
            SourceText = request.SourceText.Trim(),
            TargetText = request.TargetText.Trim(),
            TargetAlternatives = request.TargetAlternatives ?? [],
            SourceAlternatives = request.SourceAlternatives ?? [],
            PartOfSpeech = Enum.TryParse(request.PartOfSpeech, ignoreCase: true, out PartOfSpeech pos)
                ? pos
                : PartOfSpeech.Unknown,
            Emoji = string.IsNullOrWhiteSpace(request.Emoji) ? null : request.Emoji.Trim(),
            ExampleSource = request.ExampleSource?.Trim(),
            ExampleTarget = request.ExampleTarget?.Trim(),
            Position = position,
        };

    private static VocabularyEntryDto ToDto(VocabularyEntry e) =>
        new(e.Id, e.SourceText, e.TargetText, e.TargetAlternatives, e.SourceAlternatives,
            e.PartOfSpeech.ToString(), e.Emoji, e.ExampleSource, e.ExampleTarget, e.Position);
}
