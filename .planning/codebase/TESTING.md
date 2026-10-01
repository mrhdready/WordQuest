---
last_mapped_commit: 4ce32da23d1c0046c5a7ec201ef058c9a776f2c8
last_mapped_at: 2026-09-24
---
# Testing Patterns

**Analysis Date:** 2026-09-24

## Test Framework

**Runner:**

- xUnit 2.9.3 with `xunit.runner.visualstudio` 4.0.0, `Microsoft.NET.Test.Sdk` 18.10.1
- Config: `backend/tests/WordQuest.Learning.Tests/WordQuest.Learning.Tests.csproj` (global `<Using Include="Xunit" />`)
- Note in csproj: runner 4.x targets xunit v3; if no tests are discovered, bump both or downgrade runner to 2.8.2 — change the pair together.

**Assertion Library:**

- xUnit `Assert` only (no FluentAssertions, no Shouldly).

**Run Commands:**

```bash
dotnet test backend/WordQuest.slnx -c Release                                  # Run all tests
dotnet watch test --project backend/tests/WordQuest.Learning.Tests             # Watch mode
dotnet test backend/WordQuest.slnx -c Release --collect:"XPlat Code Coverage" # Coverage (coverlet.collector 10.0.1)
```

`dotnet` is not installed on the host; run inside `mcr.microsoft.com/dotnet/sdk:10.0`.

**Measured (2026-09-24, SDK 10 container):** 104/104 passed. Coverlet overall line 70.2% (396/564), branch 83.3% (204/245).

## Test File Organization

**Location:**

- Separate test project: `backend/tests/WordQuest.Learning.Tests/` (one project for all modules despite the name).

**Naming:**

- `<ClassUnderTest>Tests.cs` (`AnswerEvaluatorTests.cs`, `Sm2SchedulerTests.cs`, `CsvVocabularyParserTests.cs`); thematic exceptions `GamificationTests.cs`, `YearLongSimulationTests.cs`.
- Test methods: English behaviour sentences in PascalCase, no `Should_`/underscore style (`AcceptsAlternativeTranslations`, `StopsIntroducingNewCardsWhenTheLearnerIsBehind`).

**Structure:**

```
backend/tests/WordQuest.Learning.Tests/
├── AnswerEvaluatorTests.cs      # Learning: answer grading, typo tolerance
├── CsvVocabularyParserTests.cs  # Content: CSV import
├── GamificationTests.cs         # Gamification: XP, streak, level
├── LevenshteinTests.cs          # Learning: Damerau-Levenshtein
├── SessionComposerTests.cs      # Learning: session composition
├── Sm2SchedulerTests.cs         # Learning: SM-2 scheduling
└── YearLongSimulationTests.cs   # 365-day workload simulation
```

Project references only `Shared.Kernel`, `Modules.Content`, `Modules.Learning`, `Modules.Gamification`.

## Test Structure

**Suite Organization:**

```csharp
namespace WordQuest.Learning.Tests;

public sealed class AnswerEvaluatorTests
{
    private readonly AnswerEvaluator _evaluator = new();

    [Theory]
    [InlineData("dog")]
    [InlineData("  DOG  ")]
    public void AcceptsTheSameWordRegardlessOfCaseAndPadding(string given)
    {
        AnswerEvaluation result = _evaluator.Evaluate(given, ExpectedAnswer.Of("dog"), 3000);

        Assert.True(result.IsCorrect);
        Assert.False(result.HadTypo);
    }
}
```

**Patterns:**

- Setup: SUT as `private readonly` field constructed with `new()`; xUnit creates a fresh class instance per test. No `IClassFixture`, no constructor setup logic.
- Teardown: none (pure in-memory code).
- Arrange/act/assert separated by blank lines, no `// Arrange` markers. Explicit result type (`AnswerEvaluation result = ...`).
- `[Theory]` + `[InlineData]` for input tables; `[Fact]` otherwise.
- German comment above non-obvious tests explaining the domain reason (see `SessionComposerTests.StopsIntroducingNewCardsWhenTheLearnerIsBehind`); inline `// 8 faellige + 5 neue` for magic numbers.

## Mocking

**Framework:** None. No mocking library referenced.

**Patterns:**

```csharp
// Time is a fixed value, passed in as a parameter
private static readonly DateTimeOffset Now = new(2026, 5, 4, 17, 0, 0, TimeSpan.Zero);

IReadOnlyList<SessionCandidate> session = _composer.Compose(
    [], Candidates(8, ReviewCardState.Review, 60), Candidates(40, ReviewCardState.New), 5, Now);
```

**What to Mock:**

- Nothing. Keep domain services pure (inputs incl. `DateTimeOffset now` / `SchedulerOptions` as parameters) so they are testable without doubles. For Api/Infrastructure code, `TimeProvider` is injected — use `FakeTimeProvider` if tests are added there.

**What NOT to Mock:**

- Domain services, records, entities — instantiate directly.

## Fixtures and Factories

**Test Data:**

```csharp
private static List<SessionCandidate> Candidates(int count, ReviewCardState state, int minutesOverdue = 0)
    => [.. Enumerable.Range(0, count).Select(i =>
        new SessionCandidate(Guid.NewGuid(), state, Now.AddMinutes(-minutesOverdue - i)))];
```

Inline CSV strings for the parser (`CsvVocabularyParser.Parse("Hund;dog\nHaus;house\n")`). `YearLongSimulationTests` uses private nested `record Stats` / `class CardState` and constants (`TotalCards = 600`, `Days = 365`).

**Location:**

- Private static helpers inside each test class. No shared fixtures folder.

## Coverage

**Requirements:** None enforced (no threshold in CI; `.github/workflows/ci.yml` collects coverage and uploads `**/TestResults/**` as artifact only).

**Measured per assembly (line):** Shared.Kernel 100%, Gamification 85.5% (LevelCurve 72%), Learning 70.5% (GameCatalog 0%), Content 59.8%. `WordQuest.Api`, `WordQuest.Infrastructure`, `WordQuest.Modules.Identity` are not referenced by the test project and absent from the report — effectively 0% (auth, token rotation, `LearningService`, endpoints, tenant filters untested).

**View Coverage:**

```bash
dotnet test backend/WordQuest.slnx -c Release --collect:"XPlat Code Coverage"

# -> backend/tests/WordQuest.Learning.Tests/TestResults/<guid>/coverage.cobertura.xml

```

## Test Types

**Unit Tests:**

- All 104 tests are unit tests of pure domain logic in `WordQuest.Modules.*`.

**Integration Tests:**

- Not present. No `WebApplicationFactory`, no EF Core test database. New tests for endpoints/`LearningService` need a new project (e.g. `backend/tests/WordQuest.Api.Tests/`) referencing `WordQuest.Api`.

**Simulation Tests:**

- `YearLongSimulationTests.cs` — declared the most important test: simulates a synthetic learner over 365 days and asserts bounded workload (peak due, steady state) and growing intervals, not formula details. Keep it green on any scheduler/composer change.

**E2E Tests:**

- Not used. Frontend has no tests, no test runner, no `test` script in `frontend/package.json`. CI frontend job runs only `npm run lint`, `npm run typecheck`, `npm run build`.

## Common Patterns

**Async Testing:**

```csharp
// Not present: all tested code is synchronous. For new async tests use
// public async Task NameAsync() { ... await ... } — xUnit supports Task-returning tests.
```

**Error Testing:**

```csharp
// No Assert.Throws in the suite; invalid input is expressed as a result value:
AnswerEvaluation result = _evaluator.Evaluate("", ExpectedAnswer.Of("dog"), 3000);
Assert.False(result.IsCorrect);
```

---

*Testing analysis: 2026-09-24*
