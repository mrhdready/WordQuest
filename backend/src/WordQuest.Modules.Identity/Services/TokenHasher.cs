using System.Security.Cryptography;
using System.Text;

namespace WordQuest.Modules.Identity.Services;

/// <summary>
/// Refresh-Tokens sind bereits 256 Bit Zufall — ein langsames KDF bringt hier
/// nichts, ein einfacher SHA-256 genuegt, damit der Datenbankinhalt allein
/// keine Sitzungsuebernahme erlaubt.
/// </summary>
public static class TokenHasher
{
    public static string NewToken() => Convert.ToBase64String(RandomNumberGenerator.GetBytes(32));

    public static string Hash(string token) =>
        Convert.ToBase64String(SHA256.HashData(Encoding.UTF8.GetBytes(token)));
}
