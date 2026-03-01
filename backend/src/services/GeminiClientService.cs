using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Configuration;

namespace Services;

public class GeminiClient
{
    private readonly HttpClient _http;
    private readonly string _apiKey;
    private readonly string _model;

    public GeminiClient(HttpClient http, IConfiguration cfg)
    {
        _http = http;
        _apiKey = cfg["GEMINI_API_KEY"] ?? cfg["Gemini:ApiKey"]
            ?? throw new InvalidOperationException("Missing GEMINI_API_KEY (or Gemini:ApiKey)");

        _model = cfg["Gemini:Model"] ?? "gemini-3-flash-preview";
    }

    public async Task<string> GenerateTextAsync(string prompt, CancellationToken ct)
    {
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{_model}:generateContent";

        var payload = new
        {
            contents = new[]
            {
                new {
                    parts = new[] { new { text = prompt } }
                }
            },
            generationConfig = new
            {
                temperature = 0.2,
                maxOutputTokens = 2048 
            }
        };

        using var req = new HttpRequestMessage(HttpMethod.Post, url);
        req.Headers.Add("x-goog-api-key", _apiKey);
        req.Content = JsonContent.Create(payload);

        using var res = await _http.SendAsync(req, ct);
        var json = await res.Content.ReadAsStringAsync(ct);

        if (!res.IsSuccessStatusCode)
            throw new InvalidOperationException($"Gemini error {(int)res.StatusCode}: {json}");

        using var doc = JsonDocument.Parse(json);

        // candidates[0].content.parts[0].text
        var root = doc.RootElement;

        if (!root.TryGetProperty("candidates", out var candidates) || candidates.GetArrayLength() == 0)
            return "No response from Gemini.";

        var text =
            candidates[0]
            .GetProperty("content")
            .GetProperty("parts")[0]
            .GetProperty("text")
            .GetString();

        return string.IsNullOrWhiteSpace(text) ? "No response text from Gemini." : text;
    }
}