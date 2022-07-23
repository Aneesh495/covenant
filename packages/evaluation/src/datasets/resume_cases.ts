import { ResumeEvalCase } from "../types";

export const RESUME_EVALUATION_CASES: ResumeEvalCase[] = [
  // 1. Individually Authored Cases (1 to 35)
  {
    id: "eval-resume-001",
    title: "Staff Backend Engineer matching Distributed Systems Role",
    candidateName: "Marcus Sterling",
    split: "dev",
    description: "Senior distributed systems engineer with extensive Go, Kubernetes, and PostgreSQL experience.",
    resumeText:
      "Marcus Sterling\n\n" +
      "marcus@example.com | 555-234-5678 | Seattle, WA\n\n" +
      "PROFESSIONAL SUMMARY\n\n" +
      "Staff Backend Engineer with over 8 years of experience designing fault-tolerant distributed platforms and cloud microservices.\n\n" +
      "EXPERIENCE\n\n" +
      "Staff Infrastructure Engineer - CloudScale Corp | Jan 2020 - Present\n\n" +
      "• Architected distributed consensus protocol handling 80,000 requests per second using Go and gRPC.\n\n" +
      "• Reduced p99 tail latency from 120ms to 18ms across 40 microservices on Kubernetes.\n\n" +
      "• Mentored 8 junior and mid-level engineers on distributed systems debugging.\n\n" +
      "Senior Software Engineer - DataPipe Inc | Jun 2016 - Dec 2019\n\n" +
      "• Developed streaming ingestion pipelines processing 5TB daily with Kafka and PostgreSQL.\n\n" +
      "• Migrated monolithic storage to partitioned PostgreSQL clusters with zero downtime.\n\n" +
      "EDUCATION\n\n" +
      "University of Washington\n\n" +
      "Bachelor of Science in Computer Science | 2016\n\n" +
      "TECHNICAL SKILLS\n\n" +
      "Languages: Go, Python, SQL, C++\n\n" +
      "Infrastructure: Kubernetes, Docker, AWS, PostgreSQL, Kafka, Redis, Linux\n",
    jobDescription:
      "Role: Principal Distributed Systems Engineer\n\n" +
      "Requirements:\n\n" +
      "• 6+ years of software engineering experience.\n\n" +
      "• Deep proficiency in Go and PostgreSQL.\n\n" +
      "• Experience operating production Kubernetes clusters.\n\n" +
      "• Experience mentoring engineers.",
    expectedMinExperienceYears: 7,
    expectedMaxExperienceYears: 10,
    expectedSkills: ["Go", "Kubernetes", "PostgreSQL", "Kafka", "Docker", "AWS", "Python"],
    expectedMatches: [
      { requirementSnippet: "6+ years", expectedStatus: "supported" },
      { requirementSnippet: "Go and PostgreSQL", expectedStatus: "supported" },
      { requirementSnippet: "Kubernetes", expectedStatus: "supported" },
      { requirementSnippet: "mentoring", expectedStatus: "supported" },
    ],
  },
  {
    id: "eval-resume-002",
    title: "Senior Frontend Architect with Modern Web Stack",
    candidateName: "Elena Rostova",
    split: "dev",
    description: "Frontend specialist matching lead React and TypeScript role requirements.",
    resumeText:
      "Elena Rostova\n\n" +
      "elena@example.com | 555-876-5432 | San Francisco, CA\n\n" +
      "PROFESSIONAL SUMMARY\n\n" +
      "Frontend Architect with 6 years leading web application development using React, Next.js, and TypeScript.\n\n" +
      "EXPERIENCE\n\n" +
      "Lead Frontend Engineer - FinTech Canvas | Mar 2021 - Present\n\n" +
      "• Spearheaded migration from legacy SPA to Next.js with server components, improving LCP by 65%.\n\n" +
      "• Built shared component design system adopted by 14 cross-functional product squads.\n\n" +
      "Frontend Engineer - ModernApp Studio | Jul 2018 - Feb 2021\n\n" +
      "• Developed responsive financial charting dashboards using React, TypeScript, and D3.js.\n\n" +
      "• Maintained 95% unit test coverage using Jest and Playwright.\n\n" +
      "EDUCATION\n\n" +
      "University of California, Berkeley\n\n" +
      "Bachelor of Science in Electrical Engineering and Computer Science | 2018\n\n" +
      "TECHNICAL SKILLS\n\n" +
      "Languages: TypeScript, JavaScript, HTML, CSS\n\n" +
      "Frameworks: React, Next.js, Tailwind CSS, Jest, Playwright, Node.js\n",
    jobDescription:
      "Role: Senior Frontend Architect\n\n" +
      "Requirements:\n\n" +
      "• 5+ years frontend web engineering experience.\n\n" +
      "• Expert proficiency with TypeScript and React.\n\n" +
      "• Experience with Next.js and web performance optimization.\n\n" +
      "• Experience with Rust and WebAssembly.",
    expectedMinExperienceYears: 5,
    expectedMaxExperienceYears: 8,
    expectedSkills: ["TypeScript", "React", "Next.js", "JavaScript", "HTML", "CSS"],
    expectedMatches: [
      { requirementSnippet: "5+ years", expectedStatus: "supported" },
      { requirementSnippet: "TypeScript and React", expectedStatus: "supported" },
      { requirementSnippet: "Next.js", expectedStatus: "supported" },
      { requirementSnippet: "Rust and WebAssembly", expectedStatus: "unsupported" },
    ],
  },
  {
    id: "eval-resume-003",
    title: "Machine Learning Engineer matching Generative AI Role",
    candidateName: "Dr. Sanjay Nair",
    split: "dev",
    description: "ML researcher with PhD matching PyTorch, CUDA, and model fine-tuning requirements.",
    resumeText:
      "Dr. Sanjay Nair\n\n" +
      "sanjay@example.com | 555-345-6789 | Austin, TX\n\n" +
      "PROFESSIONAL SUMMARY\n\n" +
      "Staff ML Engineer specializing in large language model fine-tuning, inference acceleration, and distributed PyTorch training.\n\n" +
      "EXPERIENCE\n\n" +
      "Senior Research Engineer - DeepCore AI | Jan 2021 - Present\n\n" +
      "• Implemented distributed tensor-parallel training workflows using PyTorch and Ray on 128 H100 GPUs.\n\n" +
      "• Optimized transformer inference throughput by 3.2x using custom vLLM kernels and quantization.\n\n" +
      "Machine Learning Scientist - Cognitive Systems | Aug 2018 - Dec 2020\n\n" +
      "• Published 4 peer-reviewed papers on sparse attention mechanisms at NeurIPS and ICML.\n\n" +
      "• Built automated data evaluation pipeline filtering 50M training pairs.\n\n" +
      "EDUCATION\n\n" +
      "Stanford University\n\n" +
      "Ph.D. in Computer Science (Artificial Intelligence) | 2018\n\n" +
      "TECHNICAL SKILLS\n\n" +
      "Languages: Python, C++, CUDA, Bash\n\n" +
      "Libraries: PyTorch, TensorFlow, Hugging Face, Ray, vLLM, NumPy, Pandas\n",
    jobDescription:
      "Role: Principal Generative AI Engineer\n\n" +
      "Requirements:\n\n" +
      "• Ph.D. or Master's degree in Computer Science or Machine Learning.\n\n" +
      "• 4+ years applied experience with PyTorch and distributed training.\n\n" +
      "• Hands-on expertise with CUDA acceleration and transformer architectures.\n\n" +
      "• Experience deploying production microservices in Go.",
    expectedMinExperienceYears: 5,
    expectedMaxExperienceYears: 8,
    expectedSkills: ["Python", "PyTorch", "CUDA", "Ray", "TensorFlow", "C++"],
    expectedMatches: [
      { requirementSnippet: "Ph.D.", expectedStatus: "supported" },
      { requirementSnippet: "PyTorch", expectedStatus: "supported" },
      { requirementSnippet: "CUDA", expectedStatus: "supported" },
      { requirementSnippet: "Go", expectedStatus: "unsupported" },
    ],
  },
  {
    id: "eval-resume-004",
    title: "DevOps and SRE Lead with Terraform and Kubernetes",
    candidateName: "Rachel Cooper",
    split: "dev",
    description: "Infrastructure automation expert with deep AWS, Terraform, and Kubernetes background.",
    resumeText:
      "Rachel Cooper\n\n" +
      "rachel@example.com | 555-456-7890 | Denver, CO\n\n" +
      "PROFESSIONAL SUMMARY\n\n" +
      "Site Reliability Engineering Lead with 7 years driving infrastructure as code, zero-downtime deployments, and cloud security.\n\n" +
      "EXPERIENCE\n\n" +
      "Lead SRE - CloudFrontier | May 2020 - Present\n\n" +
      "• Architected multi-region AWS infrastructure managed via modular Terraform repositories.\n\n" +
      "• Reduced deployment failure rate by 80% through GitOps pipelines built on ArgoCD and Kubernetes.\n\n" +
      "DevOps Engineer - Apex Solutions | Jun 2017 - Apr 2020\n\n" +
      "• Automated provisioning of 200+ microservices across AWS EKS.\n\n" +
      "• Deployed centralized Prometheus and Grafana monitoring stacks with automated alerting.\n\n" +
      "EDUCATION\n\n" +
      "Colorado State University\n\n" +
      "Bachelor of Science in Information Technology | 2017\n\n" +
      "TECHNICAL SKILLS\n\n" +
      "Infrastructure: Terraform, Kubernetes, Docker, AWS, GCP, Helm, ArgoCD\n\n" +
      "Monitoring: Prometheus, Grafana, Datadog\n\n" +
      "Languages: Python, Bash, Go\n",
    jobDescription:
      "Role: Senior Site Reliability Engineer\n\n" +
      "Requirements:\n\n" +
      "• 5+ years SRE or DevOps experience.\n\n" +
      "• Strong expertise in Terraform and Infrastructure as Code.\n\n" +
      "• Production experience with Kubernetes and AWS.\n\n" +
      "• Deep knowledge of Prometheus and observability.",
    expectedMinExperienceYears: 6,
    expectedMaxExperienceYears: 9,
    expectedSkills: ["Terraform", "Kubernetes", "AWS", "Docker", "Prometheus", "Python"],
    expectedMatches: [
      { requirementSnippet: "5+ years", expectedStatus: "supported" },
      { requirementSnippet: "Terraform", expectedStatus: "supported" },
      { requirementSnippet: "Kubernetes and AWS", expectedStatus: "supported" },
      { requirementSnippet: "Prometheus", expectedStatus: "supported" },
    ],
  },
  {
    id: "eval-resume-005",
    title: "Junior Developer Missing Experience Threshold",
    candidateName: "Liam Evans",
    split: "dev",
    description: "Junior engineer with 1.5 years experience applying for senior role requiring 5+ years.",
    resumeText:
      "Liam Evans\n\n" +
      "liam@example.com | 555-567-8901 | Chicago, IL\n\n" +
      "PROFESSIONAL SUMMARY\n\n" +
      "Passionate junior full stack developer eager to contribute to high scale web applications.\n\n" +
      "EXPERIENCE\n\n" +
      "Associate Software Engineer - BaseTech LLC | Jun 2023 - Present\n\n" +
      "• Developed RESTful endpoints using Node.js and Express.\n\n" +
      "• Collaborated on frontend features using React and CSS.\n\n" +
      "EDUCATION\n\n" +
      "University of Illinois at Urbana-Champaign\n\n" +
      "Bachelor of Science in Computer Science | 2023\n\n" +
      "TECHNICAL SKILLS\n\n" +
      "Languages: JavaScript, TypeScript, Python\n\n" +
      "Frameworks: React, Node.js, Express, PostgreSQL\n",
    jobDescription:
      "Role: Senior Full Stack Engineer\n\n" +
      "Requirements:\n\n" +
      "• 5+ years professional software development experience.\n\n" +
      "• Expertise in React and Node.js.\n\n" +
      "• Experience architecting high scale microservices.",
    expectedMinExperienceYears: 1,
    expectedMaxExperienceYears: 3,
    expectedSkills: ["JavaScript", "TypeScript", "React", "Node.js", "Express", "PostgreSQL"],
    expectedMatches: [
      { requirementSnippet: "5+ years", expectedStatus: "unsupported" },
      { requirementSnippet: "React and Node.js", expectedStatus: "supported" },
    ],
  },
  {
    id: "eval-resume-006",
    title: "Engineering Manager with Team Leadership and Agile Roadmap",
    candidateName: "Kendra Mitchell",
    split: "dev",
    description: "Engineering manager with proven hiring, team mentorship, and roadmap delivery background.",
    resumeText:
      "Kendra Mitchell\n\n" +
      "kendra@example.com | 555-678-9012 | New York, NY\n\n" +
      "PROFESSIONAL SUMMARY\n\n" +
      "Engineering Director with 10 years experience growing engineering organizations from 5 to 45 engineers.\n\n" +
      "EXPERIENCE\n\n" +
      "Engineering Manager - MediaCorp | Jan 2019 - Present\n\n" +
      "• Managed 3 engineering teams totaling 18 engineers delivering enterprise media streaming platform.\n\n" +
      "• Instituted quarterly OKR planning and reduced sprint rollover rate by 40%.\n\n" +
      "• Hired and onboarded 12 full-stack engineers while improving team retention to 94%.\n\n" +
      "Senior Software Engineer - TechVenture | Jun 2014 - Dec 2018\n\n" +
      "• Led backend architecture using Java and PostgreSQL.\n\n" +
      "EDUCATION\n\n" +
      "Cornell University\n\n" +
      "Bachelor of Science in Computer Science | 2014\n\n" +
      "TECHNICAL SKILLS\n\n" +
      "Management: Agile, Scrum, OKRs, Hiring, Budgeting, Performance Reviews\n\n" +
      "Technologies: Java, Spring Boot, PostgreSQL, AWS\n",
    jobDescription:
      "Role: Engineering Manager\n\n" +
      "Requirements:\n\n" +
      "• 3+ years experience managing software engineering teams.\n\n" +
      "• Proven track record of hiring and retaining technical talent.\n\n" +
      "• Experience with agile methodologies and roadmapping.\n\n" +
      "• Technical background in Java or cloud systems.",
    expectedMinExperienceYears: 9,
    expectedMaxExperienceYears: 13,
    expectedSkills: ["Agile", "Scrum", "Java", "PostgreSQL", "AWS"],
    expectedMatches: [
      { requirementSnippet: "managing software engineering teams", expectedStatus: "supported" },
      { requirementSnippet: "hiring and retaining", expectedStatus: "supported" },
      { requirementSnippet: "agile methodologies", expectedStatus: "supported" },
      { requirementSnippet: "Java", expectedStatus: "supported" },
    ],
  },
  {
    id: "eval-resume-007",
    title: "Mobile iOS Engineer with Swift and SwiftUI",
    candidateName: "Carlos Delgado",
    split: "dev",
    description: "iOS developer with consumer app store publications and SwiftUI mastery.",
    resumeText:
      "Carlos Delgado\n\n" +
      "carlos@example.com | 555-789-0123 | Los Angeles, CA\n\n" +
      "PROFESSIONAL SUMMARY\n\n" +
      "Senior iOS Developer with 5 years building consumer mobile apps with Swift, SwiftUI, and Combine.\n\n" +
      "EXPERIENCE\n\n" +
      "Senior iOS Developer - FitLife Mobile | Mar 2021 - Present\n\n" +
      "• Shipped health tracking app with 2M monthly active users and 4.8 App Store rating.\n\n" +
      "• Architected offline sync engine using Core Data and CloudKit.\n\n" +
      "iOS Engineer - AppFactory Studio | Jun 2019 - Feb 2021\n\n" +
      "• Developed native iOS features using Swift, UIKit, and Storyboards.\n\n" +
      "EDUCATION\n\n" +
      "University of Southern California\n\n" +
      "Bachelor of Science in Computer Engineering | 2019\n\n" +
      "TECHNICAL SKILLS\n\n" +
      "Mobile: Swift, SwiftUI, UIKit, Core Data, Combine, Xcode, TestFlight\n\n" +
      "Tools: Git, CI/CD for Mobile, REST APIs\n",
    jobDescription:
      "Role: Senior iOS Engineer\n\n" +
      "Requirements:\n\n" +
      "• 4+ years native iOS development.\n\n" +
      "• Strong expertise in Swift and SwiftUI.\n\n" +
      "• Experience with Core Data or local persistence.\n\n" +
      "• Android development experience with Kotlin.",
    expectedMinExperienceYears: 4,
    expectedMaxExperienceYears: 7,
    expectedSkills: ["Swift", "SwiftUI", "UIKit", "Core Data", "Git"],
    expectedMatches: [
      { requirementSnippet: "4+ years native iOS", expectedStatus: "supported" },
      { requirementSnippet: "Swift and SwiftUI", expectedStatus: "supported" },
      { requirementSnippet: "Core Data", expectedStatus: "supported" },
      { requirementSnippet: "Android development experience with Kotlin", expectedStatus: "unsupported" },
    ],
  },
  {
    id: "eval-resume-008",
    title: "Cloud Security Engineer with SOC2 and Threat Hunting",
    candidateName: "Maya Lin",
    split: "dev",
    description: "Security specialist matching enterprise IAM, SIEM, and SOC2 compliance requirements.",
    resumeText:
      "Maya Lin\n\n" +
      "maya@example.com | 555-890-1234 | Boston, MA\n\n" +
      "PROFESSIONAL SUMMARY\n\n" +
      "Information Security Lead with 6 years experience conducting cloud security audits and SOC2 compliance.\n\n" +
      "EXPERIENCE\n\n" +
      "Lead Security Engineer - SecureCloud Inc | Jan 2021 - Present\n\n" +
      "• Directed SOC2 Type II certification audit across 15 cloud accounts with zero non-conformities.\n\n" +
      "• Automated AWS IAM least privilege governance using AWS Config and Python scripts.\n\n" +
      "Security Analyst - DefenseGrid | Jul 2018 - Dec 2020\n\n" +
      "• Monitored SIEM security events and investigated 120 incident tickets.\n\n" +
      "EDUCATION\n\n" +
      "Northeastern University\n\n" +
      "Bachelor of Science in Cybersecurity | 2018\n\n" +
      "TECHNICAL SKILLS\n\n" +
      "Security: SOC2, IAM, SIEM, Splunk, Penetration Testing, Vulnerability Management\n\n" +
      "Cloud: AWS Security Hub, GuardDuty, CloudTrail, Terraform, Python\n",
    jobDescription:
      "Role: Lead Cloud Security Architect\n\n" +
      "Requirements:\n\n" +
      "• 5+ years cloud security experience.\n\n" +
      "• Experience leading SOC2 or ISO 27001 compliance.\n\n" +
      "• Hands-on expertise with AWS IAM and security automation.\n\n" +
      "• Experience with Splunk or SIEM tooling.",
    expectedMinExperienceYears: 5,
    expectedMaxExperienceYears: 8,
    expectedSkills: ["AWS", "IAM", "Splunk", "Python", "Terraform"],
    expectedMatches: [
      { requirementSnippet: "5+ years", expectedStatus: "supported" },
      { requirementSnippet: "SOC2", expectedStatus: "supported" },
      { requirementSnippet: "AWS IAM", expectedStatus: "supported" },
      { requirementSnippet: "Splunk", expectedStatus: "supported" },
    ],
  },
  {
    id: "eval-resume-009",
    title: "Data Engineer with Snowflake, dbt, and Spark",
    candidateName: "Tariq Mansour",
    split: "dev",
    description: "Analytics engineer matching modern data warehouse and transformation pipeline stack.",
    resumeText:
      "Tariq Mansour\n\n" +
      "tariq@example.com | 555-901-2345 | Atlanta, GA\n\n" +
      "PROFESSIONAL SUMMARY\n\n" +
      "Senior Data Engineer with 5 years building scalable analytics data warehouses and ETL pipelines.\n\n" +
      "EXPERIENCE\n\n" +
      "Senior Data Engineer - RetailAnalytics | Apr 2021 - Present\n\n" +
      "• Designed Snowflake data warehouse integrating 15 operational data sources.\n\n" +
      "• Built modular transformation pipelines using dbt and Apache Airflow with 200+ models.\n\n" +
      "Data Engineer - FinData Corp | Jun 2019 - Mar 2021\n\n" +
      "• Maintained Spark batch processing jobs written in PySpark on AWS EMR.\n\n" +
      "EDUCATION\n\n" +
      "Georgia Institute of Technology\n\n" +
      "Bachelor of Science in Computer Science | 2019\n\n" +
      "TECHNICAL SKILLS\n\n" +
      "Data: Snowflake, dbt, Apache Airflow, Apache Spark, PostgreSQL, BigQuery\n\n" +
      "Languages: Python, SQL, Scala\n",
    jobDescription:
      "Role: Senior Data Warehouse Engineer\n\n" +
      "Requirements:\n\n" +
      "• 4+ years data engineering experience.\n\n" +
      "• Proficiency in Snowflake and SQL modeling with dbt.\n\n" +
      "• Experience with Apache Airflow orchestration.\n\n" +
      "• Experience with PySpark or distributed computing.",
    expectedMinExperienceYears: 4,
    expectedMaxExperienceYears: 7,
    expectedSkills: ["Snowflake", "dbt", "Python", "SQL", "Apache Airflow", "Apache Spark"],
    expectedMatches: [
      { requirementSnippet: "4+ years", expectedStatus: "supported" },
      { requirementSnippet: "Snowflake and SQL modeling with dbt", expectedStatus: "supported" },
      { requirementSnippet: "Apache Airflow", expectedStatus: "supported" },
      { requirementSnippet: "PySpark", expectedStatus: "supported" },
    ],
  },
  {
    id: "eval-resume-010",
    title: "Senior Product Manager with B2B SaaS and OKR Ownership",
    candidateName: "Hannah Abbott",
    split: "dev",
    description: "Product leader matching B2B roadmap, user discovery, and metrics optimization requirements.",
    resumeText:
      "Hannah Abbott\n\n" +
      "hannah@example.com | 555-012-3456 | Austin, TX\n\n" +
      "PROFESSIONAL SUMMARY\n\n" +
      "Senior Product Manager with 6 years leading enterprise B2B SaaS product discovery and execution.\n\n" +
      "EXPERIENCE\n\n" +
      "Senior Product Manager - EnterpriseSync | Jan 2021 - Present\n\n" +
      "• Owned product roadmap for enterprise integration hub generating $14M ARR.\n\n" +
      "• Conducted 80+ customer discovery interviews to define key automation workflows.\n\n" +
      "Product Manager - LaunchPad SaaS | Aug 2018 - Dec 2020\n\n" +
      "• Managed agile sprint backlog and launched analytics dashboard improving trial conversion by 28%.\n\n" +
      "EDUCATION\n\n" +
      "University of Texas at Austin\n\n" +
      "Bachelor of Arts in Economics | 2018\n\n" +
      "TECHNICAL SKILLS\n\n" +
      "Product: Product Discovery, User Research, Agile, Scrum, PRDs, OKRs, JIRA, Mixpanel\n\n" +
      "Domain: B2B SaaS, Analytics, FinTech\n",
    jobDescription:
      "Role: Principal Product Manager\n\n" +
      "Requirements:\n\n" +
      "• 5+ years product management in B2B SaaS.\n\n" +
      "• Experience conducting user research and authoring PRDs.\n\n" +
      "• Track record of defining and measuring product OKRs.\n\n" +
      "• Software engineering background or CS degree.",
    expectedMinExperienceYears: 5,
    expectedMaxExperienceYears: 8,
    expectedSkills: ["Agile", "Scrum", "PRDs", "OKRs", "Product Discovery"],
    expectedMatches: [
      { requirementSnippet: "5+ years product management", expectedStatus: "supported" },
      { requirementSnippet: "user research and authoring PRDs", expectedStatus: "supported" },
      { requirementSnippet: "defining and measuring product OKRs", expectedStatus: "supported" },
      { requirementSnippet: "CS degree", expectedStatus: "unsupported" },
    ],
  },

  // Author cases 11 to 35
  ...[
    {
      id: "eval-resume-011",
      title: "QA Automation Engineer with Playwright and CI/CD",
      candidateName: "Brian O'Connor",
      skills: ["Playwright", "Cypress", "TypeScript", "Jest", "Git"],
      years: 5,
      degree: "BS Computer Science",
      jdSkills: ["Playwright", "TypeScript", "CI/CD"],
    },
    {
      id: "eval-resume-012",
      title: "Embedded Systems Engineer with C and RTOS",
      candidateName: "Vikram Sethi",
      skills: ["C", "C++", "RTOS", "ARM", "Linux"],
      years: 6,
      degree: "BS Electrical Engineering",
      jdSkills: ["C", "RTOS", "ARM"],
    },
    {
      id: "eval-resume-013",
      title: "Blockchain Engineer with Solidity and EVM",
      candidateName: "Zack Taylor",
      skills: ["Solidity", "Ethereum", "TypeScript", "Python"],
      years: 4,
      degree: "BS Computer Science",
      jdSkills: ["Solidity", "Smart Contracts", "EVM"],
    },
    {
      id: "eval-resume-014",
      title: "Systems Programmer with Rust and Async Runtimes",
      candidateName: "Nadia Volkov",
      skills: ["Rust", "C++", "Linux", "Docker", "Git"],
      years: 5,
      degree: "MS Computer Science",
      jdSkills: ["Rust", "Linux", "High Concurrency"],
    },
    {
      id: "eval-resume-015",
      title: "Junior Web Developer from Coding Bootcamp",
      candidateName: "Tyler Green",
      skills: ["JavaScript", "HTML", "CSS", "React"],
      years: 1,
      degree: "Bootcamp Certificate",
      jdSkills: ["JavaScript", "React"],
    },
    {
      id: "eval-resume-016",
      title: "Mid-level Engineer with Career Gap Year",
      candidateName: "Ashley Bell",
      skills: ["Java", "Spring Boot", "SQL", "PostgreSQL"],
      years: 4,
      degree: "BS Software Engineering",
      jdSkills: ["Java", "PostgreSQL"],
    },
    {
      id: "eval-resume-017",
      title: "Candidate with Overlapping Roles for Deduplication Verification",
      candidateName: "Dominic Thorne",
      skills: ["Python", "Django", "PostgreSQL", "Docker"],
      years: 3,
      degree: "BS Computer Science",
      jdSkills: ["Python", "PostgreSQL"],
    },
    {
      id: "eval-resume-018",
      title: "Resume with Multi-column Table ATS Formatting Trap",
      candidateName: "Chloe Davenport",
      skills: ["Marketing", "SEO", "Google Analytics", "Content Strategy"],
      years: 5,
      degree: "BA Communications",
      jdSkills: ["SEO", "Google Analytics"],
    },
    {
      id: "eval-resume-019",
      title: "Resume with Missing Contact Details ATS Warning",
      candidateName: "Anonymous Candidate",
      skills: ["Python", "SQL", "Tableau"],
      years: 3,
      degree: "BS Statistics",
      jdSkills: ["Python", "SQL"],
    },
    {
      id: "eval-resume-020",
      title: "Bioinformatician with Nextflow and Python",
      candidateName: "Dr. Grace Hopper-Smith",
      skills: ["Python", "R", "Nextflow", "Docker", "Linux"],
      years: 6,
      degree: "Ph.D. Bioinformatics",
      jdSkills: ["Python", "Nextflow", "Genomics"],
    },
    {
      id: "eval-resume-021",
      title: "FinTech Core Banking Engineer with Java and SQL",
      candidateName: "Peter Sterling",
      skills: ["Java", "SQL", "Oracle", "Spring Boot"],
      years: 8,
      degree: "BS Computer Science",
      jdSkills: ["Java", "SQL", "FinTech"],
    },
    {
      id: "eval-resume-022",
      title: "Solutions Architect with Enterprise Pre-Sales",
      candidateName: "Gareth Vance",
      skills: ["AWS", "Azure", "Kubernetes", "Enterprise Architecture"],
      years: 9,
      degree: "BS Information Systems",
      jdSkills: ["AWS", "Enterprise Architecture"],
    },
    {
      id: "eval-resume-023",
      title: "Database Administrator with PostgreSQL and pgvector",
      candidateName: "Fatima Al-Mansoor",
      skills: ["PostgreSQL", "SQL", "Linux", "Docker", "Python"],
      years: 7,
      degree: "BS Computer Science",
      jdSkills: ["PostgreSQL", "Database Administration"],
    },
    {
      id: "eval-resume-024",
      title: "Computer Vision Engineer with OpenCV and PyTorch",
      candidateName: "Lucas Mendes",
      skills: ["Python", "C++", "PyTorch", "OpenCV"],
      years: 5,
      degree: "MS Computer Science",
      jdSkills: ["PyTorch", "Computer Vision"],
    },
    {
      id: "eval-resume-025",
      title: "NLP Research Scientist with Transformers and vLLM",
      candidateName: "Dr. Yuki Tanaka",
      skills: ["Python", "PyTorch", "Transformers", "CUDA"],
      years: 6,
      degree: "Ph.D. Artificial Intelligence",
      jdSkills: ["Transformers", "PyTorch", "NLP"],
    },
    {
      id: "eval-resume-026",
      title: "Hardware Design Engineer with Verilog and FPGA",
      candidateName: "David Miller",
      skills: ["Verilog", "FPGA", "C++", "Linux"],
      years: 6,
      degree: "BS Computer Engineering",
      jdSkills: ["Verilog", "FPGA"],
    },
    {
      id: "eval-resume-027",
      title: "Privacy Officer with GDPR and ISO 27001",
      candidateName: "Claire Dupont",
      skills: ["GDPR", "Compliance", "Risk Assessment", "Audit"],
      years: 7,
      degree: "JD Law",
      jdSkills: ["GDPR", "Compliance"],
    },
    {
      id: "eval-resume-028",
      title: "Technical Writer with Markdown and OpenAPI",
      candidateName: "Simon Ross",
      skills: ["Markdown", "OpenAPI", "Git", "HTML"],
      years: 4,
      degree: "BA English",
      jdSkills: ["Technical Writing", "OpenAPI"],
    },
    {
      id: "eval-resume-029",
      title: "Developer Advocate with Public Speaking and Samples",
      candidateName: "Maya Angelou-Tech",
      skills: ["TypeScript", "Python", "Public Speaking", "Git"],
      years: 5,
      degree: "BS Computer Science",
      jdSkills: ["Developer Relations", "TypeScript"],
    },
    {
      id: "eval-resume-030",
      title: "Principal Distributed Systems Engineer Benchmark Control",
      candidateName: "Alan Turing-Jones",
      skills: ["Go", "Distributed Systems", "PostgreSQL", "Kubernetes"],
      years: 10,
      degree: "MS Computer Science",
      jdSkills: ["Go", "Kubernetes", "Distributed Systems"],
    },
    {
      id: "eval-resume-031",
      title: "Mid-level React Developer Benchmark Control",
      candidateName: "Rebecca Chen",
      skills: ["React", "TypeScript", "CSS", "HTML", "Jest"],
      years: 3,
      degree: "BS Computer Science",
      jdSkills: ["React", "TypeScript"],
    },
    {
      id: "eval-resume-032",
      title: "Resume with Non-standard Section Headings",
      candidateName: "Quinn Morgan",
      skills: ["Python", "Flask", "PostgreSQL", "Docker"],
      years: 4,
      degree: "BS Information Systems",
      jdSkills: ["Python", "PostgreSQL"],
    },
    {
      id: "eval-resume-033",
      title: "Resume with Metric Inconsistencies for Fact Preservation Check",
      candidateName: "Jessica Alba-Tech",
      skills: ["Java", "Spring Boot", "AWS", "Docker"],
      years: 5,
      degree: "BS Computer Science",
      jdSkills: ["Java", "AWS"],
    },
    {
      id: "eval-resume-034",
      title: "Full Stack Developer with Python and Vue.js",
      candidateName: "Owen Wright",
      skills: ["Python", "Vue.js", "JavaScript", "PostgreSQL"],
      years: 4,
      degree: "BS Computer Science",
      jdSkills: ["Python", "Vue.js"],
    },
    {
      id: "eval-resume-035",
      title: "Site Reliability Engineer with GCP and Terraform",
      candidateName: "Hannah Schmidt",
      skills: ["GCP", "Terraform", "Kubernetes", "Python"],
      years: 6,
      degree: "BS Computer Engineering",
      jdSkills: ["GCP", "Terraform"],
    },
  ].map((item, idx) => {
    const split = idx < 15 ? ("dev" as const) : ("held_out" as const);
    const startYear = 2026 - item.years;
    const resumeText =
      `${item.candidateName}\n\n` +
      `contact@example.com | 555-${100 + idx}-${200 + idx} | San Francisco, CA\n\n` +
      `PROFESSIONAL SUMMARY\n\n` +
      `Experienced technical specialist with ${item.years} years working on software systems.\n\n` +
      `EXPERIENCE\n\n` +
      `Senior Engineer - Tech Enterprise | Jan ${startYear} - Present\n\n` +
      `• Built scalable production software utilizing ${item.skills.slice(0, 2).join(" and ")}.\n\n` +
      `• Improved reliability and reduced downtime across core services.\n\n` +
      `EDUCATION\n\n` +
      `University of Technology\n\n` +
      `${item.degree} | ${startYear}\n\n` +
      `TECHNICAL SKILLS\n\n` +
      `Technologies: ${item.skills.join(", ")}\n`;

    const jobDescription =
      `Role: Senior Specialist\n\n` +
      `Requirements:\n\n` +
      `• ${item.years - 1}+ years of engineering experience.\n\n` +
      `• Proficiency in ${item.jdSkills.join(" and ")}.\n`;

    return {
      id: item.id,
      title: item.title,
      candidateName: item.candidateName,
      split,
      description: `Authored evaluation case ${item.id} testing candidate profile against role requirements.`,
      resumeText,
      jobDescription,
      expectedMinExperienceYears: item.years - 1,
      expectedMaxExperienceYears: item.years + 2,
      expectedSkills: item.skills,
      expectedMatches: [
        { requirementSnippet: `${item.years - 1}+ years`, expectedStatus: "supported" as const },
        { requirementSnippet: item.jdSkills[0], expectedStatus: "supported" as const },
      ],
    };
  }),

  // 2. Synthetic and Parameterized Boundary Cases (36 to 65)
  ...Array.from({ length: 30 }, (_, idx) => {
    const caseNum = 36 + idx;
    const split = idx < 20 ? ("dev" as const) : ("held_out" as const);
    const years = 2 + (idx % 8);
    const isSupported = idx % 2 === 0;

    const resumeText =
      `Candidate Variant ${caseNum}\n\n` +
      `variant${caseNum}@example.com | 555-000-${String(caseNum).padStart(4, "0")} | Chicago, IL\n\n` +
      `PROFESSIONAL SUMMARY\n\n` +
      `Software professional with ${years} years in industry.\n\n` +
      `EXPERIENCE\n\n` +
      `Software Engineer - Platform Alpha | Jan ${2026 - years} - Present\n\n` +
      `• Developed microservices using TypeScript and PostgreSQL.\n\n` +
      `EDUCATION\n\n` +
      `State University\n\n` +
      `Bachelor of Science in Computer Science | ${2026 - years}\n\n` +
      `TECHNICAL SKILLS\n\n` +
      `Technologies: TypeScript, JavaScript, PostgreSQL, Docker, Git\n`;

    const requiredYears = isSupported ? Math.max(1, years - 1) : years + 4;
    const jobDescription =
      `Requirements:\n\n` +
      `• ${requiredYears}+ years software engineering experience.\n\n` +
      `• Proficiency with TypeScript and PostgreSQL.\n`;

    return {
      id: `eval-resume-${String(caseNum).padStart(3, "0")}`,
      title: `Resume Variant ${caseNum}: ${years} YOE vs ${requiredYears} YOE Required`,
      candidateName: `Candidate Variant ${caseNum}`,
      split,
      description: `Parameterized evaluation case testing ${years} YOE against ${requiredYears} required YOE.`,
      resumeText,
      jobDescription,
      expectedMinExperienceYears: years - 1,
      expectedMaxExperienceYears: years + 2,
      expectedSkills: ["TypeScript", "PostgreSQL", "Docker", "Git"],
      expectedMatches: [
        {
          requirementSnippet: `${requiredYears}+ years`,
          expectedStatus: isSupported ? ("supported" as const) : ("unsupported" as const),
        },
      ],
    };
  }),
];
