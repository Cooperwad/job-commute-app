namespace Api.Dto;

public sealed class AnalyzeBestRequest
{
    public List<JobForAnalysis> Jobs { get; set; } = new();
}

public sealed class JobForAnalysis
{
    public string Id { get; set; } = "";
    public string Title { get; set; } = "";
    public string Company { get; set; } = "";
    public string LocationText { get; set; } = "";

    public double DistanceKm { get; set; }
    public double CommuteCostDaily { get; set; }
    public double? SalaryAnnual { get; set; }
    public double? NetDaily { get; set; }

    public bool SalaryIsPredicted { get; set; }
}

public sealed class AnalyzeBestResponse
{
    public string WinnerId { get; set; } = "";
    public string Explanation { get; set; } = "";
}