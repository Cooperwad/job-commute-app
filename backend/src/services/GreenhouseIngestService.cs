using Data;
using Data.Entities;
using Microsoft.EntityFrameworkCore;

namespace Services;

public class GreenhouseIngestService
{
    private readonly GreenhouseClient _client;
    private readonly AppDbContext _db;

    public GreenhouseIngestService(GreenhouseClient client, AppDbContext db)
    {
        _client = client;
        _db = db;
    }

    public async Task<(int fetched, int inserted, int updated)> IngestAsync(string boardToken, CancellationToken ct)
    {
        var resp = await _client.ListJobsAsync(boardToken, ct);
        var fetched = resp.Jobs.Count;

        int inserted = 0, updated = 0;

        foreach (var j in resp.Jobs)
        {
            var existing = await _db.Jobs
                .FirstOrDefaultAsync(x => x.Source == "greenhouse" && x.BoardToken == boardToken && x.SourceJobId == j.Id, ct);

            var snippet = MakeSnippet(j.Content);

            DateTime? postedAtUtc = null;
            if (DateTimeOffset.TryParse(j.Updated_At, out var parsed))
                postedAtUtc = parsed.UtcDateTime;

            if (existing == null)
            {
                _db.Jobs.Add(new Job
                {
                    Source = "greenhouse",
                    BoardToken = boardToken,
                    SourceJobId = j.Id,
                    Title = j.Title,
                    Company = boardToken,             // MVP: use token; later you can fetch board name
                    LocationText = j.Location?.Name ?? "",
                    Url = j.Absolute_Url,
                    DescriptionSnippet = snippet,
                    PostedAtUtc = postedAtUtc,
                    CreatedAt = DateTimeOffset.UtcNow,
                    UpdatedAt = DateTimeOffset.UtcNow
                });
                inserted++;
            }
            else
            {
                existing.Title = j.Title;
                existing.LocationText = j.Location?.Name ?? existing.LocationText;
                existing.Url = j.Absolute_Url;
                existing.DescriptionSnippet = snippet ?? existing.DescriptionSnippet;
                existing.PostedAtUtc = postedAtUtc ?? existing.PostedAtUtc;
                existing.UpdatedAt = DateTimeOffset.UtcNow;
                updated++;
            }
        }

        await _db.SaveChangesAsync(ct);
        return (fetched, inserted, updated);
    }

    private static string? MakeSnippet(string? html)
    {
        if (string.IsNullOrWhiteSpace(html)) return null;

        var s = System.Net.WebUtility.HtmlDecode(html);

        // naive tag strip, good enough for MVP
        s = System.Text.RegularExpressions.Regex.Replace(s, "<.*?>", " ");
        s = System.Text.RegularExpressions.Regex.Replace(s, "\\s+", " ").Trim();

        if (s.Length > 240) s = s[..240] + "...";
        return s;
    }
}