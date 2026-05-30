import fs from "node:fs";
import path from "node:path";

const TELEMETRY_PATH = "./skillopt/telemetry.log.jsonl";

export class SkillOptTelemetry {
  static record(event) {
    const enriched = {
      timestamp: new Date().toISOString(),
      ...event
    };

    fs.appendFileSync(
      TELEMETRY_PATH,
      JSON.stringify(enriched) + "
",
      "utf8"
    );
  }

  static readAll() {
    if (!fs.existsSync(TELEMETRY_PATH)) return [];
    return fs
      .readFileSync(TELEMETRY_PATH, "utf8")
      .trim()
      .split("
")
      .map(line => JSON.parse(line));
  }
}
