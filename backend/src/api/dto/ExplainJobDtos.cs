namespace Api.Dto;

public sealed class ExplainJobsRequest
{
    public JobForAi? Selected { get; set; }
    public JobForAi? ComparedTo { get; set; }
}

public sealed class JobForAi
{
    public string Title { get; set; } = "";
    public string Company { get; set; } = "";

    public double? DistanceKm { get; set; }
    public double? SalaryAnnual { get; set; }
    public double? CommuteCostDaily { get; set; }
    public double? NetDaily { get; set; }
}