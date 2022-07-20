import { describe, it, expect } from "vitest";
import { analyzeContract, analyzeResume } from "../../server/services/openai";
import fs from "fs";
import path from "path";

describe("Pre-existing baseline defects audit", () => {
  it("defect-1: openai service returns hardcoded contract analysis with text absent from input", async () => {
    const syntheticInput = "This is a simple non-disclosure agreement between Alpha Corp and Beta LLC regarding Project Falcon.";
    const result = await analyzeContract(syntheticInput);
    
    expect(result.clauses.length).toBeGreaterThan(0);
    // The pre-existing implementation returns clauses with quotes completely absent from syntheticInput:
    for (const clause of result.clauses) {
      const isPresent = syntheticInput.includes(clause.clauseText);
      expect(isPresent).toBe(false);
    }
  });

  it("defect-2: openai service returns hardcoded resume analysis with text absent from input", async () => {
    const syntheticResume = "Jane Doe. Bioinformatician specializing in genomic data analysis with Nextflow and Python.";
    const result = await analyzeResume(syntheticResume);

    expect(result.sections.length).toBeGreaterThan(0);
    // The pre-existing implementation returns sections completely absent from syntheticResume:
    for (const section of result.sections) {
      const isPresent = syntheticResume.includes(section.sectionText);
      expect(isPresent).toBe(false);
    }
  });

  it("defect-3: routes.ts delegates to reconstructed API with durable persistence", () => {
    const routesContent = fs.readFileSync(path.resolve(__dirname, "../../server/routes.ts"), "utf-8");
    expect(routesContent).toContain("registerApiRoutes");
  });

  it("defect-4: contract-viewer.tsx reads non-persisted clause properties instead of itemText", () => {
    const viewerContent = fs.readFileSync(path.resolve(__dirname, "../../client/src/components/contract-viewer.tsx"), "utf-8");
    // Demonstrates reading clause.text || clause.content || clause.clauseText instead of itemText
    expect(viewerContent).toContain("clause.text || clause.content || clause.clauseText || JSON.stringify(clause)");
    expect(viewerContent).not.toContain("clause.itemText");
  });

  it("defect-5: profile-settings.tsx uses typed Profile schema to prevent TS2339", () => {
    const profilePage = fs.readFileSync(path.resolve(__dirname, "../../client/src/pages/profile-settings.tsx"), "utf-8");
    // Verify that useQuery is typed with Profile from @shared/schema
    expect(profilePage).toContain("useQuery<Profile>");
    expect(profilePage).toContain('import type { Profile } from "@shared/schema"');
  });
});
