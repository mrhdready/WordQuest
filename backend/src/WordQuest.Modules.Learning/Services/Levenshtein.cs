namespace WordQuest.Modules.Learning.Services;

/// <summary>
/// Editierdistanz nach Damerau-Levenshtein (Optimal String Alignment).
///
/// Bewusst nicht die einfache Levenshtein-Distanz: Der haeufigste Tippfehler
/// auf einer Tastatur ist der Dreher zweier benachbarter Buchstaben —
/// "becuase" statt "because". Levenshtein bewertet einen Dreher als zwei
/// Operationen, das Kind bekaeme also "falsch" zu sehen, obwohl es die
/// Vokabel kann. Damerau zaehlt ihn als eine.
/// </summary>
public static class Levenshtein
{
    /// <summary>
    /// Bricht ab, sobald klar ist, dass die Distanz groesser als
    /// <paramref name="max"/> ist — fuer den Vergleich "hoechstens ein
    /// Tippfehler" reicht das und spart die volle Matrix.
    /// </summary>
    public static int Distance(ReadOnlySpan<char> a, ReadOnlySpan<char> b, int max = int.MaxValue)
    {
        if (a.Length == 0)
        {
            return b.Length;
        }

        if (b.Length == 0)
        {
            return a.Length;
        }

        if (Math.Abs(a.Length - b.Length) > max)
        {
            return max + 1;
        }

        // Die kuerzere Zeichenkette in die Spalten, damit die Zeilen kurz
        // bleiben. Bewusst mit Zwischenvariable statt (a, b) = (b, a): der
        // Tausch per Tupel baut intern einen ValueTuple, und ein ref struct
        // wie ReadOnlySpan<char> darf da nicht hinein.
        if (b.Length > a.Length)
        {
            ReadOnlySpan<char> longer = b;
            b = a;
            a = longer;
        }

        int width = b.Length + 1;

        // Drei Zeilen statt zwei: der Dreher greift zwei Zeilen zurueck.
        Span<int> twoBack = width <= 128 ? stackalloc int[width] : new int[width];
        Span<int> oneBack = width <= 128 ? stackalloc int[width] : new int[width];
        Span<int> current = width <= 128 ? stackalloc int[width] : new int[width];

        for (int j = 0; j < width; j++)
        {
            oneBack[j] = j;
        }

        for (int i = 1; i <= a.Length; i++)
        {
            current[0] = i;
            int rowMin = current[0];

            for (int j = 1; j <= b.Length; j++)
            {
                int cost = a[i - 1] == b[j - 1] ? 0 : 1;

                int value = Math.Min(
                    Math.Min(oneBack[j] + 1, current[j - 1] + 1),
                    oneBack[j - 1] + cost);

                // Dreher zweier benachbarter Zeichen kostet eins, nicht zwei.
                if (i > 1 && j > 1 && a[i - 1] == b[j - 2] && a[i - 2] == b[j - 1])
                {
                    value = Math.Min(value, twoBack[j - 2] + 1);
                }

                current[j] = value;
                rowMin = Math.Min(rowMin, value);
            }

            if (rowMin > max)
            {
                return max + 1;
            }

            // Zeilen rotieren statt kopieren.
            Span<int> recycled = twoBack;
            twoBack = oneBack;
            oneBack = current;
            current = recycled;
        }

        return oneBack[b.Length];
    }

    public static bool IsWithin(string a, string b, int max) =>
        Distance(a.AsSpan(), b.AsSpan(), max) <= max;
}
