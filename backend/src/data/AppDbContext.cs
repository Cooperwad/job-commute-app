using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<Job> Jobs => Set<Job>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Prevent duplicate jobs per source + board + job id
        modelBuilder.Entity<Job>()
            .HasIndex(j => new { j.Source, j.BoardToken, j.SourceJobId })
            .IsUnique();
    }
}