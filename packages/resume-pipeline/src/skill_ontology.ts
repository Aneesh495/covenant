export interface SkillDefinition {
  canonicalName: string;
  category: "language" | "framework" | "database" | "cloud" | "tool" | "concept" | "other";
  aliases: string[];
}

export class SkillOntology {
  private static SKILLS: SkillDefinition[] = [
    // Languages
    { canonicalName: "TypeScript", category: "language", aliases: ["typescript", "ts"] },
    { canonicalName: "JavaScript", category: "language", aliases: ["javascript", "js", "es6", "ecmascript"] },
    { canonicalName: "Python", category: "language", aliases: ["python", "py", "python3"] },
    { canonicalName: "Go", category: "language", aliases: ["go", "golang"] },
    { canonicalName: "Rust", category: "language", aliases: ["rust", "rustlang"] },
    { canonicalName: "Java", category: "language", aliases: ["java", "jvm"] },
    { canonicalName: "C++", category: "language", aliases: ["c++", "cpp"] },
    { canonicalName: "C#", category: "language", aliases: ["c#", "csharp", ".net"] },
    { canonicalName: "SQL", category: "language", aliases: ["sql", "ansi sql"] },
    { canonicalName: "Ruby", category: "language", aliases: ["ruby", "rails"] },
    { canonicalName: "Kotlin", category: "language", aliases: ["kotlin"] },
    { canonicalName: "Swift", category: "language", aliases: ["swift"] },

    // Frameworks & Libraries
    { canonicalName: "React", category: "framework", aliases: ["react", "react.js", "reactjs"] },
    { canonicalName: "Next.js", category: "framework", aliases: ["next.js", "nextjs", "next"] },
    { canonicalName: "Node.js", category: "framework", aliases: ["node.js", "nodejs", "node"] },
    { canonicalName: "Express", category: "framework", aliases: ["express", "express.js", "expressjs"] },
    { canonicalName: "Vue.js", category: "framework", aliases: ["vue", "vue.js", "vuejs"] },
    { canonicalName: "Angular", category: "framework", aliases: ["angular", "angularjs"] },
    { canonicalName: "Django", category: "framework", aliases: ["django"] },
    { canonicalName: "FastAPI", category: "framework", aliases: ["fastapi", "fast-api"] },
    { canonicalName: "Flask", category: "framework", aliases: ["flask"] },
    { canonicalName: "Spring Boot", category: "framework", aliases: ["spring boot", "spring", "spring framework"] },
    { canonicalName: "GraphQL", category: "framework", aliases: ["graphql", "apollo"] },
    { canonicalName: "PyTorch", category: "framework", aliases: ["pytorch", "torch"] },
    { canonicalName: "TensorFlow", category: "framework", aliases: ["tensorflow", "tf"] },

    // Databases & Storage
    { canonicalName: "PostgreSQL", category: "database", aliases: ["postgresql", "postgres", "psql", "pgvector"] },
    { canonicalName: "MySQL", category: "database", aliases: ["mysql"] },
    { canonicalName: "MongoDB", category: "database", aliases: ["mongodb", "mongo"] },
    { canonicalName: "Redis", category: "database", aliases: ["redis"] },
    { canonicalName: "Cassandra", category: "database", aliases: ["cassandra"] },
    { canonicalName: "Elasticsearch", category: "database", aliases: ["elasticsearch", "elastic search", "opensearch"] },
    { canonicalName: "Snowflake", category: "database", aliases: ["snowflake"] },
    { canonicalName: "BigQuery", category: "database", aliases: ["bigquery", "google bigquery"] },
    { canonicalName: "DynamoDB", category: "database", aliases: ["dynamodb", "dynamo"] },

    // Cloud & Infrastructure
    { canonicalName: "Amazon Web Services", category: "cloud", aliases: ["aws", "amazon web services", "ec2", "s3", "lambda"] },
    { canonicalName: "Google Cloud Platform", category: "cloud", aliases: ["gcp", "google cloud", "google cloud platform"] },
    { canonicalName: "Microsoft Azure", category: "cloud", aliases: ["azure", "microsoft azure"] },
    { canonicalName: "Kubernetes", category: "cloud", aliases: ["kubernetes", "k8s"] },
    { canonicalName: "Docker", category: "cloud", aliases: ["docker", "containerization", "containers"] },
    { canonicalName: "Terraform", category: "cloud", aliases: ["terraform", "iac"] },
    { canonicalName: "CI/CD", category: "cloud", aliases: ["ci/cd", "continuous integration", "github actions", "gitlab ci", "jenkins"] },

    // Tools & Concepts
    { canonicalName: "Git", category: "tool", aliases: ["git", "github", "gitlab"] },
    { canonicalName: "Linux", category: "tool", aliases: ["linux", "unix", "bash", "shell"] },
    { canonicalName: "Distributed Systems", category: "concept", aliases: ["distributed systems", "microservices", "event-driven architecture"] },
    { canonicalName: "Machine Learning", category: "concept", aliases: ["machine learning", "ml", "artificial intelligence", "ai", "deep learning", "nlp"] },
    { canonicalName: "System Architecture", category: "concept", aliases: ["system architecture", "software architecture", "scalability", "high availability"] },
    { canonicalName: "Agile", category: "concept", aliases: ["agile", "scrum", "kanban"] },
  ];

  private aliasMap = new Map<string, SkillDefinition>();

  constructor() {
    for (const def of SkillOntology.SKILLS) {
      this.aliasMap.set(def.canonicalName.toLowerCase(), def);
      for (const alias of def.aliases) {
        this.aliasMap.set(alias.toLowerCase(), def);
      }
    }
  }

  normalize(term: string): SkillDefinition | undefined {
    const cleaned = term.trim().toLowerCase();
    return this.aliasMap.get(cleaned);
  }

  canonicalize(term: string): string {
    const found = this.normalize(term);
    return found ? found.canonicalName : term.trim();
  }

  findSkillsInText(text: string): SkillDefinition[] {
    const results: SkillDefinition[] = [];
    const seen = new Set<string>();
    const textLower = text.toLowerCase();

    // Use boundary-aware matching
    for (const def of SkillOntology.SKILLS) {
      if (seen.has(def.canonicalName)) continue;

      for (const alias of def.aliases) {
        const regex = new RegExp(`\\b${escapeRegExp(alias)}\\b`, "i");
        if (regex.test(textLower)) {
          results.push(def);
          seen.add(def.canonicalName);
          break;
        }
      }
    }

    return results;
  }
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
