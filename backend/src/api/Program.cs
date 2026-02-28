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
    string what,
    string where,
    int? page,
    int? resultsPerPage,
    AdzunaClient adzuna,
    CancellationToken ct) =>
{
    if (string.IsNullOrWhiteSpace(what))
        return Results.BadRequest(new { error = "what is required" });

    if (string.IsNullOrWhiteSpace(where))
        return Results.BadRequest(new { error = "where is required" });

    var resp = await adzuna.SearchAsync(
        country: "us",
        page: page ?? 1,
        what: what,
        where: where,
        resultsPerPage: Math.Clamp(resultsPerPage ?? 25, 1, 50),
        ct: ct);

    var jobs = resp.Results.Select(r => new
    {
        id = r.Id, // string
        title = r.Title,
        company = r.Company?.DisplayName ?? "",
        locationText = r.Location?.DisplayName ?? where,
        url = r.RedirectUrl,
        source = "adzuna",
        postedAtUtc = r.Created?.ToUniversalTime().ToString("O"),
        lat = r.Latitude,
        lon = r.Longitude,
        salaryMin = r.SalaryMin,
        salaryMax = r.SalaryMax,
        salaryIsPredicted = (r.SalaryIsPredicted ?? 0) != 0
    });

    return Results.Ok(jobs);
});

app.Run();