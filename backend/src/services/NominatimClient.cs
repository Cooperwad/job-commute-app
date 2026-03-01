using System.Net.Http.Json;
using System.Text.Json.Serialization;

namespace Services;

public class NominatimClient
{
    private readonly HttpClient _http;

    public NominatimClient(HttpClient http)
    {
        _http = http;
        _http.BaseAddress = new Uri("https://nominatim.openstreetmap.org/");
        // Important: Nominatim expects a User-Agent.
        _http.DefaultRequestHeaders.UserAgent.ParseAdd("job-commute-app/1.0 (hackathon)");
    }

    // Forward geocoding, turning a string of "City, State" into latitude and longitude.
    public async Task<SearchResult?> SearchOneAsync(string text, CancellationToken ct)
    {
        var url = $"search?q={Uri.EscapeDataString(text)}&format=json&limit=1&addressdetails=0";
        var results = await _http.GetFromJsonAsync<List<SearchResult>>(url, ct);
        return results is { Count: > 0 } ? results[0] : null;
    }

    // Reverse geocoding, turning latitude and longitude from OpenStreetMap into a string of "City, State" for Adzuna to parse.
    public async Task<ReverseResult?> ReverseAsync(double lat, double lon, CancellationToken ct)
    {
        var url = $"reverse?lat={lat}&lon={lon}&format=jsonv2&addressdetails=1&zoom=10";
        return await _http.GetFromJsonAsync<ReverseResult>(url, ct);
    }

    public sealed class SearchResult
    {
        [JsonPropertyName("lat")] public string Lat { get; set; } = "";
        [JsonPropertyName("lon")] public string Lon { get; set; } = "";
        [JsonPropertyName("display_name")] public string DisplayName { get; set; } = "";
    }

    public sealed class ReverseResult
    {
        [JsonPropertyName("display_name")] public string DisplayName { get; set; } = "";
        [JsonPropertyName("address")] public AddressObj? Address { get; set; }
    }

    public sealed class AddressObj
    {
        [JsonPropertyName("city")] public string? City { get; set; }
        [JsonPropertyName("town")] public string? Town { get; set; }
        [JsonPropertyName("village")] public string? Village { get; set; }
        [JsonPropertyName("hamlet")] public string? Hamlet { get; set; }
        [JsonPropertyName("state")] public string? State { get; set; }
        [JsonPropertyName("postcode")] public string? Postcode { get; set; }
        [JsonPropertyName("country_code")] public string? CountryCode { get; set; }
    }
}