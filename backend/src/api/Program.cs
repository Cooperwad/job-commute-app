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

app.Run();