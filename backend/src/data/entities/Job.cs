namespace Data.Entities;

public class Job
{
    public int Id { get; set; }                 // DB primary key
    public string Source { get; set; } = "adzuna";
    public string BoardToken { get; set; } = ""; // which greenhouse board
    public int SourceJobId { get; set; }         // greenhouse job id

    public string Title { get; set; } = "";
    public string Company { get; set; } = "";    // for MVP, set to board name or token
    public string LocationText { get; set; } = "";
    public string Url { get; set; } = "";

    public string? DescriptionSnippet { get; set; }
    public DateTime? PostedAtUtc { get; set; }

    public double? Lat { get; set; }
    public double? Lon { get; set; }

    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;
}