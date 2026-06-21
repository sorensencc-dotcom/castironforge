import { Router } from "express";
import { IntegrityChecker } from "../corpus/introspection/IntegrityChecker";
import { DriftDetector } from "../corpus/introspection/DriftDetector";
import { CorpusSummaryBuilder } from "../corpus/introspection/CorpusSummary";
import { RecommendationsEngine } from "../corpus/introspection/RecommendationsEngine";

export const corpusRouter = Router();

const integrityChecker = new IntegrityChecker();
const driftDetector = new DriftDetector();
const summaryBuilder = new CorpusSummaryBuilder();
const recommendationsEngine = new RecommendationsEngine();

corpusRouter.get("/corpus/summary", async (_req, res) => {
  try {
    const summary = await summaryBuilder.run();
    res.json(summary);
  } catch (error) {
    console.error("Failed to get corpus summary:", error);
    res.status(500).json({ error: "Failed to get corpus summary" });
  }
});

corpusRouter.get("/corpus/integrity", async (_req, res) => {
  try {
    const issues = await integrityChecker.run();
    res.json({
      issues,
      count: issues.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to check corpus integrity:", error);
    res.status(500).json({ error: "Failed to check corpus integrity" });
  }
});

corpusRouter.get("/corpus/drift", async (_req, res) => {
  try {
    const issues = await driftDetector.run();
    res.json({
      issues,
      count: issues.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to detect corpus drift:", error);
    res.status(500).json({ error: "Failed to detect corpus drift" });
  }
});

corpusRouter.get("/corpus/recommendations", async (_req, res) => {
  try {
    const recommendations = await recommendationsEngine.run();
    const byPriority = {
      HIGH: recommendations.filter(r => r.priority === "HIGH"),
      MEDIUM: recommendations.filter(r => r.priority === "MEDIUM"),
      LOW: recommendations.filter(r => r.priority === "LOW")
    };
    res.json({
      recommendations,
      byPriority,
      count: recommendations.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to generate recommendations:", error);
    res.status(500).json({ error: "Failed to generate recommendations" });
  }
});

corpusRouter.get("/corpus/health", async (_req, res) => {
  try {
    const summary = await summaryBuilder.run();
    const integrityIssues = await integrityChecker.run();
    const driftIssues = await driftDetector.run();

    const health = {
      summary,
      integrityIssues: integrityIssues.length,
      driftIssues: driftIssues.length,
      status:
        integrityIssues.length === 0 && driftIssues.length === 0 ? "HEALTHY" : "NEEDS_ATTENTION",
      timestamp: new Date().toISOString()
    };

    res.json(health);
  } catch (error) {
    console.error("Failed to get corpus health:", error);
    res.status(500).json({ error: "Failed to get corpus health" });
  }
});
