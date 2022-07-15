import { DocumentIR, BlockNode } from "@covenant/document-ir";
import {
  CandidateProfile,
  ContactInfo,
  ExperienceRole,
  EducationEntry,
  ExtractedSkill,
} from "./types";
import { SkillOntology } from "./skill_ontology";
import crypto from "crypto";

interface SectionRange {
  name: "contact" | "summary" | "experience" | "education" | "skills" | "projects" | "certifications" | "other";
  startBlockIdx: number;
  endBlockIdx: number;
}

export class CandidateProfileExtractor {
  private ontology = new SkillOntology();

  private static MONTH_NAMES: Record<string, number> = {
    jan: 1, january: 1, "01": 1,
    feb: 2, february: 2, "02": 2,
    mar: 3, march: 3, "03": 3,
    apr: 4, april: 4, "04": 4,
    may: 5, "05": 5,
    jun: 6, june: 6, "06": 6,
    jul: 7, july: 7, "07": 7,
    aug: 8, august: 8, "08": 8,
    sep: 9, september: 9, "09": 9,
    oct: 10, october: 10, "10": 10,
    nov: 11, november: 11, "11": 11,
    dec: 12, december: 12, "12": 12,
  };

  extractProfile(doc: DocumentIR): CandidateProfile {
    const allBlocks = doc.pages.flatMap((p) => p.blocks);
    const sections = this.detectSections(allBlocks);

    // 1. Contact Info
    const contact = this.extractContact(allBlocks, sections);

    // 2. Summary
    const summaryText = this.extractSummary(allBlocks, sections);

    // 3. Work Experience & Roles
    const roles = this.extractRoles(allBlocks, sections, doc);

    // 4. Calculate Deduplicated Total Experience Months and Years
    const { totalMonths, totalYears } = this.calculateNonOverlappingExperience(roles);

    // 5. Education
    const education = this.extractEducation(allBlocks, sections);

    // 6. Skills (Explicit from skills section + Inferred from roles)
    const skills = this.extractSkills(allBlocks, sections, roles);

    // 7. Certifications
    const certifications = this.extractCertifications(allBlocks, sections);

    return {
      id: `prof-${crypto.randomUUID()}`,
      contact,
      summaryText,
      roles,
      totalExperienceMonths: totalMonths,
      totalExperienceYears: totalYears,
      education,
      skills,
      certifications,
    };
  }

  private detectSections(blocks: BlockNode[]): SectionRange[] {
    const ranges: SectionRange[] = [];
    let currentSection: SectionRange = { name: "contact", startBlockIdx: 0, endBlockIdx: 0 };

    for (let i = 0; i < blocks.length; i++) {
      const text = blocks[i].text.trim().toLowerCase();
      const isHeader = blocks[i].type === "heading" || (text.length < 40 && text === text.toUpperCase() && text.length > 3);

      if (isHeader) {
        let detectedName: SectionRange["name"] | null = null;
        if (text.includes("experience") || text.includes("employment") || text.includes("work history")) {
          detectedName = "experience";
        } else if (text.includes("education") || text.includes("academic")) {
          detectedName = "education";
        } else if (text.includes("skill") || text.includes("technologies") || text.includes("competencies")) {
          detectedName = "skills";
        } else if (text.includes("summary") || text.includes("profile") || text.includes("objective")) {
          detectedName = "summary";
        } else if (text.includes("project")) {
          detectedName = "projects";
        } else if (text.includes("certification") || text.includes("licenses")) {
          detectedName = "certifications";
        }

        if (detectedName) {
          currentSection.endBlockIdx = i - 1;
          ranges.push(currentSection);
          currentSection = { name: detectedName, startBlockIdx: i, endBlockIdx: i };
        }
      }
    }

    currentSection.endBlockIdx = blocks.length - 1;
    ranges.push(currentSection);
    return ranges;
  }

  private extractContact(blocks: BlockNode[], sections: SectionRange[]): ContactInfo {
    const contact: ContactInfo = {};
    const topBlocks = blocks.slice(0, Math.min(8, blocks.length));
    const headerText = topBlocks.map((b) => b.text).join("\n");

    // Candidate Name: Typically the first line or block with 2-4 words, capitalized
    for (const b of topBlocks) {
      const trimmed = b.text.trim();
      const lines = trimmed.split("\n");
      const firstLine = lines[0].trim();
      if (
        firstLine.length > 2 &&
        firstLine.length < 40 &&
        !firstLine.includes("@") &&
        !firstLine.includes("http") &&
        !firstLine.match(/\d{3}/)
      ) {
        contact.name = firstLine;
        break;
      }
    }

    // Email
    const emailMatch = headerText.match(/\b([A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,})\b/);
    if (emailMatch) contact.email = emailMatch[1];

    // Phone
    const phoneMatch = headerText.match(/(?:\+?1[-.\s]?)?\(?([0-9]{3})\)?[-.\s]?([0-9]{3})[-.\s]?([0-9]{4})/);
    if (phoneMatch) contact.phone = phoneMatch[0].trim();

    // LinkedIn
    const linkedinMatch = headerText.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/in\/([A-Za-z0-9_-]+)/i);
    if (linkedinMatch) contact.linkedin = linkedinMatch[0];

    // GitHub
    const githubMatch = headerText.match(/(?:https?:\/\/)?(?:www\.)?github\.com\/([A-Za-z0-9_-]+)/i);
    if (githubMatch) contact.github = githubMatch[0];

    // Location: City, State or City, Country
    const locMatch = headerText.match(/\b([A-Z][a-zA-Z\s]+,\s*(?:[A-Z]{2}|[A-Z][a-zA-Z]+))\b/);
    if (locMatch && !locMatch[1].toLowerCase().includes("university") && !locMatch[1].toLowerCase().includes("college")) {
      contact.location = locMatch[1].trim();
    }

    return contact;
  }

  private extractSummary(blocks: BlockNode[], sections: SectionRange[]): string | undefined {
    const sumSec = sections.find((s) => s.name === "summary");
    if (!sumSec) return undefined;

    const summaryBlocks = blocks.slice(sumSec.startBlockIdx + 1, sumSec.endBlockIdx + 1);
    return summaryBlocks.map((b) => b.text).join("\n\n").trim();
  }

  private extractRoles(blocks: BlockNode[], sections: SectionRange[], doc: DocumentIR): ExperienceRole[] {
    const roles: ExperienceRole[] = [];
    const expSec = sections.find((s) => s.name === "experience");
    if (!expSec) return roles;

    const expBlocks = blocks.slice(expSec.startBlockIdx + 1, expSec.endBlockIdx + 1);
    let currentRole: ExperienceRole | null = null;

    const datePattern = /(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{1,2}\/)?\s*(\d{4}))\s*[-to\s\u2013\u2014]+\s*(present|current|now|(?:(jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|jun(?:e)?|jul(?:y)?|aug(?:ust)?|sep(?:tember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?|\d{1,2}\/)?\s*(\d{4})))/i;

    for (const block of expBlocks) {
      const text = block.text.trim();
      const dateMatch = text.match(datePattern);

      // Check if this block defines a new role header
      if (dateMatch && (block.type === "heading" || text.length < 160 || !text.startsWith("•") && !text.startsWith("-"))) {
        if (currentRole) {
          roles.push(currentRole);
        }

        const dateStr = dateMatch[0];
        const { startMonthYear, endMonthYear, isCurrent } = this.parseDateSpan(dateMatch);

        // Parse title and company from the rest of the text
        const nonDatePart = text.replace(dateMatch[0], "").trim().replace(/[|•·,\u2013\u2014-]+$/, "").trim();
        const { title, company } = this.splitTitleCompany(nonDatePart);

        currentRole = {
          id: `role-${crypto.randomUUID()}`,
          company: company || "Company",
          title: title || "Engineer",
          startDateText: dateMatch[1] ? `${dateMatch[1]} ${dateMatch[2]}` : dateMatch[2],
          endDateText: isCurrent ? "Present" : (dateMatch[4] ? `${dateMatch[4]} ${dateMatch[5]}` : dateMatch[5] || "Present"),
          startMonthYear,
          endMonthYear,
          isCurrent,
          bullets: [],
          canonicalStart: block.canonicalStart,
          canonicalEnd: block.canonicalEnd,
          blockId: block.id,
        };
      } else if (currentRole) {
        // Bullet point or continuation
        const bulletLines = this.splitBullets(text);
        let lineOffset = block.canonicalStart;

        for (const line of bulletLines) {
          const startInDoc = doc.canonicalText.indexOf(line, lineOffset);
          const actualStart = startInDoc !== -1 ? startInDoc : lineOffset;
          const actualEnd = actualStart + line.length;
          lineOffset = actualEnd;

          currentRole.bullets.push({
            text: line,
            canonicalStart: actualStart,
            canonicalEnd: actualEnd,
            blockId: block.id,
          });
        }
        currentRole.canonicalEnd = block.canonicalEnd;
      }
    }

    if (currentRole) {
      roles.push(currentRole);
    }

    return roles;
  }

  private calculateNonOverlappingExperience(roles: ExperienceRole[]): { totalMonths: number; totalYears: number } {
    if (roles.length === 0) return { totalMonths: 0, totalYears: 0 };

    const intervals: Array<{ start: number; end: number }> = [];
    const now = new Date();
    const currentEpochMonths = now.getFullYear() * 12 + now.getMonth() + 1;

    for (const r of roles) {
      if (r.startMonthYear) {
        const start = r.startMonthYear.year * 12 + r.startMonthYear.month;
        const end = r.isCurrent || !r.endMonthYear
          ? currentEpochMonths
          : r.endMonthYear.year * 12 + r.endMonthYear.month;

        if (end >= start) {
          intervals.push({ start, end });
        }
      }
    }

    if (intervals.length === 0) {
      // Fallback: estimate from role count
      return { totalMonths: roles.length * 12, totalYears: roles.length };
    }

    // Sort intervals by start ascending
    intervals.sort((a, b) => a.start - b.start);

    // Merge overlapping intervals
    const merged: Array<{ start: number; end: number }> = [intervals[0]];

    for (let i = 1; i < intervals.length; i++) {
      const prev = merged[merged.length - 1];
      const curr = intervals[i];

      if (curr.start <= prev.end) {
        // Overlap: extend previous end
        prev.end = Math.max(prev.end, curr.end);
      } else {
        merged.push(curr);
      }
    }

    // Sum non-overlapping months (inclusive)
    let totalMonths = 0;
    for (const intv of merged) {
      totalMonths += Math.max(1, intv.end - intv.start + 1);
    }

    const totalYears = Math.round((totalMonths / 12) * 10) / 10;
    return { totalMonths, totalYears };
  }

  private extractEducation(blocks: BlockNode[], sections: SectionRange[]): EducationEntry[] {
    const eduList: EducationEntry[] = [];
    const eduSec = sections.find((s) => s.name === "education");
    if (!eduSec) return eduList;

    const eduBlocks = blocks.slice(eduSec.startBlockIdx + 1, eduSec.endBlockIdx + 1);

    for (const block of eduBlocks) {
      const text = block.text.trim();
      const degMatch = text.match(/(?:Bachelor|Master|Doctor|Ph\.D\.|B\.S\.|M\.S\.|B\.A\.|M\.A\.|BS|MS|PhD|Associate)[^,\n]*/i);
      const yearMatch = text.match(/\b(19\d{2}|20\d{2})\b/);
      const univMatch = text.match(/(?:[A-Z][a-zA-Z\s]+(?:University|College|Institute|Polytechnic|School)[^,\n]*)/i);

      if (degMatch || univMatch) {
        eduList.push({
          id: `edu-${crypto.randomUUID()}`,
          institution: univMatch ? univMatch[0].trim() : text.split("\n")[0].trim(),
          degree: degMatch ? degMatch[0].trim() : undefined,
          graduationYear: yearMatch ? parseInt(yearMatch[1], 10) : undefined,
          canonicalStart: block.canonicalStart,
          canonicalEnd: block.canonicalEnd,
          blockId: block.id,
        });
      }
    }

    return eduList;
  }

  private extractSkills(blocks: BlockNode[], sections: SectionRange[], roles: ExperienceRole[]): ExtractedSkill[] {
    const skills: ExtractedSkill[] = [];
    const seen = new Set<string>();

    // 1. Explicit skills from Skills section
    const skillSec = sections.find((s) => s.name === "skills");
    if (skillSec) {
      const skillBlocks = blocks.slice(skillSec.startBlockIdx + 1, skillSec.endBlockIdx + 1);
      for (const block of skillBlocks) {
        const found = this.ontology.findSkillsInText(block.text);
        for (const f of found) {
          if (!seen.has(f.canonicalName)) {
            seen.add(f.canonicalName);
            skills.push({
              name: f.canonicalName,
              normalizedName: f.canonicalName.toLowerCase(),
              category: f.category,
              source: "explicit",
              evidenceText: block.text.trim(),
              canonicalStart: block.canonicalStart,
              canonicalEnd: block.canonicalEnd,
              blockId: block.id,
            });
          }
        }
      }
    }

    // 2. Inferred skills from work experience bullets
    for (const role of roles) {
      for (const bullet of role.bullets) {
        const found = this.ontology.findSkillsInText(bullet.text);
        for (const f of found) {
          if (!seen.has(f.canonicalName)) {
            seen.add(f.canonicalName);
            skills.push({
              name: f.canonicalName,
              normalizedName: f.canonicalName.toLowerCase(),
              category: f.category,
              source: "inferred",
              evidenceText: bullet.text,
              canonicalStart: bullet.canonicalStart,
              canonicalEnd: bullet.canonicalEnd,
              blockId: bullet.blockId,
            });
          }
        }
      }
    }

    return skills;
  }

  private extractCertifications(blocks: BlockNode[], sections: SectionRange[]): string[] {
    const certs: string[] = [];
    const certSec = sections.find((s) => s.name === "certifications");
    if (!certSec) return certs;

    const certBlocks = blocks.slice(certSec.startBlockIdx + 1, certSec.endBlockIdx + 1);
    for (const b of certBlocks) {
      const lines = b.text.split("\n");
      for (const line of lines) {
        const trimmed = line.replace(/^[•\-*\s]+/, "").trim();
        if (trimmed.length > 3) certs.push(trimmed);
      }
    }
    return certs;
  }

  private splitBullets(text: string): string[] {
    const rawLines = text.split("\n");
    const bullets: string[] = [];

    for (const line of rawLines) {
      const trimmed = line.replace(/^[•\-*\d\.\)\s]+/, "").trim();
      if (trimmed.length > 5) {
        bullets.push(trimmed);
      }
    }

    return bullets.length > 0 ? bullets : [text];
  }

  private splitTitleCompany(text: string): { title?: string; company?: string } {
    const parts = text.split(/\s*[-|•·@,\u2013\u2014]\s*/);
    if (parts.length >= 2) {
      return {
        title: parts[0].trim(),
        company: parts[1].trim(),
      };
    }
    return { title: text.trim(), company: undefined };
  }

  private parseDateSpan(match: RegExpMatchArray): {
    startMonthYear?: { year: number; month: number };
    endMonthYear?: { year: number; month: number };
    isCurrent: boolean;
  } {
    const startMonthStr = (match[1] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
    const startYear = parseInt(match[2], 10);
    const startMonth = CandidateProfileExtractor.MONTH_NAMES[startMonthStr] || 1;

    const endPart = match[3].toLowerCase();
    const isCurrent = endPart.includes("present") || endPart.includes("current") || endPart.includes("now");

    let endMonthYear: { year: number; month: number } | undefined = undefined;
    if (!isCurrent) {
      const endMonthStr = (match[4] || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const endYear = parseInt(match[5], 10);
      const endMonth = CandidateProfileExtractor.MONTH_NAMES[endMonthStr] || 12;
      if (!isNaN(endYear)) {
        endMonthYear = { year: endYear, month: endMonth };
      }
    }

    return {
      startMonthYear: isNaN(startYear) ? undefined : { year: startYear, month: startMonth },
      endMonthYear,
      isCurrent,
    };
  }
}
