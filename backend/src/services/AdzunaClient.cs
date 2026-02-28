using System.Text.Json.Serialization;
using System.Text.Json;
using System.Globalization;

namespace Services;

public class AdzunaClient
{
    private readonly HttpClient _http;
    private readonly string _appId;
    private readonly string _appKey;

    public AdzunaClient(HttpClient http, string appId, string appKey)
    {
        _http = http;
        _http.BaseAddress = new Uri("https://api.adzuna.com/v1/api/");
        _appId = appId;
        _appKey = appKey;
    }

    public async Task<SearchResponse> SearchAsync(
        string country,
        int page,
        string what,
        string where,
        int resultsPerPage,
        CancellationToken ct)
    {
        var url =
            $"jobs/{country}/search/{page}" +
            $"?app_id={Uri.EscapeDataString(_appId)}" +
            $"&app_key={Uri.EscapeDataString(_appKey)}" +
            $"&results_per_page={resultsPerPage}" +
            $"&what={Uri.EscapeDataString(what)}" +
            $"&where={Uri.EscapeDataString(where)}" +
            $"&content-type=application/json";

        using var res = await _http.GetAsync(url, HttpCompletionOption.ResponseHeadersRead, ct);
        res.EnsureSuccessStatusCode();

        await using var stream = await res.Content.ReadAsStreamAsync(ct);

        var parsed = await JsonSerializer.DeserializeAsync<SearchResponse>(
            stream,
            new JsonSerializerOptions { PropertyNameCaseInsensitive = true },
            ct
        );

        return parsed ?? new SearchResponse();
    }

    public sealed class SearchResponse
    {
        [JsonPropertyName("count")]
        public int? Count { get; set; }

        [JsonPropertyName("results")]
        public List<JobResult> Results { get; set; } = new();
    }

    public sealed class JobResult
    {
        [JsonPropertyName("id")] public string Id { get; set; } = "";
        [JsonPropertyName("title")] public string Title { get; set; } = "";
        [JsonPropertyName("redirect_url")] public string RedirectUrl { get; set; } = "";
        [JsonPropertyName("description")] public string? Description { get; set; }
        [JsonPropertyName("created")] public DateTime? Created { get; set; }

        [JsonPropertyName("latitude")] public double? Latitude { get; set; }
        [JsonPropertyName("longitude")] public double? Longitude { get; set; }

        [JsonPropertyName("salary_min")] public double? SalaryMin { get; set; }
        [JsonPropertyName("salary_max")] public double? SalaryMax { get; set; }
        
        [JsonPropertyName("salary_is_predicted")]
        [JsonConverter(typeof(FlexibleIntNullableConverter))]
        public int? SalaryIsPredicted { get; set; }

        [JsonPropertyName("company")] public CompanyObj? Company { get; set; }
        [JsonPropertyName("location")] public LocationObj? Location { get; set; }
    }

    public sealed class CompanyObj
    {
        [JsonPropertyName("display_name")] public string? DisplayName { get; set; }
    }

    public sealed class LocationObj
    {
        [JsonPropertyName("display_name")] public string? DisplayName { get; set; }
    }

}

sealed class FlexibleIntNullableConverter : JsonConverter<int?>
{
    public override int? Read(ref Utf8JsonReader reader, Type typeToConvert, JsonSerializerOptions options)
    {
        if (reader.TokenType == JsonTokenType.Number)
            return reader.GetInt32();

        if (reader.TokenType == JsonTokenType.String)
        {
            var s = reader.GetString();
            if (string.IsNullOrWhiteSpace(s)) return null;

            if (int.TryParse(s, NumberStyles.Integer, CultureInfo.InvariantCulture, out var v))
                return v;

            if (bool.TryParse(s, out var b))
                return b ? 1 : 0;

            return null;
        }

        if (reader.TokenType == JsonTokenType.Null)
            return null;

        throw new JsonException($"Unexpected token {reader.TokenType} when parsing int?");
    }

    public override void Write(Utf8JsonWriter writer, int? value, JsonSerializerOptions options)
    {
        if (value is null) writer.WriteNullValue();
        else writer.WriteNumberValue(value.Value);
    }
}