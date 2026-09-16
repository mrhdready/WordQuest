using System.Security.Cryptography;

namespace WordQuest.Modules.Identity.Services;

/// <summary>
/// PBKDF2-HMAC-SHA256. Bewusst ohne externe Abhaengigkeit: wenige Zeilen,
/// vollstaendig pruefbar, und die Parameter stehen sichtbar im Code.
/// Format: <c>v1.{iterations}.{salt:base64}.{subkey:base64}</c>
/// </summary>
public static class PasswordHasher
{
    private const int SaltSize = 16;
    private const int SubkeySize = 32;
    private const int DefaultIterations = 210_000;

    public static string Hash(string password, int iterations = DefaultIterations)
    {
        ArgumentException.ThrowIfNullOrWhiteSpace(password);

        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
        byte[] subkey = Rfc2898DeriveBytes.Pbkdf2(
            password, salt, iterations, HashAlgorithmName.SHA256, SubkeySize);

        return $"v1.{iterations}.{Convert.ToBase64String(salt)}.{Convert.ToBase64String(subkey)}";
    }

    /// <summary>
    /// Prueft ein Passwort gegen einen gespeicherten Hash. Laeuft in konstanter
    /// Zeit bezogen auf den Hashvergleich; ein unlesbarer Hash gilt als falsch.
    /// </summary>
    public static bool Verify(string password, string? encoded)
    {
        if (string.IsNullOrEmpty(password) || string.IsNullOrEmpty(encoded))
        {
            return false;
        }

        string[] parts = encoded.Split('.');
        if (parts.Length != 4 || parts[0] != "v1")
        {
            return false;
        }

        if (!int.TryParse(parts[1], out int iterations) || iterations < 1_000)
        {
            return false;
        }

        byte[] salt;
        byte[] expected;
        try
        {
            salt = Convert.FromBase64String(parts[2]);
            expected = Convert.FromBase64String(parts[3]);
        }
        catch (FormatException)
        {
            return false;
        }

        byte[] actual = Rfc2898DeriveBytes.Pbkdf2(
            password, salt, iterations, HashAlgorithmName.SHA256, expected.Length);

        return CryptographicOperations.FixedTimeEquals(actual, expected);
    }

    /// <summary>
    /// True, wenn der Hash mit veralteten Parametern erzeugt wurde und beim
    /// naechsten erfolgreichen Login neu berechnet werden sollte.
    /// </summary>
    public static bool NeedsRehash(string? encoded)
    {
        if (string.IsNullOrEmpty(encoded))
        {
            return true;
        }

        string[] parts = encoded.Split('.');
        return parts.Length != 4
            || parts[0] != "v1"
            || !int.TryParse(parts[1], out int iterations)
            || iterations < DefaultIterations;
    }
}
