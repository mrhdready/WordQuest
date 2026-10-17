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
        group.MapPatch("/{setId:guid}", UpdateAsync).RequireAuthorization("Guardian");
        group.MapDelete("/{setId:guid}", DeleteAsync).RequireAuthorization("Guardian");
        group.MapPost("/{setId:guid}/entries", AddEntryAsync).RequireAuthorization("Guardian");
        group.MapPut("/{setId:guid}/entries/{entryId:guid}", UpdateEntryAsync).RequireAuthorization("Guardian");
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
        if (TitleProblem(request.Title) is { } problem)
        {
            return problem;
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

    /// <summary>
    /// Benennt das Set an Ort und Stelle um (D-08): Set-, Eintrags- und
    /// Karten-IDs bleiben, damit der Lernstand der Kinder erhalten bleibt.
    /// </summary>
    private static async Task<IResult> UpdateAsync(
        Guid setId, UpdateSetRequest request, WordQuestDbContext db, CancellationToken ct)
    {
        if (TitleProblem(request.Title) is { } problem)
        {
            return problem;
        }

        // Mandantenfilter: ein Set einer anderen Familie ist hier "nicht gefunden".
        VocabularySet? set = await db.VocabularySets.FirstOrDefaultAsync(s => s.Id == setId, ct);
        if (set is null)
        {
            return SetNotFound();
        }

        set.Title = request.Title!.Trim();
        await db.SaveChangesAsync(ct);

        int entryCount = await db.VocabularyEntries.CountAsync(e => e.SetId == setId, ct);
        return Results.Ok(new VocabularySetDto(set.Id, set.Title, set.Description,
            set.SourceLanguage, set.TargetLanguage, entryCount));
    }

    // Eine Regel fuer Anlegen und Umbenennen; die Texte stehen hier, die Grenze in ContentRules.
    private static IResult? TitleProblem(string? title) =>
        ContentRules.CheckText(title) switch
        {
            ContentTextProblem.Missing => TitleError("Ein Set braucht einen Titel."),
            ContentTextProblem.TooLong => TitleError("Der Titel darf höchstens 200 Zeichen lang sein."),
            _ => null,
        };

    private static IResult TitleError(string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { ["title"] = [message] });

    // Mit Text: die Set-Seite zeigt ihn im Dialog, wenn das Set in einem anderen Tab schon geloescht wurde.
    private static IResult SetNotFound() =>
        Results.Problem(
            title: "Nicht gefunden",
            detail: "Dieses Set gibt es nicht (mehr).",
            statusCode: StatusCodes.Status404NotFound);

    private static async Task<IResult> DeleteAsync(
        Guid setId, WordQuestDbContext db, CancellationToken ct)
    {
        VocabularySet? set = await db.VocabularySets.FirstOrDefaultAsync(s => s.Id == setId, ct);
        if (set is null)
        {
            return SetNotFound();
        }

        // Vokabeln, Karten und Lernstand entfernt die Datenbank per Fremdschluessel (02-02);
        // Sitzungsprotokolle bleiben ohne Set-Bezug stehen.
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

    /// <summary>
    /// Korrigiert Deutsch und Englisch an Ort und Stelle (PAR-04, D-08): Eintrags- und
    /// Karten-IDs bleiben, damit der Lernstand der Kinder erhalten bleibt.
    /// </summary>
    private static async Task<IResult> UpdateEntryAsync(
        Guid setId, Guid entryId, UpdateEntryRequest request, WordQuestDbContext db, CancellationToken ct)
    {
        if (WordProblems(request.SourceText, request.TargetText) is { } errors)
        {
            return Results.ValidationProblem(errors);
        }

        // Mandantenfilter plus Set-Bedingung: fremd, unbekannt oder aus einem anderen Set ist "nicht gefunden".
        VocabularyEntry? entry = await db.VocabularyEntries
            .FirstOrDefaultAsync(e => e.Id == entryId && e.SetId == setId, ct);
        if (entry is null)
        {
            return EntryNotFound();
        }

        // Nur die beiden Woerter: Karten, Lernstand, Emoji, Alternativen und Beispiele bleiben.
        entry.SourceText = request.SourceText!.Trim();
        entry.TargetText = request.TargetText!.Trim();
        await db.SaveChangesAsync(ct);
        return Results.Ok(ToDto(entry));
    }

    // Alle Feldfehler gemeinsam; null, wenn beide Woerter passen. Die Grenze steht in ContentRules.
    private static Dictionary<string, string[]>? WordProblems(string? sourceText, string? targetText)
    {
        var errors = new Dictionary<string, string[]>();
        AddWordProblem(errors, "sourceText", sourceText, "Bitte gib das deutsche Wort ein.");
        AddWordProblem(errors, "targetText", targetText, "Bitte gib das englische Wort ein.");
        return errors.Count == 0 ? null : errors;
    }

    private static void AddWordProblem(Dictionary<string, string[]> errors, string key, string? text, string missing)
    {
        string? message = ContentRules.CheckText(text) switch
        {
            ContentTextProblem.Missing => missing,
            ContentTextProblem.TooLong => "Das Wort darf höchstens 200 Zeichen lang sein.",
            _ => null,
        };
        if (message is not null)
        {
            errors[key] = [message];
        }
    }

    // Mit Text: die Set-Seite zeigt ihn im Dialog, wenn die Vokabel in einem anderen Tab schon geloescht wurde.
    private static IResult EntryNotFound() =>
        Results.Problem(
            title: "Nicht gefunden",
            detail: "Diese Vokabel gibt es nicht (mehr).",
            statusCode: StatusCodes.Status404NotFound);

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
