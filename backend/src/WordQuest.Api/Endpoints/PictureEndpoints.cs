using WordQuest.Api.Contracts;
using WordQuest.Infrastructure;
using WordQuest.Modules.Content.Services;

namespace WordQuest.Api.Endpoints;

/// <summary>Bild je Vokabel (IMG-01): Eltern speichern, jede Rolle der Familie liest.</summary>
public static class PictureEndpoints
{
    private const string NotAPicture = "Das Bild muss eine vollständige WebP-, JPEG- oder PNG-Datei sein.";

    public static void MapPictureEndpoints(this IEndpointRouteBuilder app)
    {
        RouteGroupBuilder write = app.MapGroup("/api/v1/sets/{setId:guid}/entries/{entryId:guid}/picture")
            .WithTags("Pictures")
            .RequireAuthorization("Guardian");
        write.MapPut("/", PutAsync);

        // Lesen darf auch das Kind; der Mandantenfilter macht fremde Bilder zu 404.
        RouteGroupBuilder read = app.MapGroup("/api/v1/pictures")
            .WithTags("Pictures")
            .RequireAuthorization();
        read.MapGet("/{version:guid}", GetAsync);
    }

    /// <summary>
    /// Roher Body statt Formular: kein multipart, kein Antiforgery. Die Grenze
    /// setzt der Endpoint selbst, weil der TestServer keine Body-Grenze kennt und
    /// Kestrel mit englischem Text antworten wuerde (D-08).
    /// </summary>
    private static async Task<IResult> PutAsync(
        Guid setId, Guid entryId, HttpRequest request, PictureService pictures, CancellationToken ct)
    {
        if (request.ContentLength > PictureRules.MaxBytes)
        {
            return TooLarge();
        }

        // Content-Length kann fehlen (chunked): deshalb hoechstens MaxBytes + 1 lesen.
        byte[] buffer = new byte[PictureRules.MaxBytes + 1];
        int total = 0;
        int read;
        while (total < buffer.Length && (read = await request.Body.ReadAsync(buffer.AsMemory(total), ct)) > 0)
        {
            total += read;
        }

        if (total > PictureRules.MaxBytes)
        {
            return TooLarge();
        }

        byte[] data = buffer[..total];
        if (PictureRules.DetectContentType(data) is null)
        {
            return PictureError(NotAPicture);
        }

        Guid? version = await pictures.SaveAsync(setId, entryId, data, ct);
        return version is null ? SetEndpoints.EntryNotFound() : Results.Ok(new PictureDto(version.Value));
    }

    private static async Task<IResult> GetAsync(
        Guid version, PictureService pictures, HttpContext http, CancellationToken ct)
    {
        byte[]? data = await pictures.LoadAsync(version, ct);
        if (data is null)
        {
            return Results.NotFound();
        }

        // Die Version steht in der URL; trotzdem nichts zwischenspeichern (D-09, D-13).
        http.Response.Headers.CacheControl = "no-store";
        return Results.Bytes(data, PictureRules.DetectContentType(data));
    }

    private static IResult PictureError(string message) =>
        Results.ValidationProblem(new Dictionary<string, string[]> { ["picture"] = [message] });

    private static IResult TooLarge() =>
        Results.Problem(
            title: "Zu groß",
            detail: "Das Bild ist zu groß. Erlaubt sind höchstens 300 KB.",
            statusCode: StatusCodes.Status413PayloadTooLarge);
}
