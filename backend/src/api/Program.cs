using Data;
using Microsoft.EntityFrameworkCore;
using Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

// Dev CORS so your frontend can call the backend
builder.Services.AddCors(opt =>
{
    opt.AddDefaultPolicy(p =>
        p.AllowAnyOrigin().AllowAnyHeader().AllowAnyMethod());
});

// SQLite + EF Core
builder.Services.AddDbContext<AppDbContext>(opt =>
    opt.UseSqlite("Data Source=jobs.db"));

// HttpClient + services
builder.Services.AddHttpClient<GreenhouseClient>();
builder.Services.AddScoped<GreenhouseIngestService>();
builder.Services.AddHttpClient<NominatimClient>();
builder.Services.AddHttpClient("Adzuna");


builder.Services.AddScoped(sp =>
{
    var cfg = sp.GetRequiredService<IConfiguration>();
    var appId = cfg["Adzuna:AppId"] ?? throw new InvalidOperationException("Missing Adzuna:AppId");
    var appKey = cfg["Adzuna:AppKey"] ?? throw new InvalidOperationException("Missing Adzuna:AppKey");

    var httpFactory = sp.GetRequiredService<IHttpClientFactory>();
    var http = httpFactory.CreateClient("Adzuna");

    return new AdzunaClient(http, appId, appKey);
});


var app = builder.Build();

app.UseCors();

app.UseSwagger();
app.UseSwaggerUI();

// Create DB automatically for MVP (no migrations needed yet)
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();
    db.Database.EnsureCreated();
}

app.MapGet("/health", () => Results.Ok(new { ok = true }));

app.MapPost("/api/ingest/greenhouse", async (string board, GreenhouseIngestService ingest, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(board)) return Results.BadRequest(new { error = "board is required" });

    var (fetched, inserted, updated) = await ingest.IngestAsync(board, ct);
    return Results.Ok(new { board, fetched, inserted, updated });
});

app.MapGet("/api/jobs", async (AppDbContext db, CancellationToken ct) =>
{
    var jobs = await db.Jobs
        .OrderByDescending(j => j.PostedAtUtc)
        .Take(200)
        .Select(j => new {
            j.Id, j.Title, j.Company, j.LocationText, j.Url, j.Source, j.PostedAtUtc, j.Lat, j.Lon
        })
        .ToListAsync(ct);

    return Results.Ok(jobs);
});

app.MapGet("/api/jobs/search", async (
    string? what,
    string? where,
    double homeLat,
    double homeLon,
    double? radiusKm,
    int? days,
    int? page,
    int? resultsPerPage,
    AdzunaClient adzuna,
    NominatimClient nominatim,
    CancellationToken ct) =>
{
    
    // Defaults
    var cutoff = DateTime.UtcNow.AddDays(-(days ?? 90));
    var radius = radiusKm ?? 3.0; // safe default if frontend doesn't send it
    var perPage = Math.Clamp(resultsPerPage ?? 50, 1, 50);
    var pageNum = page ?? 1;

    // Decide where to search (optional query param, otherwise reverse geocode from home)
    string effectiveWhere = where?.Trim() ?? "";

    if (string.IsNullOrWhiteSpace(effectiveWhere))
    {
        var rev = await nominatim.ReverseAsync(homeLat, homeLon, ct);
        var addr = rev?.Address;

        var place =
            addr?.City ??
            addr?.Town ??
            addr?.Village ??
            addr?.Hamlet ??
            "";

        var state = addr?.State ?? "";

        effectiveWhere = string.IsNullOrWhiteSpace(place) ? state : $"{place}, {state}";

        if (string.IsNullOrWhiteSpace(effectiveWhere))
            effectiveWhere = "United States"; // fallback
    }

    // Decide keyword behavior
    var trimmedWhat = what?.Trim() ?? "";

    // "Browse-mode" queries for when the keyword is left empty
    string[] browseQueries =
    {
        "cashier",
        "retail associate",
        "sales associate",
        "customer service",
        "crew member",
        "fast food",
        "dishwasher",
        "line cook",
        "server",
        "stocker",
        "warehouse associate",
        "package handler",
        "delivery driver",
        "janitor",
        "housekeeper"
    };

    var queriesToRun = string.IsNullOrWhiteSpace(trimmedWhat)
        ? browseQueries
        : new[] { trimmedWhat };

    // 3) Fetch + merge results
    var all = new List<AdzunaClient.JobResult>();

    foreach (var q in queriesToRun)
    {
        var resp = await adzuna.SearchAsync(
            country: "us",
            page: pageNum,
            what: q,
            where: effectiveWhere,
            resultsPerPage: perPage,
            ct: ct);

        all.AddRange(resp.Results);
    }

    // Deduplicate (by Id, fallback to URL)
    var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
    var deduped = new List<AdzunaClient.JobResult>();

    foreach (var r in all)
    {
        var key = !string.IsNullOrWhiteSpace(r.Id) ? $"id:{r.Id}" : $"url:{r.RedirectUrl}";
        if (seen.Add(key))
            deduped.Add(r);
    }

    // Filter by date, coords, and radius
    var filtered = deduped
        .Where(r => r.Created == null || r.Created.Value.ToUniversalTime() >= cutoff)
        .Where(r => r.Latitude.HasValue && r.Longitude.HasValue)
        .Select(r => new
        {
            r,
            distKm = HaversineKm(homeLat, homeLon, r.Latitude!.Value, r.Longitude!.Value)
        })
        .Where(x => x.distKm <= radius)
        .OrderBy(x => x.distKm)
        .ToList();

// Shape response
    var jobs = filtered.Select(x => new
    {
        id = x.r.Id,
        title = x.r.Title,
        company = x.r.Company?.DisplayName ?? "",
        locationText = x.r.Location?.DisplayName ?? effectiveWhere,
        url = x.r.RedirectUrl,
        source = "adzuna",
        postedAtUtc = x.r.Created?.ToUniversalTime().ToString("O"),
        lat = x.r.Latitude,
        lon = x.r.Longitude,
        salaryMin = x.r.SalaryMin,
        salaryMax = x.r.SalaryMax,
        salaryIsPredicted = (x.r.SalaryIsPredicted ?? 0) != 0,
        distanceKm = Math.Round(x.distKm, 2)
    });

    return Results.Ok(jobs);
});

static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
{
    const double R = 6371.0; // km
    double dLat = DegreesToRadians(lat2 - lat1);
    double dLon = DegreesToRadians(lon2 - lon1);

    double a =
        Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
        Math.Cos(DegreesToRadians(lat1)) * Math.Cos(DegreesToRadians(lat2)) *
        Math.Sin(dLon / 2) * Math.Sin(dLon / 2);

    double c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
    return R * c;
}

static double DegreesToRadians(double deg) => deg * (Math.PI / 180.0);


// Forward geocoding
app.MapGet("/api/geocode", async (string text, NominatimClient nominatim, CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(text))
        return Results.BadRequest(new { error = "text is required" });

    var r = await nominatim.SearchOneAsync(text, ct);
    if (r == null)
        return Results.NotFound(new { error = "no results" });

    if (!double.TryParse(r.Lat, out var lat) || !double.TryParse(r.Lon, out var lon))
        return Results.Problem("Invalid geocode response");

    return Results.Ok(new { lat, lon, displayName = r.DisplayName });
});

// Reverse geocoding
app.MapGet("/api/reversegeocode", async (double lat, double lon, NominatimClient nominatim, CancellationToken ct) =>
{
    var r = await nominatim.ReverseAsync(lat, lon, ct);
    if (r?.Address == null)
        return Results.NotFound(new { error = "no results" });

    var place =
        r.Address.City ??
        r.Address.Town ??
        r.Address.Village ??
        r.Address.Hamlet ??
        "";

    var state = r.Address.State ?? "";
    var where = string.IsNullOrWhiteSpace(place) ? state : $"{place}, {state}";

    return Results.Ok(new
    {
        where,
        displayName = r.DisplayName,
        countryCode = r.Address.CountryCode
    });
});


app.Run();