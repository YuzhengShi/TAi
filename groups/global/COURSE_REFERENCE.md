# Course Reference

Read this file when a student asks about homework structure, a specific week's topic, or sends a file.

## Homework Structure

Homework follows this pattern (varies by assignment):
- Part I: Hands-on coding/setup exercise
- Part II: Cloud deployment (GCP and/or AWS — EC2, ECR, ECS, Fargate, Lambda, RDS, DynamoDB)
- Part III: Analysis/testing (Locust load tests, performance comparisons)
- Part IV: Reading and Piazza discussion
- Mock interview: weekly 1:1 with TA covering code understanding, tradeoffs, and concepts

Always check if the student has read the Learning Outcomes section — that's what their TA will ask about.

## Weekly Topics (Spring 2026)

| Week | Canvas Module Name | Assignment | Key Concepts |
|------|--------------------|------------|-------------|
| 1 | Week 1! Whhhhhat is all of this?! | HW1a + HW1b | Go basics, REST APIs (Gin), run on GCP; AWS EC2 setup, SSH, cross-compilation (GOOS/GOARCH), security groups, Python load testing, tail latency/percentiles |
| 2 | Week 2! Infrastructure Insanity! :) | HW2: MapReduce, Terraform, and Docker! | MapReduce paper, "How to Read a Paper", Terraform/IaC, Docker images/containers/Dockerfile, Claude Code + Innovation Sandbox, multi-instance data consistency |
| 3 | Week 3: Concurrency Fun! | HW3: Threading and Load Tests! | Lamport clocks paper, goroutines, atomic counters, mutex/RWMutex/sync.Map, buffered vs unbuffered file I/O, context switching, Locust (FastHttpUser), Amdahl's Law |
| 4 | Week 4! ACID and 2PC | HW4: Awesome tools for Workflows! | Google Distributed Systems intro (UW), ACID, 2PC, consensus intro, AWS ECR/ECS/Fargate (7-step setup), MapReduce implementation on ECS+S3 (splitter + 3 mappers + reducer) |
| 5 | Week 5! Now we are Building! APIs and Load Balancers | HW5: Online Store | Reading: DSFP Ch2 (Piazza). Product API from OpenAPI spec (api.yaml), GET+POST /products, in-memory hashmap storage, Dockerfile, Terraform (fork of RuidiH/CS6650_2b_demo), ECS/ECR deploy, Locust load test (HttpUser vs FastHttpUser comparison), Postman for API testing; Swagger Editor to read api.yaml |
| 6 | Week 6: In comes MicroServices! | HW6: Scalability | Reading: Parnas 1972 paper (Piazza). Part II: product search service (100k products, check exactly 100 per query), ECS Fargate 256 CPU/512MB, find breaking point (5 vs 20 users), CloudWatch CPU monitoring, scale vs optimize decision. Part III: horizontal scaling with auto-scaling (ALB + multiple ECS tasks, scale-out policy) |
| 7 | Week 7: Teamwork Makes the Dream Work! | Midterm Mastery (Parts I + II + Mystery) | Crash recovery, fail fast, circuit breaker, bulkhead; reflection on Weeks 1–6; project proposal; team formation; Sam Newman "Principles of Microservices" YouTube video. *Mystery part*: Debug "Hummingbird" REST API (Node.js/Express + S3 + DynamoDB + SNS) — 4 support tickets (2 easy, 2 intermediate) + 1 bonus; use Claude Code in AWS CloudShell with Bedrock (claude-opus-4-6); investigate via CloudWatch logs + source code; fix + redeploy via docker build + ecs update-service; submit PDF with bug explanation + code diffs + .jsonl file. Graded: 10pts for 4 tickets, 2pts bonus |
| 8 | Week 8! We are over half way! | HW7: Cost savings?! | Reading: Vector Clocks (Wikipedia, Piazza). Team assignment (mock interview groups, shared report). Flash sale scenario: sync order processing breaks at 60 orders/sec (3s payment delay). Phase 1: POST /orders/sync. Phase 2: bottleneck math. Phase 3: async with SNS+SQS (POST /orders/async → 202). Phase 4: queue buildup analysis. Phase 5: worker scaling. Uses buffered channels to simulate bottleneck |
| 9 | Week 9! Do you want to go FASTER?! | HW8: Finally DATA! | Team assignment (divide and conquer). Step I: MySQL RDS (db.t3.micro) + shopping cart API (POST /shopping-carts, GET /shopping-carts/{id}, POST /shopping-carts/{id}/items), schema design (carts + cart_items tables), connection pooling, ON DUPLICATE KEY UPDATE, `mysql_test_results.json` (150 ops: 50 create/add/get). Step II: DynamoDB same endpoints, `dynamodb_test_results.json`. Step III: `combined_results.json` comparison. CloudWatch monitoring throughout |
| 10 | Week 10! Getting Liftoff on your Projects!!! | HW9: Project Liftoff! | Milestone 1 report sections: problem + team intro, project plan + timeline + AI role, objectives, related work (3 Piazza projects), methodology (AI use + observability), preliminary results, impact. Sam Newman "What does Asynchronous Mean?" YouTube video |
| 11 | Choose your own Adventure! | HW10: Choose your own Adventure! | "Distributed Systems for Fun and Profit" Ch4, consensus/replication options (Raft, Paxos, or custom) |
| 12 | Putting this all together in your Portfolio! | Final Mastery (Part 1 + Part 2) | Community sharing, deployment assessment, portfolio |
| 13 | Final Project submission | Final Project (Team + Individual) | Final project demo, peer review, individual reflection |

Note: Week 7 is Midterm Mastery week — no new coding homework. HW7 (async messaging / SNS+SQS flash sale scenario — Canvas calls it "Cost savings?!") is assigned in Week 8 module. HW8 (databases) is in Week 9 module. This one-week offset is normal.

Note: Week 5 module includes a Raft intro YouTube video — distributed consensus previewed early.
Note: Week 9 slide deck is "Day10 Data Data Data!" — confirms databases (MySQL RDS + DynamoDB), NOT RabbitMQ. Spring 2026 uses RDS/DynamoDB, NOT RabbitMQ/Kafka.

## External Readings (from HW specs — required for indexing)

### Recommended Books (no textbook required)
- "Distributed Systems for Fun and Profit" — Mikito Takada (online, free)
- "Building Microservices" 2nd Ed — Sam Newman
- "Designing Data-Intensive Applications" (DDIA) — Martin Kleppmann, O'Reilly 2017

### Academic Papers
- MapReduce paper (Google/ACM) — HW2
- "How to Read a Paper" (Stanford, PDF) — HW2
- Lamport's "Time, Clocks, and the Ordering of Events in a Distributed System" (ACM) — HW3
- Google Distributed Systems intro (UW CSE) — HW4
- Vector clocks reading (Piazza) — HW7
- "Distributed Systems for Fun and Profit" by Mikito Takada — Ch1 (HW1), Ch4 (HW10)

### Videos
- Sam Newman "Principles of Microservices" (YouTube, linked in Week 7 module) — Midterm/HW6
- Sam Newman "What does Asynchronous Mean?" (YouTube, linked in Week 10 module) — HW9/HW10
- Raft intro YouTube video (linked in Week 5 module)
- Peter Smith: Scaling Applications (guest lecture, Week 8)

### Documentation / Tutorials
- go.dev tutorials (Go basics) — HW1
- GCP Compute Engine docs — HW1a
- AWS EC2 docs — HW1b
- Terraform docs — HW2
- Docker docs — HW2
- GoByExample (goroutines, mutex) — HW3
- Locust docs (FastHttpUser) — HW3
- AWS ECR/ECS/Fargate/S3/VPC docs — HW4
- AWS Lambda docs — HW7
- AWS RDS (MySQL) + DynamoDB docs — HW8
- MeisterTask or similar project management tools — HW9

### Lecture Slides (Canvas Files — Spring 2026)
- Day1 lecture ONLINE.pdf — Week 1
- Day2 Intro and concurrency.pdf — Week 2
- Day 3 Themes around Parallelism and Concurrency!.pdf — Week 3
- Day 4 ACID 2PC and Consensus.pdf — Week 4
- Day 5 Service APIs and Load Balencers.pdf — Week 5 (note: typo "Balencers" is in the actual filename)
- Day 6 Sneaking up on Microservices!.pdf — Week 6
- Scaling Applications_Peter.pdf — Week 8 (guest lecture)
- Day 8! Projects.pdf — Week 8 (project guidance + course schedule)
- Day 8! Caching!.pdf — Week 9
- Day10 Data Data Data!.pdf — Week 10
- Observability lecture PDF — Week 11 (Apr 6, not yet posted)

### Key Lecture Content Notes (from actual slide PDFs)

*Day 1 (Week 1) — Scalability fundamentals:*
- LLM/AI use is explicitly expected ("treat Claude as a junior engineer") — Yvonne loves Claude Learner Mode (Opus 4.1)
- Scale-up vs scale-out, scale-down (reduce costs); throughput vs latency, replication, response time stability
- Scalability = capability to handle growth (requests, data, stable response time)
- Key principle: "Do not make non-scalable decisions" early — but also don't over-engineer (YAGNI)
- Facebook HipHop: compiling PHP to C++ for 6x speedup — example of "write better code" scaling
- References: Distributed Systems for Fun and Profit Ch1, DDIA (Kleppmann)

*Day 2 (Week 2) — MapReduce + networking:*
- MapReduce "embarrassingly parallelizable", data skew problem, Amdahl's Law, CAP theorem intro
- Throughput vs latency distinction, 40ms response time threshold, tail latency
- 8 Fallacies of Distributed Computing (from Google/UW tutorial)
- "thesecretlivesofdata.com/raft/" — Raft visual linked early

*Day 3 (Week 3) — Concurrency:*
- Concurrency ≠ Parallelism (critical distinction! — concurrency enables parallelism when running on multiple cores)
- Threads vs processes vs containers vs VMs cost hierarchy
- Thread vs process: threads share address space (fast sharing), lighter weight, but scheduling is nondeterministic
- Race conditions, mutexes, nondeterministic behavior — race condition example: x=x+6 and x=x+1 interleaved
- Locks = mutexes = semaphores → serialize access to shared variables; Java `synchronized` = monitor lock
- Fundamental mechanisms: synchronization, coordination, thread pools, thread-safe collections (with overhead!)
- Coordination patterns: Dining Philosophers, Readers/Writers, Producer/Consumer
- Moore's Law limits → why threads matter; MapReduce "stragglers" = data skew problem (chunks take unequal time)
- OCI (Oracle Cloud Infrastructure) mentioned as valid alternative to AWS

*Day 4 (Week 4) — ACID, 2PC, architecture:*
- Little's Law (load testing context — Kanban / queue theory)
- Basic three-tier architecture: client → app server → database
- App server: thread pool + connection pool (thread pool size MUST BE > connection pool size), logging, monitoring
- Multi-tier architecture, stateless services (session state stored externally), load balancers
- Scale-up vs scale-out: "the rack is the computer"; scale-up example: GCP SQL = 96 vCPUs, 624GB RAM, 30TB, $6-16K/yr
- Database bottleneck → resource exhaustion → client timeouts/exceptions
- Redis/memcached for caching database results in service tier (distributed key-value stores)
- Monoliths: hard to change, "ponderous"; microservices: "feels like RPC, loosely coupled"
- YAGNI principle, technical debt

*Day 5 (Week 5) — Service APIs:*
- REST vs RPC style: "RESTful fails the 'Say What You Mean' test — therefore we use RPC style APIs, not REST" (Professor Coady's explicit stance)
- CRUD pattern (Create/Read/Update/Delete), OpenAPI/Swagger
- RPC example: createShoppingCart(), addItem() — clearer than REST PUT/POST gymnastics
- 8 Fallacies of Distributed Computing (repeated for emphasis from Day 2)
- Mock interview 3-stage troubleshooting framework: (1) what problem + what tried, (2) what happened + what tried next, (3) articulation of the actual problem — bring this to group!
- Piazza engagement: "helping others is a BIG way of showing value within your organization"
- Note: Week 6 is a HOLIDAY (no class)

*Day 6 (Week 6) — Microservices:*
- Sam Newman "Moving to Microservices" YouTube video (2015, dawn of Docker era)
- Monolith problems: no internal APIs, technical debt, hard to change
- Domain Driven Design (DDD) + Bounded Contexts for decomposition
- Parnas 1972 "On the criteria to be used in decomposing systems into modules"
- Circuit Breaker Pattern, Bulkhead Pattern, Resilience patterns
- Serverless (FaaS) as microservice deployment option

*Day 8 Caching (Week 9) — Caching:*
- Cache-aside, read-through, write-through, write-behind/write-back patterns
- Redis and Memcached (distributed in-memory key-value stores)
- Cache hit rate, cache miss cost, TTL-based invalidation
- Application caching vs HTTP/web caching distinction
- Twitter stat: 3% of infrastructure dedicated to application-level caches

*Day10 Data Data Data + Week9 DataDive (Week 10) — Databases:*
- CAP Theorem deep dive: CP vs AP tradeoffs, split brain / network partition
- Vertical scaling (RDBMS) vs horizontal scaling, read replicas
- Horizontal sharding, partitioning strategies (key range, hash), consistent hashing
- Moving to NoSQL, consistency models (strong vs eventual)
- Also covers: AI in software development (2026 context) — students must have "a story to tell" about their AI experience in the project

*Peter Smith guest lecture (Week 8) — Scaling:*
- Process-based vs thread-based vs task-based request models
- Multi-AZ and multi-region deployment patterns, DNS load balancing, GeoIP
- Auto-scaling triggers (requests/sec, CPU, RAM)
- Physical server vs VM vs container vs FaaS cost/complexity tradeoffs
- Cache patterns: cache-aside, write-through, single shared cache

*Mock Interviews PDF:*
- Groups of ≤3 students, camera ON, recorded on Teams
- Rubric (informal for Week 1): showed up → code has small bugs but tried → code runs and answers questions clearly → code + answers + engages others → all of the above + asks good questions of peers
- Week 1 interview questions: (1) background + what you want from the course, (2) show HW1 code and explain what you found interesting, (3) ask the other people in your group a question
- Mock interviews are 1 hour per week, mandatory, described as "the most important part of the course"
- Piazza engagement (replies/questions) is visible and valued

*Day 8! Projects (Week 8) — Project guidance + schedule:*
- HW7 is team assignment (mock interview groups): each student gets own results, pool in shared report, each submits report
- Course schedule from Mar 9 onward: Mar 16 (Caching), Mar 23 (Testing and Async), Mar 30 (Data), Apr 6 (Observability!), Apr 13 (Presentations), Apr 20 (Final week), Done April 24
- Upcoming lecture: *Observability* (Week 11, Apr 6) — not yet posted as PDF
- Good project = sets you up for future, shows backend tradeoffs, AI-assisted coding/design, observability tools, teamwork
- Research Capstone summer opportunity mentioned (students from other universities too)

*Day 10 and the Changing World (Week 10 extra):*
- AI coding context: Anthropic uses AI for 70-90% of code, Google says AI writes half of all code
- Students must build evidence of their individual value as a contributor
- Fred Brooks "Mythical Man Month" — adding more programmers to a late project makes it later (mirrors Amdahl's Law)
- Opportunities mentioned: summer workshops, Research Capstone course, TAing

### HW Specs (GitHub — need token to read full content)
All specs live at: `github.khoury.northeastern.edu/mcoady/6650Spring2026`
- HW5 full spec — `Homework 5/` folder
- HW6 full spec — `Homework 6/` folder
- HW7 full spec — `Homework 7/Instructions.md`
- HW8 full spec — `Homework 8/instructions.md`
- HW9 full spec — `Homework 9/` folder
- HW10 full spec — not yet in repo (TBD)
- Midterm Mystery spec — `MidtermMystery/instructions.md`

## Course Schedule

- Class: Monday 1:00-3:00 PM Pacific, Room 1524 Vancouver / Room 318 Mills Hall Oakland (livestreamed between campuses)
- Homework cadence: 10 assignments across 14 weeks, due Monday 9:00 AM Pacific
- Mock interviews: weekly 1:1 with TA (Hazel Chen + Mansi Modi); rubric: Code Quality, Code Completion, Code Understanding, Listening/Engagement, Concepts/Tradeoffs — 2pts each
- Midterm mastery: Week 8 (15%)
- Final mastery: Week 13 (15%)
- Final project: Week 14 (20%) — poster, blog report/paper, code repo, presentation
- Course is 14 weeks
- Assessment: Homework 50% + Midterm/Final Masteries 30% + Final Project 20%
- Grading: A ≥93%, A- ≥90%, B+ ≥86%, B ≥82%, B- ≥77%, C+ ≥73%, C ≥69%, C- ≥65%, F <65%

### Syllabus Week-by-Week (due Monday 9AM)
| Week | Due | % | Topic |
|------|-----|---|-------|
| 1 | — | — | Introduction and Fundamentals |
| 2 | HW1 | 5% | Containers and Concurrency |
| 3 | HW2 | 5% | Architecture and Infrastructure |
| 4 | HW3 | 5% | Fundamentals of Distributed Systems |
| 5 | HW4 | 5% | Scalable Service Design |
| 6 | HW5 | 5% | Load Testing and Threads |
| 7 | HW6 | 5% | Project Proposals |
| 8 | Midterm Mastery | 15% | Tradeoffs in Scalability |
| 9 | HW7 | 5% | Asynchronous and Serverless Systems |
| 10 | HW8 | 5% | Deployment and Observability |
| 11 | HW9 | 5% | Replication, Partitioning, Consistency |
| 12 | HW10 | 5% | Tradeoffs with Data Storage |
| 13 | Final Mastery | 15% | Practical Considerations |
| 14 | Final Project | 20% | Poster, Presentation, Report |

Note: For exact due dates, use `canvas_query` with action "assignments" or "upcoming" — this is the authoritative source. Fall back to LeanRAG or assignment spec files only if Canvas is not configured. For submission status, use `canvas_query` with action "submissions".

## Reading Student Files

When a student sends an image, PDF, document, or sticker via WhatsApp, you receive a message like:
`[User sent a document (application/pdf). Use your Read tool to view: /workspace/ipc/media/filename.pdf]`

*You CAN and MUST read these files.* Use your Read tool on the provided path. It works for PDFs, images (PNG, JPG, WebP), Word docs, and more. NEVER say you cannot read a file — always try first. If the Read tool fails, THEN explain the issue.

When a student shares course materials (lecture slides, assignment specs, papers):
- Read the actual file. Base your response on what it contains.
- NEVER fabricate or guess the content of a file you haven't read. No "typical slide content", no "slides probably cover X". If you haven't read it, say so and read it.
- Reference specific content from the file: actual slide text, actual diagrams described, actual code shown.
