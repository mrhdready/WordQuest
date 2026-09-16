using Microsoft.EntityFrameworkCore;
using WordQuest.Modules.Content.Entities;
using WordQuest.Modules.Gamification.Entities;
using WordQuest.Modules.Identity.Entities;
using WordQuest.Modules.Learning.Entities;
using WordQuest.Shared.Kernel;

namespace WordQuest.Infrastructure;

public sealed class WordQuestDbContext(
    DbContextOptions<WordQuestDbContext> options,
    ITenantContext tenantContext) : DbContext(options)
{
    private readonly ITenantContext _tenantContext = tenantContext;

    public DbSet<Tenant> Tenants => Set<Tenant>();
    public DbSet<User> Users => Set<User>();
    public DbSet<LearnerProfile> LearnerProfiles => Set<LearnerProfile>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();

    public DbSet<VocabularySet> VocabularySets => Set<VocabularySet>();
    public DbSet<VocabularyEntry> VocabularyEntries => Set<VocabularyEntry>();
    public DbSet<Card> Cards => Set<Card>();

    public DbSet<ReviewState> ReviewStates => Set<ReviewState>();
    public DbSet<ReviewLog> ReviewLogs => Set<ReviewLog>();
    public DbSet<LearningSession> LearningSessions => Set<LearningSession>();
    public DbSet<SessionItem> SessionItems => Set<SessionItem>();

    public DbSet<GamificationProfile> GamificationProfiles => Set<GamificationProfile>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.ApplyConfigurationsFromAssembly(typeof(WordQuestDbContext).Assembly);

        // Mandantentrennung. Bewusst hier und nicht in handgeschriebenen
        // WHERE-Klauseln: Ein vergessenes Filterkriterium in einer einzelnen
        // Query ist genau das Leck, das Mandantenfaehigkeit wertlos macht
        // (Konzept §1, §15).
        modelBuilder.Entity<Tenant>()
            .HasQueryFilter(e => _tenantContext.IgnoreTenantFilter || e.Id == _tenantContext.TenantId);

        ApplyTenantFilter<User>(modelBuilder);
        ApplyTenantFilter<LearnerProfile>(modelBuilder);
        ApplyTenantFilter<RefreshToken>(modelBuilder);
        ApplyTenantFilter<VocabularySet>(modelBuilder);
        ApplyTenantFilter<VocabularyEntry>(modelBuilder);
        ApplyTenantFilter<Card>(modelBuilder);
        ApplyTenantFilter<ReviewState>(modelBuilder);
        ApplyTenantFilter<ReviewLog>(modelBuilder);
        ApplyTenantFilter<LearningSession>(modelBuilder);
        ApplyTenantFilter<SessionItem>(modelBuilder);
        ApplyTenantFilter<GamificationProfile>(modelBuilder);

        ApplySnakeCaseNames(modelBuilder);
    }

    /// <summary>
    /// PostgreSQL faltet unquotierte Bezeichner auf Kleinschreibung. Ohne
    /// diese Umbenennung heisst jede Spalte "TenantId" und muss in jedem
    /// handgeschriebenen SQL gequotet werden — das faellt frueher oder
    /// spaeter jemandem auf die Fuesse.
    /// </summary>
    private static void ApplySnakeCaseNames(ModelBuilder modelBuilder)
    {
        foreach (var entity in modelBuilder.Model.GetEntityTypes())
        {
            foreach (var property in entity.GetProperties())
            {
                property.SetColumnName(ToSnakeCase(property.GetColumnName()));
            }

            foreach (var key in entity.GetKeys())
            {
                key.SetName(ToSnakeCase(key.GetName()));
            }

            foreach (var foreignKey in entity.GetForeignKeys())
            {
                foreignKey.SetConstraintName(ToSnakeCase(foreignKey.GetConstraintName()));
            }

            foreach (var index in entity.GetIndexes())
            {
                index.SetDatabaseName(ToSnakeCase(index.GetDatabaseName()));
            }
        }
    }

    private static string? ToSnakeCase(string? name)
    {
        if (string.IsNullOrEmpty(name))
        {
            return name;
        }

        var sb = new System.Text.StringBuilder(name.Length + 8);

        for (int i = 0; i < name.Length; i++)
        {
            char c = name[i];

            if (char.IsUpper(c))
            {
                bool previousIsLower = i > 0 && char.IsLower(name[i - 1]);
                bool nextIsLower = i + 1 < name.Length && char.IsLower(name[i + 1]);

                if (i > 0 && name[i - 1] != '_' && (previousIsLower || nextIsLower))
                {
                    sb.Append('_');
                }

                sb.Append(char.ToLowerInvariant(c));
            }
            else
            {
                sb.Append(c);
            }
        }

        return sb.ToString();
    }

    private void ApplyTenantFilter<TEntity>(ModelBuilder modelBuilder)
        where TEntity : class, ITenantOwned
    {
        modelBuilder.Entity<TEntity>()
            .HasQueryFilter(e => _tenantContext.IgnoreTenantFilter || e.TenantId == _tenantContext.TenantId);
    }

    /// <summary>
    /// Setzt die Mandanten-Id auf neuen Entitaeten automatisch, damit sie an
    /// keiner Aufrufstelle vergessen werden kann.
    /// </summary>
    public override int SaveChanges(bool acceptAllChangesOnSuccess)
    {
        StampTenant();
        return base.SaveChanges(acceptAllChangesOnSuccess);
    }

    public override Task<int> SaveChangesAsync(
        bool acceptAllChangesOnSuccess, CancellationToken cancellationToken = default)
    {
        StampTenant();
        return base.SaveChangesAsync(acceptAllChangesOnSuccess, cancellationToken);
    }

    private void StampTenant()
    {
        if (_tenantContext.TenantId == Guid.Empty)
        {
            return;
        }

        foreach (var entry in ChangeTracker.Entries<ITenantOwned>())
        {
            if (entry.State == EntityState.Added && entry.Entity.TenantId == Guid.Empty)
            {
                entry.Entity.TenantId = _tenantContext.TenantId;
            }
        }
    }
}
