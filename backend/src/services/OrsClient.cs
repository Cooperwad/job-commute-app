using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace Services;

public sealed class OrsClient
{
    private readonly HttpClient _http;
    private readonly string _apiKey;

    public OrsClient(HttpClient http, IConfiguration cfg)
    {
        _http = http;
        _http.BaseAddress = new Uri("https://api.openrouteservice.org/");
        _apiKey = cfg["ORS_API_KEY"] ?? throw new InvalidOperationException("Missing ORS_API_KEY");
    }

    public sealed class RouteResult
    {
        public double DistanceMeters { get; set; }
        public double DurationSeconds { get; set; }
        // Leaflet wants [lat, lng]
        public List<double[]> CoordinatesLatLng { get; set; } = new();
    }

    public async Task<RouteResult> GetRouteAsync(
        string profile,
        double startLat, double startLon,
        double endLat, double endLon,
        CancellationToken ct)
    {
        // ORS directions GeoJSON endpoint: /v2/directions/{profile}/geojson
        // Key is passed in Authorization header. :contentReference[oaicite:3]{index=3}
        using var req = new HttpRequestMessage(HttpMethod.Post, $"v2/directions/{profile}/geojson");
        req.Headers.TryAddWithoutValidation("Authorization", _apiKey);

        req.Content = JsonContent.Create(new
        {
            coordinates = new[]
            {
                new[] { startLon, startLat }, // ORS expects [lon, lat]
                new[] { endLon, endLat }
            }
        });

        using var res = await _http.SendAsync(req, HttpCompletionOption.ResponseHeadersRead, ct);
        var json = await res.Content.ReadAsStringAsync(ct);

        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"ORS {(int)res.StatusCode}: {json}");

        using var doc = JsonDocument.Parse(json);

        // GeoJSON format has features[0].geometry.coordinates and properties.summary. :contentReference[oaicite:4]{index=4}
        var feature = doc.RootElement.GetProperty("features")[0];
        var coords = feature.GetProperty("geometry").GetProperty("coordinates");
        var summary = feature.GetProperty("properties").GetProperty("summary");

        var outCoords = new List<double[]>(coords.GetArrayLength());
        foreach (var c in coords.EnumerateArray())
        {
            // c = [lon, lat]
            var lon = c[0].GetDouble();
            var lat = c[1].GetDouble();
            outCoords.Add(new[] { lat, lon });
        }

        return new RouteResult
        {
            DistanceMeters = summary.GetProperty("distance").GetDouble(),
            DurationSeconds = summary.GetProperty("duration").GetDouble(),
            CoordinatesLatLng = outCoords
        };
    }
}