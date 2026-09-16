namespace WordQuest.Modules.Learning.Services;

public static class Levenshtein
{
    /// <summary>
    /// Editierdistanz mit Obergrenze. Bricht ab, sobald klar ist, dass die
    /// Distanz groesser als <paramref name="max"/> ist — fuer den Vergleich
    /// "hoechstens ein Tippfehler" reicht das und spart die volle Matrix.
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

        // Kuerzere Zeichenkette in die Spalten, damit die Zeilen kurz bleiben.
        // Bewusst mit Zwischenvariable statt (a, b) = (b, a): der Tausch per
        // Tupel baut intern einen ValueTuple, und ein ref struct wie
        // ReadOnlySpan<char> darf da nicht hinein.
        if (a.Length > b.Length)
        {
            ReadOnlySpan<char> longer = a;
            a = b;
            b = longer;
        }

        int width = a.Length + 1;
        Span<int> previous = width <= 128 ? stackalloc int[width] : new int[width];
        Span<int> current = width <= 128 ? stackalloc int[width] : new int[width];

        for (int i = 0; i < width; i++)
        {
            previous[i] = i;
        }

        for (int j = 1; j <= b.Length; j++)
        {
            current[0] = j;
            int rowMin = current[0];

            for (int i = 1; i <= a.Length; i++)
            {
                int cost = a[i - 1] == b[j - 1] ? 0 : 1;
                int value = Math.Min(
                    Math.Min(current[i - 1] + 1, previous[i] + 1),
                    previous[i - 1] + cost);

                current[i] = value;
                rowMin = Math.Min(rowMin, value);
            }

            if (rowMin > max)
            {
                return max + 1;
            }

            // Zeilen tauschen statt kopieren.
            Span<int> swap = previous;
            previous = current;
            current = swap;
        }

        return previous[a.Length];
    }

    public static bool IsWithin(string a, string b, int max) =>
        Distance(a.AsSpan(), b.AsSpan(), max) <= max;
}
