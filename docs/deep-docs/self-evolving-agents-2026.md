# Self-Evolving Agents: 2026 Findings

Source repo cloned at:

```txt
/Users/lana/Projects/ai-agent-papers
```

Primary source file:

```txt
capability-papers/self-evolution.md
```

Reviewed scope: March 2026 onward in the self-evolution/self-improvement section.

## High-Level Finding

The field is moving from simple memory accumulation toward managed evolution loops:

1. collect trajectories
2. extract memories or skills
3. evaluate proposed changes
4. activate only validated changes
5. retire stale or harmful changes
6. track longitudinal improvement and regressions

For this project, self-improvement should mean evaluated evolution of memory, skills, and harnesses, not uncontrolled self-modification.

## Concept Clusters

### Skill Discovery And Skill Libraries

Relevant papers:

- EvoSkill: Automated Skill Discovery for Multi-Agent Systems
- EvoSkills: Self-Evolving Agent Skills via Co-Evolutionary Verification
- SkillX: Automatically Constructing Skill Knowledge Bases for Agents
- SkillClaw: Let Skills Evolve Collectively with Agentic Evolver
- SkillOS: Learning Skill Curation for Self-Evolving Agents
- MUSE-Autoskill: Self-Evolving Agents via Skill Creation, Memory, Management, and Evaluation
- You Live More Than Once: Towards Hierarchical Skill Meta-Evolving

Design implication: represent user-facing routines as versioned skills. Examples: morning planning, evening reflection, blocker triage, weekly review, habit recovery, deep-work planning.

### Memory Evolution

Relevant papers:

- AutoAgent: Evolving Cognition and Elastic Memory Orchestration for Adaptive Agents
- Trajectory-Informed Memory Generation for Self-Improving Agent Systems
- Self-Evolving LLM Memory Extraction Across Heterogeneous Tasks
- Prism: An Evolutionary Memory Substrate for Multi-Agent Open-Ended Discovery
- EVOLVEMEM: Self-Evolving Memory Architecture via AutoResearch for LLM Agents
- EvoMemBench: Benchmarking Agent Memory from a Self-Evolving Perspective
- EXG: Self-Evolving Agents with Experience Graphs

Design implication: memory needs lifecycle management. Store raw events separately from distilled memories. Every distilled memory should have source links, confidence, scope, last-confirmed date, and retirement behavior.

### Harness And Workflow Evolution

Relevant papers:

- HARBOR: Automated Harness Optimization
- The Last Harness You'll Ever Build
- GraphMind: From Operational Traces to Self-Evolving Workflow Automation
- A Self-Evolving Framework for Efficient Terminal Agents via Observational Context Compression
- Co-Evolving LLM Decision and Skill Bank Agents for Long-Horizon Tasks

Design implication: prompts, tools, routing, evaluators, and workflow policies should be versioned as harness artifacts. The agent can propose harness changes, but production activation requires evaluation and rollback.

### Evaluation And Benchmarks

Relevant papers:

- SEA-Eval: A Benchmark for Evaluating Self-Evolving Agents Beyond Episodic Assessment
- Frontier-Eng: Benchmarking Self-Evolving Agents on Real-World Engineering Tasks with Generative Optimization
- HORIZONBENCH: Long-Horizon Personalization with Evolving Preferences
- EvoMemBench: Benchmarking Agent Memory from a Self-Evolving Perspective

Design implication: measure long-horizon usefulness, not just response quality. Track plan adherence, recommendation usefulness, memory correctness, goal progress, user-rated fit, and regressions.

### Safety, Deception, And Aging

Relevant papers:

- Evolving Deception: When Agents Evolve, Deception Wins
- Your Agents Are Aging Too: Agent Lifespan Engineering for Deployed Systems
- Ratchet: A Minimal Hygiene Recipe for Self-Evolving LLM Agents

Design implication: add hygiene from the beginning. Use active caps, retirement, validation, non-regression checks, and explicit approval for behavior changes.

## Popularity Notes

Popularity signals are weak because these papers are very recent.

- Semantic Scholar returned no citation data for the March-May 2026 arXiv IDs checked.
- The source list marks several benchmark papers with `⚖️`, but none in this range were marked `🔥`.
- Authenticated GitHub search found a strong outlier: `facebookresearch/HyperAgents`, 2,569 stars and 332 forks at the time of checking.
- Authenticated GitHub search did not find comparable public repos for Ratchet, EvoSkill, The Last Harness You'll Ever Build, HARBOR, EVOLVEMEM, GraphMind, EXG, HORIZONBENCH, or SkillOS.

See `hyperagents-assessment.md` for the focused assessment.

## Papers Most Relevant To This Project

1. Ratchet: A Minimal Hygiene Recipe for Self-Evolving LLM Agents
2. HORIZONBENCH: Long-Horizon Personalization with Evolving Preferences
3. Trajectory-Informed Memory Generation for Self-Improving Agent Systems
4. EVOLVEMEM: Self-Evolving Memory Architecture via AutoResearch for LLM Agents
5. EXG: Self-Evolving Agents with Experience Graphs
6. HARBOR: Automated Harness Optimization
7. The Last Harness You'll Ever Build
8. EvoSkill: Automated Skill Discovery for Multi-Agent Systems
9. SkillOS: Learning Skill Curation for Self-Evolving Agents
10. Your Agents Are Aging Too: Agent Lifespan Engineering for Deployed Systems

## Product Hypothesis

A personal improvement agent can become meaningfully better if it improves through explicit, evaluated artifacts:

- memories: what is true about the user
- skills: reusable routines that help the user
- harnesses: orchestration logic for when/how to use skills and memory
- evaluators: rubrics that judge whether changes actually helped

The product should feel like a coach, but the system should behave like a versioned experimental platform.

## Reference Paper Map For Lares

Use these papers as architectural references rather than direct implementation dependencies:

- HyperAgents: archive of variants, parent selection, meta-agent/task-agent separation, evaluation before activation, and cross-run improvement of the improvement process.
- Ratchet: hygiene rules for self-evolving agents, including caps, retirement, validation, non-regression checks, and explicit approval for behavior changes.
- HORIZONBENCH: long-horizon personalization evaluation across changing user preferences, not just one-shot answer quality.
- Trajectory-Informed Memory Generation: deriving useful memories from interaction trajectories and outcomes, not generic summaries.
- EVOLVEMEM: evolving memory architecture and extraction policies over time.
- EXG: experience graphs for connecting events, decisions, people, goals, outcomes, and lessons.
- HARBOR: automated harness optimization for prompts, tools, routing, evaluators, and workflow policies.
- The Last Harness You'll Ever Build: treating the agent harness as a versioned artifact that can evolve rather than a static prompt stack.
- EvoSkill and EvoSkills: discovering reusable skills from repeated tasks and validating them through co-evolutionary checks.
- SkillOS: curating skills by keeping, merging, retiring, or activating them based on usefulness.
- Your Agents Are Aging Too: lifecycle management for stale or harmful agents, memories, skills, and policies.
- Evolving Deception: warning that weak evaluations can select for deceptive or reward-hacking behavior.

Design grouping:

- Memory evolution: Trajectory-Informed Memory Generation, EVOLVEMEM, EXG, EvoMemBench.
- Skill evolution: EvoSkill, EvoSkills, SkillOS, MUSE-Autoskill, SkillClaw.
- Harness and workflow evolution: HyperAgents, HARBOR, The Last Harness You'll Ever Build, GraphMind.
- Safety and evaluation: Ratchet, HORIZONBENCH, SEA-Eval, Your Agents Are Aging Too, Evolving Deception.

Practical takeaway:

```txt
Lares = memory + skills + harnesses + evaluators, all versioned and lifecycle-managed
```

## Updated Recommendation After HyperAgents Review

Do not build directly on HyperAgents. It is a research runner for generated-code evolution, not a Cloudflare app framework, and its license is non-commercial.

Use its ideas:

- archive of variants
- parent selection
- meta-agent/task-agent separation
- evaluation before activation
- cross-run improvement of the improvement process

Combine those with Ratchet-style hygiene and Cloudflare's durable runtime.
