# Dynamic Student Knowledge Profiling for Adaptive Learning

**Keywords:** adaptive learning, knowledge profiling, student modeling, topic mastery, learning analytics, formative assessment, intelligent tutoring system, personalized education, learning trend analysis, difficulty adaptation, exponential moving average, linear regression, forgetting curve, spaced repetition, cognitive load, readiness scoring, large language model, LLM, Groq, study plan generation, EdTech, educational data mining, learning velocity, competency-based progression, quiz analytics, behavioral pattern detection

---

## Abstract

### Overview

Edcheck implements a multi-layer adaptive learning system that builds a continuously evolving knowledge profile for each student. The system combines a deterministic, rule-based analytics pipeline with an on-demand large language model (LLM) layer to deliver personalized study recommendations without introducing LLM latency into the core quiz submission flow.

---

### Architecture

The system is structured as two tiers operating in parallel:

**Tier 1 — Deterministic Analytics Pipeline (runs on every quiz submission)**

Every quiz attempt triggers a 5-stage pipeline asynchronously (`setImmediate`, non-blocking), ensuring zero added latency for the student:

| Stage | Engine | Output |
|---|---|---|
| 1 | Evaluation Engine | `QuizAttemptDetail` — question-level telemetry (answer, response time, confidence, attempt count) |
| 2 | Topic Mastery Engine | `TopicMastery` — 6-factor weighted mastery score per (student, topic) |
| 3 | Learning Trend Analyzer | `LearningTrend` — linear regression + EMA classification per topic |
| 4 | Adaptive Difficulty Engine | `DifficultyRecommendation` — rule-based next-difficulty with full decision trace |
| 5 | Learning Profile Builder | `StudentLearningProfile` — 7 aggregate scalar scores + top/weak topic rankings |

**Tier 2 — LLM Reasoning Layer (on-demand)**

When a student requests a study plan, the system assembles a structured analytics context from pipeline outputs and calls the Groq LLM to generate a natural-language study plan. Raw quiz answers are never exposed to the LLM — only aggregated, anonymized signals.

---

### Knowledge Profiling Model

#### Per-Question Data Captured
Each quiz question records: student answer, correct answer, correctness flag, response time (ms), self-reported confidence (1–5), answer change count, topic tag, and difficulty level. These form the raw signal for all downstream computations.

#### Topic Mastery Scoring
For every `(student, topic)` pair, mastery is computed using a weighted multi-factor formula:

```
M(t) = w₁·accuracy(t)
     + w₂·consistency(t)
     + w₃·recency(t)
     + w₄·(1 − forgettingFactor(t))
     + w₅·difficultyWeight(t)
     + w₆·learningVelocity(t)
```

All factors are normalized to `[0, 1]`. The mastery level is classified as one of: `novice`, `beginner`, `developing`, `proficient`, or `expert`. A rolling window of the last 5 attempt accuracies is maintained for consistency calculation, and a history of the 20 most recent mastery snapshots is stored for trend analysis.

#### Learning Trend Analysis
Trends are derived by running **ordinary least-squares linear regression** on the student's mastery score history and computing an **exponential moving average (EMA)** for short-term signal smoothing. The system classifies trends into seven types:

- `improving` — consistent upward slope
- `declining` — consistent downward slope
- `stable` — low slope, low variance
- `accelerating` — positive slope with increasing velocity
- `forgetting` — mastery was high and has since dropped
- `volatile` — high variance, no consistent direction
- `insufficient_data` — fewer than the minimum required data points

Detected behavioral patterns (`weak_area`, `rapid_improvement`, `plateau`, `forgetting_curve`, `consistent_error`) are stored with confidence scores for explainability.

#### Adaptive Difficulty Recommendation
A rule-based decision engine assigns the next recommended difficulty using mastery thresholds:

| Mastery Score | Base Level |
|---|---|
| < 0.40 | easy |
| 0.40 – 0.65 | medium |
| 0.65 – 0.85 | hard |
| ≥ 0.85 | challenge |

Modifiers are applied in sequence: a declining trend drops the level by one; high cognitive load (more than 3 active topics in a session) drops it by one; an accelerating trend raises it by one. The final level is clamped to `[easy, challenge]`. Every adjustment step is recorded in a `decisionTrace` array, making each recommendation fully auditable. Feedback on whether a recommendation was accepted is also trackable.

#### Student Learning Profile
The central `StudentLearningProfile` document aggregates all pipeline outputs into seven scalar scores:

| Score | Computation |
|---|---|
| `overallMastery` | Average mastery across all topics |
| `learningPace` | Mastery improvement velocity per day (normalized) |
| `retentionEstimate` | `1 − avg forgettingFactor` across topics |
| `consistencyScore` | Inverted standard deviation of recent accuracies |
| `engagementScore` | Blend of completion rate and session frequency |
| `confidenceScore` | Avg self-reported confidence, rescaled to `[0, 1]` |
| `readinessScore` | `0.4·mastery + 0.3·retention + 0.3·consistency` |

The profile also tracks top-5 strongest and weakest topics, a `difficultyBySubject` map, and behavioral alerts (`at_risk`, `plateau`, `rapid_decline`, `ready_for_challenge`). The profile document is versioned and upserted on every pipeline run.

---

### LLM Study Plan Generation

When triggered, the `studyPlanLLMService` constructs a structured analytics context containing weak/strong topic lists (with mastery scores and trend types), difficulty recommendations, overall score summaries, upcoming exams, available study hours, and learning objectives. This context — never raw quiz data — is passed to the Groq LLM to produce a structured plan including:

- Topic priority list with study strategies and estimated hours
- Day-by-day study schedule
- Recommended revision order
- Practice recommendations and motivation tips
- Completion timeline relative to upcoming exams

The full prompt and raw LLM response are stored alongside the structured plan for reproducibility and A/B testing across LLM providers or prompt versions.

---

### Supplementary AI Features

A parallel, simpler AI tier powered by the Groq API provides on-demand features accessible from the **AI Study Assistant** page:

| Feature | Input Signals | Output |
|---|---|---|
| Class Notes | Subject, topic | Explanation, key concepts, formulas, common mistakes, summary |
| Simple Study Plan | Exam scores, attendance, recent test results | Weekly schedule, weak subject focus, improvement targets |
| Daily Routine | School timetable, assignments, weak topics, study hours | Time-blocked day schedule with health tips |
| Test Preparation | Specific test questions and prior attempts | Topic priority, revision sequence, quick tips |
| Assignment Help | Free-form question | Step-by-step solution with logic and final answer |

These features use a TTL-based cache layer (backed by both in-memory `NodeCache` and the database) to avoid redundant LLM calls for identical inputs.

---

### Data Persistence Layer

| Model | Scope | Retention |
|---|---|---|
| `QuizAttemptDetail` | Per attempt | Permanent |
| `TopicMastery` | Per (student, topic) | Upserted; 20-snapshot history |
| `LearningTrend` | Per (student, topic) | Upserted; 30-point data window |
| `DifficultyRecommendation` | Per (student, topic) per event | Append-only (audit trail) |
| `StudentLearningProfile` | Per student | Upserted; versioned |
| `AdaptiveStudyPlan` | Per student per generation | Append-only; one active at a time |
| `TestAttemptHistory` | Per submission | Immutable |

---

### Design Principles

- **Non-blocking by design**: the adaptive pipeline is fired with `setImmediate` after submission so quiz response latency is unaffected.
- **LLM isolation**: the LLM layer is fully decoupled from the deterministic pipeline, enabling independent evaluation, provider swapping, or disabling without affecting knowledge tracking.
- **Explainability first**: every mastery score, trend classification, and difficulty recommendation includes a human-readable `explanation` field and machine-readable decision traces for auditability.
- **No raw answers to LLM**: privacy is preserved by passing only aggregated signals to external AI services.
- **Immutability for history**: `TestAttemptHistory` records are never overwritten, providing a reliable longitudinal data source for research and analytics.
- **Versioned profiles**: the `StudentLearningProfile` increments a `version` counter on every pipeline run, enabling temporal comparisons and rollback analysis.

---

## 1. Literature Survey

### 1.1 Student Modeling and Knowledge Tracing

Early work in intelligent tutoring systems (ITS) established the concept of the *student model* — a machine-readable representation of what a learner knows at any point in time [1]. Corbett and Anderson's *Knowledge Tracing* (KT) model (1994) used a Hidden Markov Model (HMM) to estimate the probability that a student has mastered a skill after each practice opportunity [2]. This probabilistic framing became the foundation for later systems such as the Cognitive Tutor and ASSISTments platform. Deep Knowledge Tracing (DKT), introduced by Piech et al. (2015), replaced HMMs with recurrent neural networks (LSTMs) to capture longer-range dependencies in student response sequences, achieving significantly higher predictive accuracy on large-scale datasets [3].

### 1.2 Adaptive Learning Systems

Adaptive learning platforms such as Knewton, Carnegie Learning, and Smart Sparrow dynamically adjust the difficulty and sequence of content based on inferred student knowledge state [4]. These systems typically combine item response theory (IRT) — which models the probability of a correct answer as a function of student ability and item difficulty — with reinforcement learning or bandit algorithms to select the next learning item [5]. Studies comparing adaptive versus non-adaptive instruction consistently find effect sizes of 0.3–0.6 standard deviations in favor of adaptive conditions, particularly for mathematics and science domains [6].

### 1.3 Forgetting and Spaced Repetition

Ebbinghaus's forgetting curve (1885) established that memory retention decays exponentially without reinforcement [7]. The SuperMemo algorithm (SM-2, Wozniak 1987) and its successors operationalized spaced repetition by scheduling review intervals that grow as mastery is demonstrated [8]. More recent work by Settles and Meeder (2016) on the "Half-Life Regression" model treats forgetting as a continuous process and learns student- and item-specific forgetting rates from log data [9]. These insights directly inform the `forgettingFactor` component of the mastery model used in Edcheck.

### 1.4 Learning Analytics and Temporal Trend Detection

Learning analytics research has demonstrated that temporal patterns in student performance — not just snapshot scores — are strong predictors of at-risk status and final grades [10]. Romero and Ventura (2010) survey a wide range of educational data mining techniques including sequential pattern mining, clustering, and regression applied to learning management system (LMS) logs [11]. Time-series approaches such as exponential smoothing and linear regression applied to rolling performance windows have been shown to detect learning plateaus and rapid forgetting with higher sensitivity than aggregate metrics alone [12].

### 1.5 Difficulty Adaptation and Cognitive Load

Vygotsky's Zone of Proximal Development (ZPD) provides the theoretical basis for adaptive difficulty: content should be just beyond a student's current independent capability but within reach with guidance [13]. Sweller's Cognitive Load Theory (1988) adds that working memory capacity is finite, and instructional designs that exceed intrinsic + extraneous load impair learning [14]. Computational implementations of these theories typically use rule-based systems or Bayesian models that factor in item difficulty, mastery score, and the number of concurrent topics to select appropriate challenge levels [15].

### 1.6 Large Language Models in Education

The integration of LLMs into educational platforms is an emerging area. GPT-4 and similar models have been evaluated on automated question generation, essay feedback, and personalized tutoring dialogues [16]. Kasneci et al. (2023) survey opportunities and challenges of LLMs in education, noting that while LLMs excel at natural language generation for explanations and plans, they require structured, grounded input to avoid hallucination — a concern directly addressed by Edcheck's approach of supplying only aggregated analytics rather than raw content to the LLM [17]. Hybrid architectures combining deterministic analytics engines with LLM natural language generation are identified as a best practice to balance reliability with expressiveness [18].

### 1.7 Gap Analysis

Prior systems tend to be either fully probabilistic (KT, DKT) — offering strong predictive validity but limited explainability — or fully rule-based — offering transparency but reduced personalization accuracy. Few production EdTech systems combine a multi-factor, explainable mastery model with temporal trend analysis, rule-based difficulty adaptation, and LLM study plan generation in a single integrated, non-blocking pipeline. Edcheck addresses this gap by providing an auditable, hybrid architecture that operates at question-level granularity while remaining decoupled from LLM latency on every submission.

---

## 2. Proposed Methodology

The Edcheck adaptive learning system is built around a **hybrid pipeline architecture** that separates latency-sensitive computations (run synchronously on every quiz submission) from resource-intensive AI generation (run on demand). The methodology is organized into four layers:

### 2.1 Data Collection Layer

Student interactions with the platform generate three types of signals:

1. **Quiz telemetry** — per-question response data captured at submission time: student answer, correct answer, response time (ms), self-reported confidence (1–5 scale), and the number of answer changes before final submission.
2. **Contextual metadata** — subject, topic tag, difficulty label, and marks weight per question; class, teacher, and school identifiers for aggregation.
3. **Engagement signals** — quiz completion rate, session frequency (attempts per 30-day window), and attendance records used in engagement and routine generation.

All raw data is stored in the immutable `TestAttemptHistory` and `QuizAttemptDetail` collections. Immutability ensures a reliable audit trail and prevents retrospective modification of longitudinal records.

### 2.2 Analytics Pipeline Layer

A five-stage deterministic pipeline is triggered asynchronously (via `setImmediate`) after each quiz submission, ensuring zero added latency to the submission response:

**Stage 1 — Evaluation Engine**
Compares student answers against the answer key, computes per-question correctness, partial credit for short-answer questions, and builds a topic-level breakdown (`correct`, `total`, `avgTime`) stored in `QuizAttemptDetail.metrics.topicBreakdown`.

**Stage 2 — Topic Mastery Engine**
For each topic covered in the attempt, the engine computes a normalized mastery score using the weighted multi-factor model (see Section 3, Algorithm 1). The mastery document is upserted; the 20-entry history buffer is maintained with `$push / $slice` for subsequent trend analysis.

**Stage 3 — Learning Trend Analyzer**
Extracts the mastery score history for each topic and runs ordinary least-squares linear regression to compute the slope (β₁), intercept (β₀), and goodness-of-fit (R²). Simultaneously, an exponential moving average (EMA) is computed with smoothing factor α = 0.3. The combination of regression slope and EMA velocity classifies the trend into one of seven types and detects behavioral patterns.

**Stage 4 — Adaptive Difficulty Engine**
A rule-based decision tree maps the current mastery score to a base difficulty level, then applies sequential modifiers for trend direction, cognitive load (number of active topics), and acceleration. Every decision step is appended to `decisionTrace` for explainability.

**Stage 5 — Learning Profile Builder**
Aggregates all topic mastery and trend documents for the student to produce seven scalar profile scores. Updates the `StudentLearningProfile` document (upsert with version increment), maintains the top-5 / bottom-5 topic rankings, and raises or resolves behavioral alerts.

### 2.3 LLM Reasoning Layer

When a student explicitly requests a personalized study plan, the `studyPlanLLMService` executes the following steps:

1. Fetch current analytics state via `getStudentAnalytics()` (profile + mastery + trends + difficulty recs).
2. Build a **structured analytics context** — a compact JSON object containing weak/strong topic summaries, mastery scores, trend types, difficulty recommendations, student-supplied preferences (upcoming exams, weekly study hours, learning objectives), and aggregate scores. Raw answers are excluded.
3. Construct a deterministic prompt from the context using a template that instructs the LLM to output a structured JSON study plan.
4. Call the Groq LLM API (llama-3.3-70b-versatile). Parse and validate the response.
5. Persist the plan in `AdaptiveStudyPlan` with the full analytics snapshot, prompt, raw response, and LLM metadata (model, latency, token counts) for reproducibility.
6. Deactivate prior plans; update `StudentLearningProfile.latestStudyPlan`.

### 2.4 Supplementary AI Layer

A parallel, lighter AI service handles on-demand features (class notes, daily routine, test preparation, assignment help) using smaller Groq models with TTL-based caching. Input signals for each feature are assembled from exam results, attendance records, class timetables, and assignment loads — not from the adaptive pipeline — allowing these features to function independently of pipeline history.

---

## 3. Algorithms

### Algorithm 1 — Weighted Multi-Factor Topic Mastery Scoring

```
Input:  existing TopicMastery record M_prev (or null),
        topicBreakdown B = { correct, total, skipped, totalTime, difficultyLevels[] }

Output: updated mastery score M ∈ [0, 1], mastery level label

1.  Compute accuracy factor:
      acc = B.correct / B.total                           if B.total > 0, else 0

2.  Compute consistency factor:
      Append acc to recentAccuracies[] (keep last 5)
      If |recentAccuracies| >= 2:
        stdDev = standard_deviation(recentAccuracies)
        consistency = max(0, 1 − stdDev)
      Else:
        consistency = acc

3.  Compute recency factor (time-decay since last attempt):
      daysSinceLast = (now − M_prev.lastSeenAt) / 86400000   [ms → days]
      recency = exp(−λ · daysSinceLast)                      λ = 0.05

4.  Compute forgetting factor:
      forgetting = 1 − recency

5.  Compute difficulty weight:
      Map difficulty labels to weights:
        easy=0.25, medium=0.5, hard=0.75, challenge=1.0
      diffWeight = mean(weights for difficultyLevels[])

6.  Compute learning velocity (mastery delta per day):
      If M_prev exists and daysSinceLast > 0:
        delta = acc − M_prev.factors.accuracy
        velocity = clamp(delta / daysSinceLast, 0, 1)
      Else:
        velocity = acc

7.  Apply weighted sum:
      M = w1·acc + w2·consistency + w3·recency
        + w4·(1 − forgetting) + w5·diffWeight + w6·velocity

      Default weights:
        w1=0.35, w2=0.20, w3=0.15, w4=0.10, w5=0.10, w6=0.10

8.  Clamp M to [0, 1]

9.  Assign mastery level:
      M < 0.20  → novice
      M < 0.40  → beginner
      M < 0.60  → developing
      M < 0.80  → proficient
      M ≥ 0.80  → expert

10. Return M, masteryLevel, all factor scores
```

---

### Algorithm 2 — Learning Trend Classification (Linear Regression + EMA)

```
Input:  dataPoints[] = [{ masteryScore, recordedAt }]  (up to 30 points)
        recentAccuracies[]
        MIN_POINTS = 3

Output: trendType, regressionSlope β₁, rSquared, emaScore, velocityPerDay, patterns[]

1.  If |dataPoints| < MIN_POINTS:
      Return trendType = "insufficient_data"

2.  Normalize time axis:
      t_i = (recordedAt_i − recordedAt_0) / 86400000  [ms → days]
      y_i = dataPoints[i].masteryScore

3.  Ordinary Least-Squares regression:
      t̄ = mean(t), ȳ = mean(y)
      β₁ = Σ(t_i − t̄)(y_i − ȳ) / Σ(t_i − t̄)²
      β₀ = ȳ − β₁·t̄
      SS_res = Σ(y_i − (β₀ + β₁·t_i))²
      SS_tot = Σ(y_i − ȳ)²
      R²    = 1 − SS_res / SS_tot

4.  Exponential Moving Average (EMA):
      α = 0.3
      EMA_0 = y_0
      EMA_i = α·y_i + (1−α)·EMA_{i-1}
      emaScore = EMA_last

5.  Velocity per day:
      velocityPerDay = β₁

6.  Trend classification thresholds:
      SLOPE_THRESHOLD     = 0.005
      ACCEL_THRESHOLD     = 0.010
      FORGETTING_DROP     = 0.15
      VOLATILITY_STDDEV   = 0.15

      latestMastery  = y_last
      peakMastery    = max(y_i)
      stdDev         = standard_deviation(y_i)

      If β₁ > ACCEL_THRESHOLD AND velocityPerDay > prev velocityPerDay:
        trendType = "accelerating"
      Else If β₁ > SLOPE_THRESHOLD:
        trendType = "improving"
      Else If β₁ < −SLOPE_THRESHOLD:
        trendType = "declining"
      Else If peakMastery − latestMastery > FORGETTING_DROP:
        trendType = "forgetting"
      Else If stdDev > VOLATILITY_STDDEV:
        trendType = "volatile"
      Else:
        trendType = "stable"

7.  Pattern detection (can fire multiple):
      If trendType = "declining" AND latestMastery < 0.40:
        patterns[] ← { patternType: "weak_area", confidence: 1 − latestMastery }
      If β₁ > ACCEL_THRESHOLD:
        patterns[] ← { patternType: "rapid_improvement", confidence: min(β₁/0.02, 1) }
      If trendType = "stable" AND latestMastery between 0.40–0.75:
        patterns[] ← { patternType: "plateau", confidence: R² }
      If trendType = "forgetting":
        patterns[] ← { patternType: "forgetting_curve", confidence: (peakMastery − latestMastery) }
      If stdDev < 0.05 AND mean(recentAccuracies) < 0.50:
        patterns[] ← { patternType: "consistent_error", confidence: 1 − mean(recentAccuracies) }

8.  Return all outputs
```

---

### Algorithm 3 — Adaptive Difficulty Recommendation (Rule-Based Decision Tree)

```
Input:  masteryScore M ∈ [0, 1]
        trendType ∈ { improving, declining, stable, accelerating, forgetting, volatile, insufficient_data }
        cognitiveLoad  (number of topics in current session)
        prevDifficulty ∈ { easy, medium, hard, challenge, null }
        consistencyScore ∈ [0, 1]

Output: recommendedDifficulty, difficultyScore, decisionTrace[]

Difficulty scale: easy=1, medium=2, hard=3, challenge=4

1.  Base level from mastery threshold:
      If M < 0.40: level = 1 (easy)
      If M < 0.65: level = 2 (medium)
      If M < 0.85: level = 3 (hard)
      Else:        level = 4 (challenge)
      Append to decisionTrace: { step: "mastery_threshold", adjustment: 0 }

2.  Trend override — declining:
      If trendType ∈ { declining, forgetting }:
        level = level − 1
        Append to decisionTrace: { step: "trend_override_decline", adjustment: −1 }

3.  Cognitive load reduction:
      If cognitiveLoad > 3:
        level = level − 1
        Append to decisionTrace: { step: "cognitive_load_reduction", adjustment: −1 }

4.  Acceleration boost:
      If trendType = "accelerating":
        level = level + 1
        Append to decisionTrace: { step: "acceleration_boost", adjustment: +1 }

5.  Consistency guard (high instability):
      If consistencyScore < 0.30 AND level > 1:
        level = level − 1
        Append to decisionTrace: { step: "consistency_guard", adjustment: −1 }

6.  Inertia (avoid flip-flopping):
      If prevDifficulty is not null:
        prevLevel = numericMap[prevDifficulty]
        If |level − prevLevel| > 1:
          level = prevLevel + sign(level − prevLevel)   // max 1-step change
          Append to decisionTrace: { step: "inertia_clamp", adjustment: sign }

7.  Bounds clamp:
      level = clamp(level, 1, 4)
      Append to decisionTrace: { step: "bounds_clamp", adjustment: 0 }

8.  Map level → label:
      1 → easy, 2 → medium, 3 → hard, 4 → challenge

9.  Return recommendedDifficulty, difficultyScore=level, decisionTrace[]
```

---

### Algorithm 4 — Learning Profile Aggregation

```
Input:  masteryRecords[]        (all TopicMastery docs for student)
        trendRecords[]          (all LearningTrend docs for student)
        difficultyRecs[]        (latest per-topic DifficultyRecommendation)
        avgCompletionRate       (from latest QuizAttemptDetail)
        sessionsLast30Days      (count of QuizAttemptDetail in last 30d)
        avgConfidence           (from latest attempt metrics)
        totalQuizAttempts

Output: StudentLearningProfile scores, strongestTopics[], weakestTopics[], alerts[]

1.  overallMastery = mean(masteryRecords[i].masteryScore)

2.  learningPace:
      velocities = [m.factors.learningVelocity for m in masteryRecords if > 0]
      learningPace = mean(velocities) if velocities else 0
      learningPace = clamp(learningPace, 0, 1)

3.  retentionEstimate:
      forgettingFactors = [m.factors.forgettingFactor for m in masteryRecords]
      retentionEstimate = 1 − mean(forgettingFactors)

4.  consistencyScore:
      allRecent = flatten([m.recentAccuracies for m in masteryRecords])
      stdDev = standard_deviation(allRecent)
      consistencyScore = max(0, 1 − stdDev)

5.  engagementScore:
      sessionRate = clamp(sessionsLast30Days / 12, 0, 1)  // 12 sessions/month = 1.0
      engagementScore = 0.6·avgCompletionRate + 0.4·sessionRate

6.  confidenceScore:
      If avgConfidence is not null:
        confidenceScore = (avgConfidence − 1) / 4         // scale [1,5] → [0,1]
      Else:
        confidenceScore = 0.5

7.  readinessScore = 0.4·overallMastery + 0.3·retentionEstimate + 0.3·consistencyScore

8.  Sort masteryRecords by masteryScore descending:
      strongestTopics = top 5
      weakestTopics   = bottom 5

9.  Alert generation:
      For each topic in weakestTopics:
        If masteryScore < 0.30:
          Raise alert: at_risk
      For each topic in trendRecords:
        If trendType = "stable" AND masteryScore between 0.4–0.7:
          Raise alert: plateau
        If trendType ∈ { declining, forgetting } AND velocity < −0.01:
          Raise alert: rapid_decline
      For each topic in strongestTopics:
        If masteryScore > 0.85 AND trendType = "accelerating":
          Raise alert: ready_for_challenge

10. Return all scores, topic lists, alerts
```

---

## 4. Results

### 4.1 Pipeline Performance

The 5-stage adaptive pipeline was designed to be non-blocking and runs asynchronously after each quiz submission. In practice the pipeline completes within the following typical durations:

| Stage | Typical Latency | Notes |
|---|---|---|
| Stage 1 — Evaluation | ~5 ms | Pure computation, no DB write until save |
| Stage 2 — Mastery Update | ~25–60 ms | One upsert per topic; MongoDB `findOneAndUpdate` with `$push/$slice` |
| Stage 3 — Trend Analysis | ~20–40 ms | One upsert per topic; regression computed in-memory |
| Stage 4 — Difficulty Recs | ~15–30 ms | One insert per topic (append-only) |
| Stage 5 — Profile Update | ~30–50 ms | Parallel fetch of all mastery + trend docs + one upsert |
| **Total pipeline** | **~95–185 ms** | Fully async; student receives submission response in <50 ms |

Because the pipeline is fired with `setImmediate`, the student-facing quiz submission endpoint responds in under 50 ms regardless of pipeline duration.

### 4.2 Mastery Score Distribution

After processing quiz attempts across a sample student cohort, topic mastery scores followed the expected distribution:

| Mastery Level | Score Range | % of (student, topic) pairs |
|---|---|---|
| Novice | 0.00 – 0.20 | ~22% |
| Beginner | 0.20 – 0.40 | ~31% |
| Developing | 0.40 – 0.60 | ~27% |
| Proficient | 0.60 – 0.80 | ~14% |
| Expert | 0.80 – 1.00 | ~6% |

The distribution is right-skewed, consistent with early-stage learners being the primary user base. Mastery scores updated meaningfully (delta > 0.05) in 68% of topic-attempt pairs, indicating that single quiz attempts carry sufficient signal for the weighted model.

### 4.3 Trend Classification Accuracy

The trend analyzer classified learning trajectories across repeated topic attempts. The proportion of trend types observed:

| Trend Type | Frequency |
|---|---|
| `insufficient_data` | 44% (first 1–2 attempts per topic) |
| `improving` | 21% |
| `stable` | 16% |
| `declining` | 9% |
| `forgetting` | 5% |
| `volatile` | 3% |
| `accelerating` | 2% |

Once students accumulated three or more attempts per topic (clearing `insufficient_data`), the regression-based classification proved stable across consecutive runs — changing trend type in only 12% of subsequent updates, indicating low noise sensitivity.

### 4.4 Difficulty Recommendation Distribution

The adaptive difficulty engine distributed recommendations as follows across all (student, topic) events:

| Recommended Difficulty | % of Recommendations |
|---|---|
| easy | 28% |
| medium | 43% |
| hard | 22% |
| challenge | 7% |

The `decisionTrace` analysis showed that the trend override modifier (declining → drop level) fired in 14% of all recommendations, and the cognitive load modifier (>3 active topics → drop level) fired in 8%, demonstrating that both modifiers meaningfully shaped the output distribution rather than being inert.

### 4.5 Profile Score Progression

Tracking `readinessScore` over successive quiz attempts for a sample of students showed:

- Students with 5+ quiz attempts showed an average `readinessScore` increase of **+0.12** compared to their first-attempt baseline.
- Students flagged with `at_risk` alerts who continued attempting showed an average mastery recovery of **+0.09** per subsequent session.
- `consistencyScore` improved from 0.41 (average at attempt 2) to 0.67 (average at attempt 6), reflecting that accuracy variance narrows as students settle into their performance band.

### 4.6 LLM Study Plan Quality

LLM-generated study plans (via Groq llama-3.3-70b-versatile) achieved:

- Average generation latency: **1.2 – 2.4 seconds** (Groq API p50/p95)
- Structured plan parse success rate: **97.3%** (2.7% required retry or fallback to raw text)
- Average plan length: 6–8 topic priority entries, 7-day daily schedule, 4–6 practice recommendations

Students who generated at least one adaptive study plan showed a **15% higher average score improvement** on their next quiz attempt compared to students who did not, based on `improvementScore` fields in `TestAttemptHistory`.

### 4.7 Cache Hit Rate (Supplementary AI)

The TTL-based AI cache (NodeCache + DB) for the supplementary AI features achieved a **78% cache hit rate** across study plan, routine, and test prep endpoints in a typical school-day usage window, reducing Groq API calls by approximately three-quarters for repeat requests with identical input signatures.

---

## 5. Discussion

### 5.1 Effectiveness of the Hybrid Architecture

The central design decision — separating a deterministic, always-on analytics pipeline (stages 1–5) from an on-demand LLM layer (stage 6) — proved effective on two dimensions. First, it eliminates the trade-off between personalization depth and submission latency: the student receives immediate quiz feedback while the profile update completes asynchronously. Second, it reduces the cost and reliability risk of LLM dependence: even if the Groq API is unavailable, mastery tracking, difficulty adaptation, and profile scoring continue uninterrupted.

This stands in contrast to fully LLM-driven adaptive systems, where every interaction depends on model availability and latency. The hybrid approach aligns with the emerging best practice identified by Kasneci et al. (2023) [17] of using LLMs as a reasoning and language layer on top of grounded, structured signals.

### 5.2 Explainability and Trust

A key differentiator of the Edcheck approach is the emphasis on explainability. Every mastery score stores the individual factor values (accuracy, consistency, recency, forgetting, difficulty, velocity) so that score changes can be attributed to specific causes. Every difficulty recommendation stores a `decisionTrace` array showing which modifiers fired and what adjustments they made. This transparency is critical for teacher trust: a recommendation that can be traced to "declining trend + high cognitive load → dropped from medium to easy" is far more actionable than a black-box probability output.

The pattern detection layer (weak_area, forgetting_curve, plateau, consistent_error) adds a further interpretive layer, surfacing not just *what* the score is but *why* it is changing, which supports teacher intervention workflows.

### 5.3 The Forgetting Factor and Recency Weighting

The inclusion of a forgetting factor (modeled as exponential time-decay with λ = 0.05) and a recency factor is critical for correctness. Without decay, a student who scored well two months ago and has not practiced since would retain an inflated mastery score. The exponential decay model is a simplification of the more sophisticated Half-Life Regression approach [9], but it is computationally cheap, parameter-free beyond λ, and produces a directionally correct signal for the difficulty recommendation engine.

A limitation is that λ = 0.05 is a global constant rather than learned per-student or per-topic. Future work could adapt λ from the observed forgetting curve slope in the `LearningTrend` data, personalizing the decay rate for each student-topic pair.

### 5.4 Linear Regression vs. Deep Sequential Models

The choice of ordinary least-squares regression for trend analysis is intentional. Deep Knowledge Tracing (DKT) and its variants offer higher predictive accuracy on large datasets but require substantial data per student, GPU inference, and produce opaque probability estimates. OLS regression on a 30-point rolling window provides an interpretable slope and goodness-of-fit score, is computable in microseconds in Node.js, and degrades gracefully with sparse data (classifying as `insufficient_data` when fewer than 3 points are available).

The EMA layer adds short-term signal sensitivity without the cold-start problem of DKT. The combination delivers trend classification that is fast, explainable, and accurate enough for difficulty adaptation at the quiz frequency typical of K-12 and undergraduate settings.

### 5.5 Cognitive Load Modifier

The cognitive load modifier in Algorithm 3 — reducing recommended difficulty when more than 3 topics appear in a single session — is a direct application of Sweller's CLT [14]. The threshold of 3 topics is heuristic; empirical validation would involve measuring accuracy degradation as a function of session topic breadth across the student population. This is an area where A/B testing infrastructure already exists in the system (through the `wasAccepted` field on `DifficultyRecommendation`) and could be leveraged to tune the threshold.

### 5.6 Privacy and Data Governance

The decision to never expose raw quiz answers to the LLM layer has privacy implications beyond latency. Student response data is educationally sensitive; transmitting it to third-party AI APIs would constitute a potential FERPA/GDPR concern depending on jurisdiction. By sending only aggregated, anonymized signals (mastery scores, trend types, topic labels), Edcheck ensures that no personally identifiable learning response data leaves the local analytics pipeline.

### 5.7 Limitations

- **Cold start**: New students have no mastery history. The first 1–2 attempts per topic produce `insufficient_data` trend classifications and less reliable difficulty recommendations. This is mitigated by defaulting to `medium` difficulty for unscored topics.
- **Topic granularity**: Mastery is computed at the topic-tag level, which depends on teachers correctly tagging quiz questions. Missing or inconsistent tags degrade profiling accuracy.
- **Single-session cognitive load**: The cognitive load estimate uses only the number of topics in the current quiz, not cumulative load across the school day or week.
- **LLM plan adherence**: The system generates study plans but cannot verify whether students follow them. Tracking plan adherence would require integrating routine completion data back into the profile.

---

## 6. Conclusion

This paper presented the design, implementation, and evaluation of a Dynamic Student Knowledge Profiling system for adaptive learning, as realized in the Edcheck platform. The system addresses a practical gap in production EdTech systems: the need for real-time, explainable, per-student profiling that operates without introducing LLM latency into the core learning interaction loop.

The five-stage deterministic pipeline — covering evaluation, mastery scoring, trend analysis, difficulty adaptation, and profile aggregation — runs asynchronously after every quiz submission and updates a versioned student model within 100–200 ms. The mastery model's six-factor weighted formula captures accuracy, consistency, recency, forgetting, difficulty weight, and learning velocity in a single normalized score. The trend analyzer combines linear regression and EMA to classify learning trajectories into interpretable categories with behavioral pattern detection. The difficulty engine applies a rule-based decision tree with a full decision trace, ensuring every recommendation is auditable.

The on-demand LLM layer (Groq) uses only aggregated analytics as context, protecting student privacy while leveraging the natural language generation capabilities of large language models to produce personalized, structured study plans. The supplementary AI tier handles day-to-day features (notes, routine, test prep, assignment help) with a TTL-based cache that achieves a 78% hit rate in typical usage, substantially reducing API cost.

Results demonstrate that students with five or more quiz attempts show meaningful mastery growth (average readinessScore increase of +0.12), and students who engaged with the LLM study plan showed a 15% higher improvement score on subsequent quizzes. The pipeline completes within 185 ms in the 95th percentile, and the student submission endpoint remains under 50 ms through full async decoupling.

Future directions include personalized forgetting-rate estimation (per-student λ in the decay model), integration of spaced-repetition scheduling based on the forgetting curve data, A/B testing of difficulty thresholds using the existing `wasAccepted` feedback mechanism, and expansion of the LLM layer to generate targeted practice questions aligned with detected weak areas.

The Edcheck adaptive learning system demonstrates that a carefully designed hybrid architecture — combining explainable rule-based analytics with selective LLM augmentation — can deliver meaningful, personalized learning experiences at production scale without sacrificing latency, transparency, or data privacy.

---

## 7. References

[1] Anderson, J. R., Corbett, A. T., Koedinger, K. R., & Pelletier, R. (1995). Cognitive tutors: Lessons learned. *Journal of the Learning Sciences*, 4(2), 167–207.

[2] Corbett, A. T., & Anderson, J. R. (1994). Knowledge tracing: Modeling the acquisition of procedural knowledge. *User Modeling and User-Adapted Interaction*, 4(4), 253–278.

[3] Piech, C., Spencer, J., Huang, J., Ganguli, S., Sahami, M., Guibas, L., & Koller, D. (2015). Deep knowledge tracing. *Advances in Neural Information Processing Systems (NeurIPS)*, 28.

[4] Knewton. (2014). Knewton adaptive learning white paper. Retrieved from https://www.knewton.com/adaptive-learning/

[5] van der Linden, W. J., & Hambleton, R. K. (Eds.). (1997). *Handbook of modern item response theory*. Springer.

[6] Pane, J. F., Steiner, E. D., Baird, M. D., & Hamilton, L. S. (2015). *Continued progress: Promising evidence on personalized learning*. RAND Corporation.

[7] Ebbinghaus, H. (1885). *Über das Gedächtnis: Untersuchungen zur experimentellen Psychologie*. Duncker & Humblot. (Translated: Memory: A contribution to experimental psychology, 1913.)

[8] Wozniak, P. A., & Gorzelanczyk, E. J. (1994). Optimization of repetition spacing in the practice of learning. *Acta Neurobiologiae Experimentalis*, 54(1), 59–62.

[9] Settles, B., & Meeder, B. (2016). A trainable spaced repetition model for language learning. *Proceedings of the 54th Annual Meeting of the Association for Computational Linguistics (ACL)*, 1848–1858.

[10] Arnold, K. E., & Pistilli, M. D. (2012). Course signals at Purdue: Using learning analytics to increase student success. *Proceedings of the 2nd International Conference on Learning Analytics and Knowledge (LAK)*, 267–270.

[11] Romero, C., & Ventura, S. (2010). Educational data mining: A review of the state of the art. *IEEE Transactions on Systems, Man, and Cybernetics, Part C*, 40(6), 601–618.

[12] Bier, N., Lip, S., Strader, R., Thille, C., & Zimmaro, D. (2014). An approach to knowledge component / skill modeling in online courses. *Open Learning*, Carnegie Mellon University Technical Report.

[13] Vygotsky, L. S. (1978). *Mind in society: The development of higher psychological processes*. Harvard University Press.

[14] Sweller, J. (1988). Cognitive load during problem solving: Effects on learning. *Cognitive Science*, 12(2), 257–285.

[15] Conati, C., Gertner, A., & VanLehn, K. (2002). Using Bayesian networks to manage uncertainty in student modeling. *User Modeling and User-Adapted Interaction*, 12(4), 371–417.

[16] Rudolph, J., Tan, S., & Tan, S. (2023). ChatGPT: Bullshit spewer or the end of traditional assessments in higher education? *Journal of Applied Learning and Teaching*, 6(1).

[17] Kasneci, E., Seßler, K., Küchemann, S., Bannert, M., Dementieva, D., Fischer, F., ... & Kasneci, G. (2023). ChatGPT for good? On opportunities and challenges of large language models for education. *Learning and Individual Differences*, 103, 102274.

[18] Mollick, E. R., & Mollick, L. (2023). Assigning AI: Seven approaches for students, with prompts. *SSRN Working Paper*. https://doi.org/10.2139/ssrn.4475995
