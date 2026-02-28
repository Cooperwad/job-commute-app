using System.Net.Http.Json;

namespace Services;

public class GreenhouseClient
{
    private readonly HttpClient _http;

    public GreenhouseClient(HttpClient http)
    {
        _http = http;
        _http.BaseAddress = new Uri("https://boards-api.greenhouse.io/v1/");
    }

    public async Task<GreenhouseJobsResponse> ListJobsAsync(string boardToken, CancellationToken ct)
    {
        // content=true includes "content" (description) plus offices/departments. :contentReference[oaicite:1]{index=1}
        var url = $"boards/{boardToken}/jobs?content=true";
        var resp = await _http.GetFromJsonAsync<GreenhouseJobsResponse>(url, ct);
        return resp ?? new GreenhouseJobsResponse([]);
    }

    public record GreenhouseJobsResponse(List<GreenhouseJob> Jobs);

    public record GreenhouseJob(
        int Id,
        string Title,
        string Updated_At,
        GreenhouseLocation Location,
        string Absolute_Url,
        string? Content
    );

    public record GreenhouseLocation(string Name);
}