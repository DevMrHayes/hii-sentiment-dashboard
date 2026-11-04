# HII Sentiment Intelligence Dashboard — Quantitative Methodology Specification

**Methodology Version:** `rubric-v1.0.0`  
**Scoring Engine Version:** `engine-v1.0.0`  
**Subject Entity:** Huntington Ingalls Industries, Inc. (NYSE: HII; spun off from Northrop Grumman on 2011-03-31)  
**Evaluation Cutoff Context:** November 30, 2026  

---

## 1. Closed Rubric Enumerations & Anchoring Definitions

To guarantee bit-identical reproducibility across environments and eliminate LLM stochasticity from numerical scoring, all qualitative evidence is mapped into a closed set of ordinal enumerations. An LLM may propose rubric codes at `temperature=0`, or an analyst may assign them manually, but once committed to the content-hashed Evidence Ledger, the numeric engine processes only these discrete integer and string codes.

### 1.1 Audience Enumeration (`audience`)
* `EXEC`: Executive Branch / Administration (White House, OMB, NSC, OSD/SecDef, Maritime Directorate)
* `CONG`: United States Congress (HASC, SASC, SAC-D, HAC-D, CBO, CRS, GAO, Member statements)
* `NAVY`: Department of the Navy (SECNAV, CNO, ASN(RDA), NAVSEA, PEO Ships, PEO Attack Submarines, PEO Aircraft Carriers)
* `PUBLIC`: American Public & Capital Markets (Equity performance vs. defense peers, institutional analysts, quarterly earnings, national & trade press, organized labor/community sentiment)

### 1.2 Direction (`direction`)
Represents the directional valence of the evidence toward HII's strategic, financial, operational, or reputational standing with the target audience.

| Code | Label | Definition & Anchoring Examples |
| :--- | :--- | :--- |
| `+1` | **Positive / Favorable** | Explicitly supports HII programs, expands backlog, praises execution, beats financial expectations, or elevates shipbuilding priority. *Anchor:* Multi-ship CVN-80/81 block buy authorization. |
| `0` | **Neutral / Informational** | Balanced or purely procedural milestone with offsetting factors, or structural transition establishing a baseline. *Anchor:* March 2011 spin-off initiation; routine CR extension without program anomalies. |
| `-1` | **Negative / Adverse** | Criticizes schedule/cost performance, cuts or delays hull procurement, compresses margins, or highlights execution failures. *Anchor:* GAO report citing Ford-class EMALS/AAG delays and cost growth. |

### 1.3 Magnitude Level (`magnitude` $\in \{1, 2, 3, 4, 5\}$)
Measures the intrinsic severity or scale of the event before source credibility and scope weighting. Scaled non-linearly into **Basis Points (`magnitudePoints`)** where $10,000 \text{ bps} = 1.0000 \text{ raw unit}$.

| Level | Label | `magnitudePoints` (bps) | Anchoring Definition & Defense Shipbuilding Examples |
| :---: | :--- | :---: | :--- |
| `1` | **Minor / Routine** | `20,000` (2.00) | Routine single-member statement, minor contract modification (<$100M), single-analyst price target trim, routine keel authentication/christening. |
| `2` | **Moderate / Notable** | `45,000` (4.50) | Subcommittee mark or hearing critique, standard quarterly earnings beat/miss (2%–5%), LPD/NSC follow-on award ($250M–$1B), peer-relative stock move of 5%–10%. |
| `3` | **Significant / Material** | `80,000` (8.00) | Full committee NDAA markup adding/cutting a hull, major GAO critique on CVN/SSN delays, $1B–$5B award or M&A (e.g., Alion), quarterly guidance revision moving stock 10%–15%. |
| `4` | **Major / High-Impact** | `130,000` (13.00) | Enacted NDAA/Appropriations shifting multi-year procurement, President's Budget Request (PB) altering 30-Year Shipbuilding Plan, major earnings shock (>15% selloff), multi-billion submarine block contract. |
| `5` | **Watershed / Structural** | `200,000` (20.00) | Generational event redefining enterprise trajectory: CVN-80/81 two-carrier buy ($15B+), Budget Control Act sequestration, White House Executive Order establishing Maritime Industrial Base Office, COVID-19 pandemic shock. |

### 1.4 Source Types (`sourceType`) & Credibility Tier (`credibility` $\in \{1, 2, 3, 4\}$)
Each event carries a canonical `sourceType` and an integer `credibility` tier. To prevent inflation from low-authority commentary, each `sourceType` has a **Default Credibility Tier** and a **Maximum Permitted Tier** per audience:

| Credibility Tier | Label | `credibilityWeight` (bps) | Multiplier Equivalent | Definition |
| :---: | :--- | :---: | :---: | :--- |
| `1` | **Commentary / Secondary** | `4,000` | $0.40\times$ | General news media, single equity analyst note, trade blog, unverified report. |
| `2` | **Official Watchdog / Market Signal** | `6,500` | $0.65\times$ | CRS report, individual member press release, routine earnings call commentary, periodic relative stock move. |
| `3` | **Primary Institutional / Audit** | `8,500` | $0.85\times$ | Formal GAO audit report, HASC/SASC posture hearing record, SECNAV/CNO posture statement, audited 10-K/10-Q release, formal contract modification. |
| `4` | **Binding Sovereign / Statutory / Major Capital** | `10,000` | $1.00\times$ | Enacted legislation (NDAA/Appropriations), Presidential Executive Order, OMB President's Budget, signed major Definitive Contract Award. |

**Source Type Matrix & Default Credibility Mapping:**
* `exec_order` $\rightarrow$ Default Tier `4` (Primary audience: `EXEC`)
* `budget_request` $\rightarrow$ Default Tier `4` (`EXEC`, `NAVY`)
* `legislation` $\rightarrow$ Default Tier `4` when enacted, Tier `3` at committee markup (`CONG`)
* `contract_award` $\rightarrow$ Default Tier `4` (`NAVY`, `PUBLIC`)
* `hearing` $\rightarrow$ Default Tier `3` (`CONG`, `NAVY`)
* `gao_report` $\rightarrow$ Default Tier `3` (`CONG`, `NAVY`)
* `crs_report` $\rightarrow$ Default Tier `2` (`CONG`)
* `navy_statement` $\rightarrow$ Default Tier `3` (`NAVY`)
* `earnings` $\rightarrow$ Default Tier `3` (`PUBLIC`)
* `stock_move` $\rightarrow$ Default Tier `2` (`PUBLIC`)
* `analyst_rating` $\rightarrow$ Default Tier `1` (single analyst) or Tier `2` (consensus shift) (`PUBLIC`)
* `news_media` $\rightarrow$ Default Tier `1` (general press) or Tier `2` (investigative/labor reporting) (`PUBLIC`, `EXEC`)

### 1.5 Scope Multiplier (`scope`)
Captures the breadth of the impact across HII's business portfolio (Newport News Shipbuilding, Ingalls Shipbuilding, Mission Technologies) and the wider defense industrial base.

| Code | Label | `scopeMultiplier` (bps) | Multiplier Equivalent | Definition & Examples |
| :--- | :--- | :---: | :---: | :--- |
| `program` | **Single Program / Yard Line** | `7,500` | $0.75\times$ | Confined to a single hull or program class (e.g., LPD-28 award, CVN-78 elevator certification). |
| `company` | **Enterprise / Multi-Yard** | `10,000` | $1.00\times$ | Direct HII corporate-wide event (e.g., HII full-year guidance, Alion acquisition, Avondale closure). |
| `industry` | **Naval / Defense Industrial Base** | `11,500` | $1.15\times$ | Reshapes the entire naval shipbuilding sector where HII is a prime monopoly/duopoly player (e.g., 355-ship Navy mandate, Maritime EO, SIOP capital investment). |
| `macro` | **Macro / Fiscal Regime** | `13,000` | $1.30\times$ | Broad fiscal or macroeconomic shock altering all federal procurement or labor supply (e.g., 2013 BCA Sequestration, COVID-19 industrial disruption). |

### 1.6 Persistence Class & Half-Life (`persistence`)
Determines how rapidly an event's sentiment impulse decays over time. Evaluated strictly using integer calendar days ($d \ge 0$).

| Code | Label | Half-Life $H_p$ (Integer Days) | Retention after 90d | Retention after 365d | Anchoring Examples |
| :--- | :--- | :---: | :---: | :---: | :--- |
| `transient` | **Transient / News Cycle** | `45` days | 25.00% | 0.36% | Analyst rating change, single hearing exchange, short-term media cycle. |
| `quarter` | **Quarterly / Reporting Cycle** | `120` days | 59.46% | 12.13% | Quarterly earnings beat/miss, periodic stock outperformance, CR delay. |
| `year` | **Annual / Budget Cycle** | `365` days | 84.27% | 50.00% | Annual PB request, annual NDAA authorization, GAO report on program status. |
| `structural` | **Structural / Multi-Year** | `1,095` days (3 yrs) | 94.46% | 79.37% | Multi-ship block buy, major M&A, yard closure/opening, Executive Order creating permanent office. |

---

## 2. Deterministic Scoring Engine Specification (`engine-v1.0.0`)

All arithmetic is executed using **64-bit signed integers (`BigInt` in TypeScript / `int` in Python)** representing **Basis Points ($1\text{ bp} = 10^{-4}$)**, with explicit **Round-Half-To-Even (Banker's Rounding)** at every division step. Floating-point instructions (`IEEE 754`) are strictly forbidden in the core aggregation loop, except where explicitly wrapped in a deterministic integer-keyed lookup table.

### 2.1 Integer Banker's Rounding Operator
For any integer numerator $N$ and positive integer divisor $D$, the deterministic rounded quotient $\text{ div\_rne}(N, D)$ is defined as:

$$\text{div\_rne}(N, D) = \text{sign}(N) \cdot \left\lfloor \frac{|N|}{D} + I_{\text{round}}(|N|, D) \right\rfloor$$

where $R = |N| \bmod D$, $Q = \lfloor |N| / D \rfloor$, and:

$$I_{\text{round}}(|N|, D) = \begin{cases} 
1 & \text{if } 2R > D \\
1 & \text{if } 2R = D \text{ and } (Q \bmod 2 = 1) \\
0 & \text{otherwise}
\end{cases}$$

### 2.2 Event Base Points Calculation
For an event $e$ and an audience impact entry $i = (a, d_i, m_i, c_i, s_i, p_i)$ targeting audience $a$:
* $d_i \in \{-1, 0, +1\}$
* $M(m_i) \in \{20000, 45000, 80000, 130000, 200000\}$ (in bps)
* $C(c_i) \in \{4000, 6500, 8500, 10000\}$ (in bps, scale $10,000 = 1.0$)
* $S(s_i) \in \{7500, 10000, 11500, 13000\}$ (in bps, scale $10,000 = 1.0$)

The **Base Points in Basis Points** ($\text{BaseBps}_{e,a}$) is computed as:

$$\text{BaseBps}_{e,a} = d_i \cdot \text{div\_rne}\left( M(m_i) \cdot C(c_i) \cdot S(s_i),\; 100,000,000 \right)$$

*Example:* A positive (`+1`), Magnitude `4` (`130,000`), Credibility `4` (`10,000`), Scope `industry` (`11,500`) event yields:
$$\text{BaseBps} = +1 \cdot \text{div\_rne}(130000 \times 10000 \times 11500, 10^8) = +149,500 \text{ bps } (+14.9500 \text{ raw points}).$$

### 2.3 Exact Integer Day Count & Fixed-Precision Time Decay
Let $t_{\text{event}}$ be the canonical UTC date `YYYY-MM-DD` of event $e$, and $t_{\text{end}}(P)$ be the canonical UTC period-end date of evaluation period $P$:
* **Annual Period (`YYYY`):** `YYYY-12-31`
* **Quarterly Period (`YYYY-Qn`):** `YYYY-03-31`, `YYYY-06-30`, `YYYY-09-30`, `YYYY-12-31`
* **Monthly Period (`YYYY-MM`):** Last calendar day of month `MM` in `YYYY` (e.g., `2026-10-31`, `2026-11-30`).

The elapsed integer day count is:

$$\Delta d = \frac{\text{UTC\_Midnight}(t_{\text{end}}(P)) - \text{UTC\_Midnight}(t_{\text{event}})}{86,400,000 \text{ ms}}$$

* **Causality Rule:** If $\Delta d < 0$ (the event occurred after the period end date), the event has zero contribution to period $P$ ($\text{DecayBps} = 0$).
* **Cutoff Horizon:** If $\Delta d > 3,650$ days (10 years), $\text{DecayBps} = 0$.

For $0 \le \Delta d \le 3,650$, the decay factor in basis points $\text{DecayBps}(\Delta d, H_p) \in [0, 10000]$ is defined by exact piecewise-linear interpolation in log-2 space (or precomputed canonical integer lookup table):

$$\text{DecayBps}(\Delta d, H_p) = \left\lfloor 10,000 \cdot 2^{-\Delta d / H_p} \right\rceil_{\text{rne}}$$

To guarantee zero cross-platform libm discrepancy, $\text{DecayBps}(\Delta d, H_p)$ is computed via **Fixed-Point Binary Exponentiation**:
Let $\Delta d = q \cdot H_p + r$ where $q = \lfloor \Delta d / H_p \rfloor$ and $r = \Delta d \bmod H_p$. We pre-tabulate a 64-entry constant array `TWO_NEG_FRAC_BPS[k]` $= \lfloor 10^8 \cdot 2^{-k/64} \rceil_{\text{rne}}$ for $k \in \{0..64\}$, interpolate $r / H_p$ onto the 64-step grid using integer arithmetic, and right-shift by $q$.

The event's **Decayed Contribution** to audience $a$ in period $P$ is:

$$\text{ContribBps}_{e,a}(P) = \text{div\_rne}\left( \text{BaseBps}_{e,a} \cdot \text{DecayBps}(\Delta d, H_p),\; 10,000 \right)$$

### 2.4 Period Raw Score Aggregation & Stable Ordering
To ensure deterministic execution traces and audit logs, all eligible events $e \in \mathcal{E}(P)$ with $t_{\text{event}} \le t_{\text{end}}(P)$ are sorted in strict ascending order by the tuple:
$$\text{SortKey}(e) = \left( t_{\text{event}},\; \text{id}_{\text{sha256}}(e) \right)$$

Because integer addition is associative and commutative, the **Period Raw Score in Basis Points** ($\text{RawBps}_{a}(P)$) is the exact sum:

$$\text{RawBps}_{a}(P) = \sum_{e \in \mathcal{E}(P)} \text{ContribBps}_{e,a}(P)$$

*(Note: Because all events with $t_{\text{event}} \le t_{\text{end}}(P)$ are evaluated at $t_{\text{end}}(P)$ using their respective half-lives $H_p$, **empty periods**—periods during which zero new events occur—naturally carry forward the prior state with exact exponential time decay toward the neutral baseline of $0\text{ bps} \mapsto 50.00$ index points.)*

### 2.5 Bounded Saturating Mapping ($\text{RawBps} \rightarrow [0, 100]$ Index)
To transform unbounded cumulative raw points into an intuitive $0.00\text{ to }100.00$ Sentiment Index where **$50.00$ is strictly Neutral**, **$0.00$ is Maximum Bearish/Hostile**, and **$100.00$ is Maximum Bullish/Supportive**, we use a rational algebraic sigmoid (Padé-type saturating function) that uses **pure integer arithmetic**:

$$S_{\text{bps}}(R) = 500,000 + \text{div\_rne}\left( 500,000 \cdot R,\; |R| + K_{\text{bps}} \right)$$

where:
* $R = \text{RawBps}_{a}(P)$ is the Period Raw Score in basis points ($10,000 \text{ bps} = 1.0 \text{ raw point}$).
* $K_{\text{bps}} = 250,000 \text{ bps}$ ($25.0000 \text{ raw points}$) is the **Half-Saturation Constant**.
* $S_{\text{bps}}(R) \in [0, 1,000,000]$ represents the index score in **centi-basis points** (where $500,000 = 50.00$ index points).
* The displayed score (to 2 decimal places, i.e., integer hundredths of an index point $\in [0, 10000]$) is:
  $$\text{IndexCenti}_{a}(P) = \text{div\_rne}\left( S_{\text{bps}}(R),\; 100 \right), \quad \text{Score}_{a}(P) = \frac{\text{IndexCenti}_{a}(P)}{100.00}$$

**Calibration Properties of $K_{\text{bps}} = 250,000$:**
* $R = 0 \implies \text{Score} = 50.00$ (Exact Neutral Baseline)
* Single moderate positive event ($R = +45,000$) $\implies \text{Score} = 50 + 50 \cdot \frac{4.5}{29.5} = 57.63$
* Strong positive cluster ($R = +150,000$) $\implies \text{Score} = 50 + 50 \cdot \frac{15}{40} = 68.75$
* Half-saturation ($R = +250,000$) $\implies \text{Score} = 75.00$
* Watershed sustained multi-event bull regime ($R = +500,000$) $\implies \text{Score} = 83.33$
* Severe crisis cluster ($R = -250,000$) $\implies \text{Score} = 25.00$

---

## 3. Market-Derived Quantitative Signals (`PUBLIC` Audience)

For the **American Public & Capital Markets (`PUBLIC`)** audience, qualitative media/labor events are supplemented by deterministic rules translating market data into standardized ledger events:

### 3.1 Relative Total Return vs. Defense Peer Basket (`sourceType = "stock_move"`)
At the close of each evaluation period, HII's total return $TR_{\text{HII}}(P)$ is compared against the equal-weighted **Defense Peer Basket** $TR_{\text{Peer}}(P) = \frac{1}{4}\left(TR_{\text{GD}} + TR_{\text{LMT}} + TR_{\text{NOC}} + TR_{\text{ITA}}\right)$. Let $\alpha(P) = TR_{\text{HII}}(P) - TR_{\text{Peer}}(P)$ in percentage points:

| Relative Alpha $\alpha(P)$ | Direction | Magnitude | Credibility | Scope | Persistence |
| :--- | :---: | :---: | :---: | :---: | :--- |
| $|\alpha(P)| < 4.0\%$ | *No event emitted (within normal market noise)* | — | — | — | — |
| $4.0\% \le |\alpha(P)| < 8.0\%$ | $\text{sign}(\alpha)$ | `1` | `2` | `company` | `quarter` |
| $8.0\% \le |\alpha(P)| < 14.0\%$ | $\text{sign}(\alpha)$ | `2` | `2` | `company` | `quarter` |
| $14.0\% \le |\alpha(P)| < 22.0\%$ | $\text{sign}(\alpha)$ | `3` | `2` | `company` | `quarter` |
| $|\alpha(P)| \ge 22.0\%$ | $\text{sign}(\alpha)$ | `4` | `2` | `company` | `year` |

### 3.2 Quarterly Earnings & Free Cash Flow / Shipbuilding Margin Guidance (`sourceType = "earnings"`)
Evaluated on earnings release date based on GAAP EPS surprise, Shipbuilding operating margin vs. target (historically 7.5%–9.0%), and full-year Free Cash Flow (FCF) guidance revisions:
* **Magnitude `1`:** EPS beat/miss of 2%–5% with reaffirmed guidance (`persistence = "quarter"`, `credibility = 3`).
* **Magnitude `2`:** EPS beat/miss of 5%–10% or FCF guidance adjustment of $\pm \$50\text{M}$–$\$100\text{M}$ (`persistence = "quarter"`).
* **Magnitude `3`:** Shipbuilding margin miss/beat $>75\text{ bps}$ or FCF guidance revision $> \$100\text{M}$, or 1-day stock reaction of $8\%$–$14\%$ (`persistence = "year"`).
* **Magnitude `4`:** Severe guidance reset or multi-year FCF target withdrawal triggering a 1-day stock reaction $\ge 15\%$ (e.g., October 31, 2024 Q3 release; `persistence = "year"`).

### 3.3 Wall Street Analyst Rating Shifts (`sourceType = "analyst_rating"`)
* Single bulge-bracket upgrade/downgrade (e.g., JPM, GS, BofA, Citi): `magnitude = 1`, `credibility = 1`, `scope = "company"`, `persistence = "transient"`.
* Multi-analyst cluster ($\ge 3$ downgrades/upgrades within 10 trading days): `magnitude = 2`, `credibility = 2`, `scope = "company"`, `persistence = "quarter"`.

---

## 4. Cross-Audience Attribution & Starred Key Events

### 4.1 Explicit Multi-Audience Impact Vector
A single real-world event often carries distinct meanings for different stakeholders. Rather than computing a single event score and splitting it by arbitrary ratios, each event in the Evidence Ledger contains an explicit array `impacts: AudienceImpact[]` where **at most one impact record per audience** is permitted:
$$\text{impacts}(e) = \left[ \{ \text{audience}: a, \text{direction}: d_a, \text{magnitude}: m_a, \text{credibility}: c_a, \text{scope}: s_a, \text{persistence}: p_a \} \right]$$

*Example (Divergent Multi-Audience Attribution):* When the White House submits a President's Budget Request that proposes retiring cruisers or delaying an amphibious ship (`LPD`), `EXEC` impact may be `-1` (administration deprioritizing amphibious line), while `CONG` impact in the subsequent HASC markup adding advanced procurement funding is `+1` (Congressional industrial-base protection).

### 4.2 Starred Key Events (`keyEvent: boolean`)
Any event may be flagged with `keyEvent = true` (either in the seed catalog or toggled by the user in the UI Control Pane).
* **Strict Scoring Invariance:** Toggling `keyEvent` **never alters** $\text{BaseBps}_{e,a}$ or any audience/composite score.
* **UI & Export Behavior:** Events with `keyEvent = true` render as Passion Orange (`#ea7722`) star markers directly on the main timeline chart, appear in the Key Events highlight filter, and are promoted to a dedicated executive summary section in the Markdown Export.

---

## 5. Composite Score Calculation & Weight Versioning

### 5.1 Integer-Percent Weighted Mean
Let $W = (w_{\text{EXEC}}, w_{\text{CONG}}, w_{\text{NAVY}}, w_{\text{PUBLIC}})$ be the user-configured integer percentage weights satisfying:
$$w_a \in \{0, 1, \dots, 100\}, \quad w_{\text{EXEC}} + w_{\text{CONG}} + w_{\text{NAVY}} + w_{\text{PUBLIC}} = 100$$

**Default Baseline Weights (`weightProfileId = "default-25-25-30-20"`):**
* Executive Branch (`EXEC`): `25%`
* Congress (`CONG`): `25%`
* Department of the Navy (`NAVY`): `30%` *(highest weight as direct customer and contract authority)*
* American Public (`PUBLIC`): `20%`

For any period $P$, the **Composite Score** in integer hundredths of a point ($\text{CompositeCenti}(P) \in [0, 10000]$) is computed directly from the four audience integer hundredths scores $\text{IndexCenti}_a(P)$:

$$\text{CompositeCenti}(P) = \text{div\_rne}\left( \sum_{a \in \{\text{EXEC}, \text{CONG}, \text{NAVY}, \text{PUBLIC}\}} w_a \cdot \text{IndexCenti}_a(P),\; 100 \right)$$

$$\text{CompositeScore}(P) = \frac{\text{CompositeCenti}(P)}{100.00}$$

### 5.2 Weight Versioning: Current Weights vs. As-Recorded Weights
Every change to the weight vector $W$ creates an immutable `WeightProfileVersion` record (`id`, `weights`, `createdAt`, `author`, `reason`).
* **Active Profile View (Default):** Recomputes the entire 2011–2026 composite time series and 6-month forecast dynamically under the currently active weights $W_{\text{active}}$ so the time series is apples-to-apples across all periods.
* **As-Recorded Audit View:** Each persisted `ScoreSnapshot` stores both the 4 immutable audience scores and the `weightProfileId` active when that snapshot was recorded, enabling auditors to view historical composite scores under the exact weights in force at that timestamp.

---

## 6. Retroactive Revision Protocol & Taxonomy

When a research run (`runId`) or manual analyst action discovers an event whose `eventDate` falls on or before the end date of an already-scored historical period $P$ ($t_{\text{event}} \le t_{\text{end}}(P)$), or modifies the rubric codes of an existing event:

1. **Recomputation:** The engine recomputes $\text{IndexCenti}_a(P)$ for every period $P$ where $t_{\text{end}}(P) \ge t_{\text{event}}$.
2. **Threshold Check:** If $\text{NewIndexCenti}_a(P) \neq \text{OldIndexCenti}_a(P)$, the system appends an immutable `ScoreRevision` record:
   * `revisionId`: deterministic SHA-256 hash of `(runId, period, audience, oldScoreCenti, newScoreCenti)`
   * `period`: e.g., `"2024"`, `"2026-Q2"`
   * `audience`: `EXEC | CONG | NAVY | PUBLIC | COMPOSITE`
   * `oldScore` / `newScore` / `delta`: signed difference in index points
   * `triggeringEventIds`: array of event SHA-256 IDs that caused the change
   * `revisionReason`: enumerated code from the **Revision Reasons Taxonomy** below
   * `timestamp`: ISO-8601 UTC timestamp
3. **Revision Reasons Taxonomy:**
   * `NEW_RETROACTIVE_EVIDENCE`: Automated research run or analyst discovered a historical document (e.g., delayed GAO report or newly indexed congressional hearing transcript) dated in a closed period.
   * `RUBRIC_RECLASSIFICATION`: An analyst manually edited the rubric codes (`direction`, `magnitude`, `credibility`, `scope`, or `persistence`) of an existing ledger event with a documented justification.
   * `SOURCE_CORROBORATION_UPGRADE`: Secondary reporting (`credibility = 1`) was confirmed by an official primary audit or contract announcement (`credibility = 3` or `4`).
   * `EVENT_DATE_CORRECTION`: The canonical `eventDate` of an existing ledger event was corrected to reflect its official statutory or filing date.
   * `WEIGHT_PROFILE_CHANGE`: Composite score changed solely due to a user update to audience composite weights.

---

## 7. Deterministic 6-Month Forecast Engine (Dec 2026 – May 2027)

Given the current anchor period $P_0 = \text{2026-11}$ (ending `2026-11-30`), the engine projects monthly scores for the next 6 calendar months:
$$M_1 = \text{2026-12}, \quad M_2 = \text{2027-01}, \quad M_3 = \text{2027-02}, \quad M_4 = \text{2027-03}, \quad M_5 = \text{2027-04}, \quad M_6 = \text{2027-05}$$

### 7.1 Discrete Catalyst Probability Steps
Each pending catalyst $c \in \mathcal{C}$ has an analyst/user-assigned realization probability $p_c$ restricted to a closed 7-step enumeration:
$$\text{ProbabilitySteps} = \{ 5\%, 10\%, 25\%, 50\%, 75\%, 90\%, 95\% \} \iff \text{ProbBps}_c \in \{ 500, 1000, 2500, 5000, 7500, 9000, 9500 \}$$
Each catalyst specifies an `expectedMonth` $m(c) \in \{M_1, \dots, M_6\}$ (evaluated as occurring on the 15th of that month, `YYYY-MM-15`, for decay calculations into subsequent forecast months) and per-audience rubric codes yielding base points $\text{BaseBps}_{c,a}$ and decayed contribution $\text{ContribBps}_{c,a}(M_k)$ for any forecast month $M_k \ge m(c)$.

### 7.2 Expected-Value Projection (Decay of Existing Ledger + Expected Catalyst Impulse)
For forecast month $M_k$ ($k \in \{1..6\}$) with period-end date $t_{\text{end}}(M_k)$:
1. **Deterministic Decay of Historical Ledger ($\text{HistRawBps}_{a}(M_k)$):** Every committed historical event $e \in \mathcal{E}(P_0)$ continues to decay naturally to $t_{\text{end}}(M_k)$:
   $$\text{HistRawBps}_{a}(M_k) = \sum_{e \in \mathcal{E}(P_0)} \text{ContribBps}_{e,a}(M_k)$$
2. **Expected Catalyst Contribution ($\mathbb{E}[\text{CatRawBps}_{a}(M_k)]$):** Treating each pending catalyst $c$ with $m(c) \le M_k$ as an independent Bernoulli random variable $X_c \sim \text{Bernoulli}(p_c)$:
   $$\mu_{a}(M_k) = \text{HistRawBps}_{a}(M_k) + \sum_{\substack{c \in \mathcal{C} \\ m(c) \le M_k}} \text{div\_rne}\left( \text{ProbBps}_c \cdot \text{ContribBps}_{c,a}(M_k),\; 10,000 \right)$$
3. **Expected Score:** Mapped through the saturating function $S_{\text{bps}}(\mu_{a}(M_k))$ defined in Section 2.5.

### 7.3 Analytic Variance & P10 / P90 Confidence Band
For independent Bernoulli catalysts $X_c \sim \text{Bernoulli}(p_c)$, the exact variance of the raw score at forecast month $M_k$ (in squared basis points) is:

$$\sigma^2_{a}(M_k) = \sum_{\substack{c \in \mathcal{C} \\ m(c) \le M_k}} \text{div\_rne}\left( \text{ProbBps}_c \cdot (10,000 - \text{ProbBps}_c),\; 10,000^2 \right) \cdot \left(\text{ContribBps}_{c,a}(M_k)\right)^2$$

Let $\sigma_{a}(M_k) = \lfloor \sqrt{\sigma^2_{a}(M_k)} \rfloor_{\text{int}}$ (computed via deterministic integer Newton-Raphson square root `isqrt`). Using the fixed normal quantile constant $z_{0.90} = 1.2816 \iff Z_{\text{bps}} = 12,816$:

$$\Delta_{\text{band},a}(M_k) = \text{div\_rne}\left( 12,816 \cdot \sigma_{a}(M_k),\; 10,000 \right)$$

$$\text{RawP10}_{a}(M_k) = \mu_{a}(M_k) - \Delta_{\text{band},a}(M_k), \quad \text{RawP90}_{a}(M_k) = \mu_{a}(M_k) + \Delta_{\text{band},a}(M_k)$$

Finally, $\text{RawP10}_{a}(M_k)$ and $\text{RawP90}_{a}(M_k)$ are passed through the monotonic saturating function $S_{\text{bps}}(\cdot)$ to yield the exact deterministic **P10** and **P90** index bounds on the $[0, 100]$ scale.

---

## 8. Seed Historical Event Catalog (2011–2026)

Below is the canonical, verified 52-event historical dataset for Huntington Ingalls Industries (NYSE: HII) spanning March 2011 through November 2026.

```json
[
  {
    "title": "HII Completes Spin-Off from Northrop Grumman and Begins NYSE Trading",
    "eventDate": "2011-03-31",
    "sourceType": "earnings",
    "summary": "Huntington Ingalls Industries completes its tax-free spin-off from Northrop Grumman Corporation (NYSE: HII), establishing America's largest military shipbuilding company as an independent public enterprise.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 0, "magnitude": 2, "credibility": 4, "scope": "company", "persistence": "structural" },
      { "audience": "CONG", "direction": 0, "magnitude": 2, "credibility": 4, "scope": "company", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 2, "credibility": 4, "scope": "company", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "Navy Awards Ingalls $1.5B Contract for Amphibious Transport Dock Somerset (LPD 25) and Long-Lead Material",
    "eventDate": "2011-04-01",
    "sourceType": "contract_award",
    "summary": "Immediately following the spin-off, NAVSEA definitizes amphibious shipbuilding contracts at Ingalls Shipbuilding, stabilizing Gulf Coast backlog.",
    "keyEvent": false,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 2, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "year" }
    ]
  },
  {
    "title": "Navy Awards Ingalls Shipbuilding $697.6M Contract for DDG 114 (Ralph Johnson) and DDG 115",
    "eventDate": "2011-09-26",
    "sourceType": "contract_award",
    "summary": "Department of the Navy awards Ingalls Shipbuilding fixed-price incentive contract for the Arleigh Burke-class destroyer restart program.",
    "keyEvent": false,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "HII Records $300M Goodwill Impairment Charge Amid Gulf Coast Margin Pressure",
    "eventDate": "2011-11-10",
    "sourceType": "earnings",
    "summary": "HII Q3 2011 financial results include a non-cash goodwill impairment charge at Ingalls Shipbuilding and highlight legacy LPD program cost pressures, weighing on post-spin investor sentiment.",
    "keyEvent": false,
    "impacts": [
      { "audience": "PUBLIC", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "quarter" }
    ]
  },
  {
    "title": "HII Announces Restructure and Wind-Down of Avondale Shipyard Operations",
    "eventDate": "2012-07-17",
    "sourceType": "earnings",
    "summary": "HII confirms plans to wind down military shipbuilding at Avondale, Louisiana by 2014 and consolidate Gulf Coast amphibious construction at Pascagoula, Mississippi to restore segment operating margins.",
    "keyEvent": true,
    "impacts": [
      { "audience": "CONG", "direction": -1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "year" },
      { "audience": "NAVY", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "Newport News Shipbuilding Awarded $3.3B Construction Preparation Contract for JFK (CVN 79)",
    "eventDate": "2013-01-15",
    "sourceType": "contract_award",
    "summary": "U.S. Navy awards Newport News Shipbuilding multi-year construction preparation and long-lead material contract for the second Gerald R. Ford-class carrier, John F. Kennedy (CVN 79).",
    "keyEvent": false,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "Budget Control Act Sequestration Takes Effect; Abraham Lincoln (CVN 72) RCOH Delayed",
    "eventDate": "2013-03-01",
    "sourceType": "exec_order",
    "summary": "Mandatory BCA sequestration budget cuts trigger temporary delay of USS Abraham Lincoln (CVN 72) Refueling and Complex Overhaul at Newport News until DoD and Congress reprogram funds.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": -1, "magnitude": 4, "credibility": 4, "scope": "macro", "persistence": "year" },
      { "audience": "CONG", "direction": -1, "magnitude": 4, "credibility": 4, "scope": "macro", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "quarter" }
    ]
  },
  {
    "title": "Navy Awards Ingalls Shipbuilding $3.3B Five-Destroyer Multi-Year Contract (DDG 51 Flight IIA)",
    "eventDate": "2013-06-03",
    "sourceType": "contract_award",
    "summary": "NAVSEA awards Ingalls Shipbuilding a $3.3 billion multi-year procurement contract for five Arleigh Burke-class destroyers (FY2013–FY2017), anchoring Gulf Coast production.",
    "keyEvent": true,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "GAO Report Criticizes Gerald R. Ford (CVN 78) $2.4B Cost Growth and Subsystem Readiness",
    "eventDate": "2013-09-05",
    "sourceType": "gao_report",
    "summary": "GAO audit (GAO-13-396) highlights 22% cost growth over the initial $10.5B cap on lead carrier CVN 78 alongside EMALS, AAG, and Dual Band Radar integration delays.",
    "keyEvent": false,
    "impacts": [
      { "audience": "CONG", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "year" }
    ]
  },
  {
    "title": "USS Gerald R. Ford (CVN 78) Christened at Newport News Shipbuilding",
    "eventDate": "2013-11-09",
    "sourceType": "navy_statement",
    "summary": "First-in-class aircraft carrier CVN 78 is christened at Newport News Shipbuilding; HII stock closes 2013 up over 100% as Ingalls operating margins recover above 9%.",
    "keyEvent": false,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "quarter" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 4, "credibility": 2, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "Virginia-Class Block IV $17.6B 10-Submarine Multi-Year Contract Awarded to GD Electric Boat and HII",
    "eventDate": "2014-04-28",
    "sourceType": "contract_award",
    "summary": "The U.S. Navy awards the largest shipbuilding contract in its history at the time ($17.6B) for 10 Virginia-class Block IV fast attack submarines built jointly by Electric Boat and Newport News Shipbuilding.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 5, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "FY2015 PB Threatens George Washington (CVN 73) Refueling; Congress Fully Restores RCOH Funding",
    "eventDate": "2014-12-19",
    "sourceType": "legislation",
    "summary": "After OSD's FY15 budget submission floated retiring USS George Washington (CVN 73) rather than funding its Newport News RCOH, Congress rejects the proposal and mandates full 11-carrier fleet funding in FY15 NDAA/Omnibus.",
    "keyEvent": false,
    "impacts": [
      { "audience": "EXEC", "direction": -1, "magnitude": 2, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "NAVY", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "year" }
    ]
  },
  {
    "title": "Newport News Shipbuilding Awarded $3.35B Detail Design and Construction Contract for JFK (CVN 79)",
    "eventDate": "2015-06-05",
    "sourceType": "contract_award",
    "summary": "Navy awards definitized detail design and construction contract for John F. Kennedy (CVN 79) under a fixed-price incentive structure ordered by Congress.",
    "keyEvent": false,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "SASC Chairman McCain Holds Oversight Hearing Criticizing CVN 78 Delivery Delays and Cost Overruns",
    "eventDate": "2015-10-01",
    "sourceType": "hearing",
    "summary": "Senate Armed Services Committee holds sharp oversight hearings on Gerald R. Ford (CVN 78) shock trials, weapons elevators, and delivery slippage into 2017.",
    "keyEvent": false,
    "impacts": [
      { "audience": "CONG", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "quarter" },
      { "audience": "PUBLIC", "direction": -1, "magnitude": 2, "credibility": 2, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "Electric Boat and Newport News Establish Joint Build Arrangement for Columbia-Class SSBN",
    "eventDate": "2016-03-29",
    "sourceType": "navy_statement",
    "summary": "Navy, GD Electric Boat, and HII Newport News finalize the Teaming Agreement for the Ohio Replacement (Columbia-class) ballistic missile submarine program, securing ~22-25% workshare for Newport News.",
    "keyEvent": false,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 3, "scope": "program", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "structural" }
    ]
  },
  {
    "title": "HII Acquires Camber Corporation for $380M to Establish Technical Solutions Segment",
    "eventDate": "2016-12-05",
    "sourceType": "earnings",
    "summary": "HII closes the $380M acquisition of government services provider Camber Corporation, creating its third reporting segment (Technical Solutions) to diversify into C5ISR, fleet sustainment, and modeling.",
    "keyEvent": false,
    "impacts": [
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "year" },
      { "audience": "EXEC", "direction": 1, "magnitude": 1, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "U.S. Navy Releases Force Structure Assessment Establishing 355-Ship Fleet Requirement",
    "eventDate": "2016-12-16",
    "sourceType": "navy_statement",
    "summary": "Department of the Navy releases its 2016 Force Structure Assessment increasing the required battle force from 308 to 355 ships, including 12 aircraft carriers and 66 attack submarines.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "industry", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 3, "scope": "industry", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 5, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "industry", "persistence": "year" }
    ]
  },
  {
    "title": "President Trump Visits Newport News Shipbuilding on USS Gerald R. Ford and Pledges 12-Carrier Navy",
    "eventDate": "2017-03-02",
    "sourceType": "exec_order",
    "summary": "President Donald Trump delivers a major address aboard CVN 78 at Newport News Shipbuilding, endorsing a 12-carrier, 350-ship Navy and praising HII's workforce.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 5, "credibility": 4, "scope": "company", "persistence": "year" },
      { "audience": "NAVY", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "industry", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "USS Gerald R. Ford (CVN 78) Delivered and Commissioned into U.S. Navy Fleet",
    "eventDate": "2017-07-22",
    "sourceType": "navy_statement",
    "summary": "Following completion of Builder's and Acceptance Trials, Newport News Shipbuilding delivers CVN 78 and the Navy formally commissions the lead Ford-class carrier at Naval Station Norfolk.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "quarter" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "FY2018 NDAA Codifies 355-Ship Navy Policy and Authorizes Multi-Ship Amphibious & Destroyer Buys",
    "eventDate": "2017-12-12",
    "sourceType": "legislation",
    "summary": "Section 1025 of the FY2018 National Defense Authorization Act makes it the official policy of the United States to achieve a 355-ship battle force as soon as practicable.",
    "keyEvent": false,
    "impacts": [
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "EXEC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "year" }
    ]
  },
  {
    "title": "Navy Awards Ingalls Shipbuilding $5.1B Multi-Year Contract for Six Arleigh Burke Flight III Destroyers",
    "eventDate": "2018-09-27",
    "sourceType": "contract_award",
    "summary": "Navy awards Ingalls Shipbuilding a $5.1 billion multi-year procurement contract for six DDG 51 Flight III destroyers across FY2018–FY2022.",
    "keyEvent": true,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "Navy Awards Newport News Historic $15.2B Two-Carrier Block Buy for Enterprise (CVN 80) and Doris Miller (CVN 81)",
    "eventDate": "2019-01-31",
    "sourceType": "contract_award",
    "summary": "Under Congressional authorization, the Navy awards Newport News Shipbuilding a historic $15.2 billion two-carrier block buy for CVN 80 and CVN 81, projected to save $4B and stabilize the carrier industrial base for a decade.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 5, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 5, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "company", "persistence": "structural" }
    ]
  },
  {
    "title": "FY2020 PB Proposes Canceling USS Harry S. Truman (CVN 75) RCOH; Bipartisan Backlash Forces Reversal",
    "eventDate": "2019-04-30",
    "sourceType": "hearing",
    "summary": "After OSD's FY20 budget proposes retiring CVN 75 at mid-life instead of refueling at Newport News, fierce bipartisan Congressional pressure leads the White House to reverse the decision and commit to the RCOH.",
    "keyEvent": false,
    "impacts": [
      { "audience": "EXEC", "direction": 0, "magnitude": 2, "credibility": 4, "scope": "program", "persistence": "quarter" },
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "quarter" }
    ]
  },
  {
    "title": "HASC/SASC Hearings and GAO Rebuke Delay of CVN 78 Advanced Weapons Elevators and Post-Shakedown Availability",
    "eventDate": "2019-11-13",
    "sourceType": "gao_report",
    "summary": "Congressional committees and GAO scrutinize incomplete Advanced Weapons Elevators and propulsion bearing repairs on USS Gerald R. Ford during extended Post-Shakedown Availability at Newport News.",
    "keyEvent": false,
    "impacts": [
      { "audience": "CONG", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "PUBLIC", "direction": -1, "magnitude": 2, "credibility": 2, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "Virginia-Class Block V $22.2B Nine-Submarine Contract Awarded to Electric Boat and HII Newport News",
    "eventDate": "2019-12-02",
    "sourceType": "contract_award",
    "summary": "Navy awards a $22.2 billion multi-year contract for nine Virginia-class Block V submarines (8 with Virginia Payload Modules), locking in HII's submarine backlog into the 2030s.",
    "keyEvent": true,
    "impacts": [
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 5, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "COVID-19 Pandemic Disrupts Shipyard Attendance and Triggers Q2 2020 Virginia-Class Margin Charge",
    "eventDate": "2020-08-06",
    "sourceType": "earnings",
    "summary": "COVID-19 liberal leave policies, attendance drops, and social distancing at Newport News and Ingalls trigger a $111M unfavorable cumulative catch-up adjustment in Q2 2020; HII stock underperforms peers by >18% in 2020.",
    "keyEvent": true,
    "impacts": [
      { "audience": "NAVY", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "macro", "persistence": "year" },
      { "audience": "PUBLIC", "direction": -1, "magnitude": 4, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "Columbia-Class SSBN Lead Two-Boat Construction Contract ($9.47B) Awarded to Electric Boat and HII",
    "eventDate": "2020-11-05",
    "sourceType": "contract_award",
    "summary": "Navy awards $9.47B construction contract for District of Columbia (SSBN 826) and Wisconsin (SSBN 827); Newport News Shipbuilding serves as major module builder for bow, stern, and auxiliary machinery rooms.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 5, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "White House Releases December 2020 30-Year Shipbuilding Plan ('Battle Force 2045')",
    "eventDate": "2020-12-09",
    "sourceType": "budget_request",
    "summary": "Outgoing Trump Administration OMB and DoD release the Battle Force 2045 plan calling for 382–446 manned ships and 3-per-year Virginia-class SSN production.",
    "keyEvent": false,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "quarter" },
      { "audience": "NAVY", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "industry", "persistence": "quarter" }
    ]
  },
  {
    "title": "FY2022 President's Budget Request Cuts Virginia-Class Procurement to One Boat in Debate Before Congress Restores Two",
    "eventDate": "2021-05-28",
    "sourceType": "budget_request",
    "summary": "Initial FY2022 budget submission requests only 8 battle force ships and omits funds for a fifth DDG / amphibious expansion, sparking bipartisan HASC/SASC pushback that adds 5 ships in the enacted FY22 NDAA.",
    "keyEvent": false,
    "impacts": [
      { "audience": "EXEC", "direction": -1, "magnitude": 2, "credibility": 4, "scope": "industry", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "year" }
    ]
  },
  {
    "title": "HII Completes $1.65B Acquisition of Alion Science and Technology",
    "eventDate": "2021-08-19",
    "sourceType": "earnings",
    "summary": "HII closes its largest-ever acquisition ($1.65B in cash) for Alion Science and Technology, transforming Technical Solutions (later renamed Mission Technologies) into a high-growth ISR, cyber, and LVC training business.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "AUKUS Trilateral Nuclear Submarine Partnership Announced by US, UK, and Australia",
    "eventDate": "2021-09-15",
    "sourceType": "exec_order",
    "summary": "President Biden, PM Morrison, and PM Johnson announce the AUKUS security partnership to provide Australia with conventionally armed, nuclear-powered submarines, elevating the strategic importance of Newport News and Electric Boat.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "Navy Certifies 11th and Final Advanced Weapons Elevator on USS Gerald R. Ford (CVN 78)",
    "eventDate": "2021-12-22",
    "sourceType": "navy_statement",
    "summary": "Newport News Shipbuilding and NAVSEA complete testing and certification of the 11th and final Advanced Weapons Elevator aboard CVN 78, resolving a multi-year Congressional oversight sore point ahead of inaugural deployment.",
    "keyEvent": false,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "year" }
    ]
  },
  {
    "title": "Chris Kastner Succeeds Mike Petters as HII President and CEO",
    "eventDate": "2022-03-01",
    "sourceType": "earnings",
    "summary": "Longtime CFO and COO Chris Kastner transitions to President and CEO as founding CEO Mike Petters becomes Executive Vice Chairman; HII outlines multi-year free cash flow generation targets.",
    "keyEvent": false,
    "impacts": [
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "FY2023 PB Proposes Terminating LPD Flight II Line After LPD 32; Congress Enacts 31-Amphibious Ship Statutory Floor",
    "eventDate": "2022-12-23",
    "sourceType": "legislation",
    "summary": "OSD's FY23 budget proposes ending San Antonio-class LPD procurement at Ingalls after LPD 32. Congress rejects the truncation in the FY23 NDAA, codifying a statutory minimum of 31 amphibious warfare ships and funding LPD 33 long-lead materials.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": -1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "NAVY", "direction": 0, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "quarter" }
    ]
  },
  {
    "title": "AUKUS Optimal Pathway Announced in San Diego with Multi-Billion Submarine Industrial Base Investment",
    "eventDate": "2023-03-13",
    "sourceType": "exec_order",
    "summary": "Leaders of US, UK, and Australia announce the AUKUS Optimal Pathway, including transfer of three Virginia-class submarines to Australia in the 2030s and $4.6B+ in U.S. plus $3B in Australian Submarine Industrial Base (SIB) investments.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "year" },
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "GAO Report (GAO-23-106059) Details Severe Shipyard Skilled-Labor Attrition and Virginia-Class 24-36 Month Delays",
    "eventDate": "2023-06-06",
    "sourceType": "gao_report",
    "summary": "GAO Weapons Systems Annual Assessment documents acute post-pandemic skilled trade shortages and supply chain bottlenecks holding Virginia-class cadence to ~1.2–1.3 boats/year vs. the 2.0 target.",
    "keyEvent": false,
    "impacts": [
      { "audience": "CONG", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "industry", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "industry", "persistence": "year" },
      { "audience": "PUBLIC", "direction": -1, "magnitude": 2, "credibility": 2, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "Navy Awards Ingalls Shipbuilding Multi-Year Contract for Seven Arleigh Burke Flight III Destroyers (FY23–FY27)",
    "eventDate": "2023-08-01",
    "sourceType": "contract_award",
    "summary": "U.S. Navy awards Ingalls Shipbuilding a multi-year procurement contract for seven DDG 51 Flight III destroyers across FY2023–FY2027 (valued at >$7B), securing Gulf Coast surface combatant production.",
    "keyEvent": true,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "HII Posts Record FY2023 Revenue ($11.5B) and $692M Free Cash Flow; Stock Reaches All-Time High (~$299)",
    "eventDate": "2024-02-01",
    "sourceType": "earnings",
    "summary": "HII reports fourth-quarter and full-year 2023 results beating revenue and FCF consensus, driving shares to an all-time high near $299 in early March 2024.",
    "keyEvent": false,
    "impacts": [
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "FY2025 PB Cuts Virginia-Class Procurement to One Boat; SECNAV 45-Day Shipbuilding Review Reveals 1–3 Year Delays Across Fleet",
    "eventDate": "2024-04-02",
    "sourceType": "navy_statement",
    "summary": "Shortly after the FY25 budget requests only 1 Virginia-class submarine, SECNAV Carlos Del Toro releases the 45-Day Shipbuilding Review confirming 12–16 month delays on Columbia SSBN, 18–26 month delays on CVN 80, and 24–36 month delays on Virginia Block IV/V.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": -1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "year" },
      { "audience": "CONG", "direction": -1, "magnitude": 4, "credibility": 3, "scope": "industry", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 4, "credibility": 3, "scope": "company", "persistence": "year" },
      { "audience": "PUBLIC", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "Navy Awards Ingalls Shipbuilding $9.6B Multi-Ship Amphibious Warship Block Buy (Three LPDs + LHA 10)",
    "eventDate": "2024-09-24",
    "sourceType": "contract_award",
    "summary": "Navy awards Ingalls Shipbuilding a historic $9.6B multi-ship amphibious warship block buy for LPD 33, LPD 34, LPD 35, and America-class LHA 10 (Helmand Province), resolving years of amphibious line uncertainty.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "HII Discloses Investigation of Non-Compliant Welds at Newport News Shipbuilding",
    "eventDate": "2024-09-26",
    "sourceType": "navy_statement",
    "summary": "Navy and HII notify Congress and DOJ that Newport News Shipbuilding identified faulty non-critical welds performed without proper procedures on submarine and carrier modules, prompting DoD/HASC scrutiny.",
    "keyEvent": false,
    "impacts": [
      { "audience": "CONG", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "year" },
      { "audience": "PUBLIC", "direction": -1, "magnitude": 2, "credibility": 2, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "HII Q3 2024 Earnings Shock: Slashes FY24 FCF Guidance to $0–$100M and Pulls 5-Year FCF Target; Stock Plunges 26%",
    "eventDate": "2024-10-31",
    "sourceType": "earnings",
    "summary": "HII reports Q3 2024 shipbuilding operating margins of 3.3% due to pre-COVID fixed-price contract headwinds, low workforce experience levels, and delayed Virginia Block V Stage 2 negotiations, cutting FY24 FCF guidance from $600M–$700M to $0–$100M. Shares fall 26.2% in a single session.",
    "keyEvent": true,
    "impacts": [
      { "audience": "NAVY", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "year" },
      { "audience": "CONG", "direction": -1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" },
      { "audience": "PUBLIC", "direction": -1, "magnitude": 5, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "Congress Passes Dec 2024 CR Including $5.7B Virginia-Class Anomaly to Fund Wage Acceleration and Supplier Stabilization",
    "eventDate": "2024-12-21",
    "sourceType": "legislation",
    "summary": "In the American Relief Act of 2025, Congress provides $5.7 billion in emergency submarine procurement anomaly funding to cover cost growth on FY24 Virginia-class hulls and fund shipyard workforce wage increases.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "HII Acquires South Carolina Metal Fabricator W International Assets to Expand Module Production Capacity",
    "eventDate": "2025-01-21",
    "sourceType": "earnings",
    "summary": "HII closes acquisition of substantially all assets of W International SC LLC in Goose Creek, SC (renamed Newport News Shipbuilding - Charleston Operations) to expand submarine and carrier module fabrication throughput.",
    "keyEvent": false,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "President Trump Announces White House Office of Shipbuilding During Joint Address to Congress",
    "eventDate": "2025-03-04",
    "sourceType": "exec_order",
    "summary": "In his Joint Address to Congress, President Trump announces the creation of a new White House Office of Shipbuilding and tax incentives to resurrect commercial and military maritime production.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "industry", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "industry", "persistence": "quarter" }
    ]
  },
  {
    "title": "President Trump Signs Executive Order 'Restoring America's Maritime Dominance'",
    "eventDate": "2025-04-09",
    "sourceType": "exec_order",
    "summary": "President Trump signs the comprehensive Maritime Action Plan Executive Order directing NSC, DoD, and OMB to expand the Maritime Industrial Base, reform shipbuilding procurement, and boost shipyard workforce pipelines.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 5, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "year" },
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "Navy and HII Finalize Virginia-Class Block V Stage 2 / Block VI Contract Modifications Incorporating Wage Support",
    "eventDate": "2025-06-18",
    "sourceType": "contract_award",
    "summary": "Approx. date: Following Congressional anomaly authorization, NAVSEA, Electric Boat, and HII execute submarine contract adjustments supporting Newport News trade wage increases and improved risk sharing.",
    "keyEvent": true,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 4, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "GAO Shipbuilding Assessment Notes Stabilization in Hiring but Persistent Supply Chain Delays on CVN 79 and CVN 80",
    "eventDate": "2025-07-15",
    "sourceType": "gao_report",
    "summary": "Approx. date: GAO annual shipbuilding review acknowledges improved retention at Newport News and Ingalls after wage hikes, but notes John F. Kennedy (CVN 79) delivery schedule shifted into 2026.",
    "keyEvent": false,
    "impacts": [
      { "audience": "CONG", "direction": -1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "year" }
    ]
  },
  {
    "title": "FY2026 Defense Reconciliation and NDAA Enacted with Historic $25B+ Shipbuilding Industrial Base Expansion",
    "eventDate": "2025-12-19",
    "sourceType": "legislation",
    "summary": "Approx. date: Congress enacts FY2026 NDAA and defense reconciliation funding providing multi-billion dollar investments for two Virginia-class submarines, three DDG 51 Flight III destroyers, and shipyard infrastructure.",
    "keyEvent": true,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 5, "credibility": 4, "scope": "industry", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "industry", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "HII FY2025 Earnings Release Shows Shipbuilding Throughput Up 8% and Margin Recovery to 6.8%",
    "eventDate": "2026-02-05",
    "sourceType": "earnings",
    "summary": "Approx. date: HII reports full-year 2025 results demonstrating sequential shipbuilding margin expansion, lower first-year attrition, and strong Mission Technologies backlog growth; HII shares outperform defense peers in Q1 2026.",
    "keyEvent": false,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "title": "FY2027 President's Budget Request Prioritizes Maritime Industrial Base and Sustains Submarine & Destroyer Tempo",
    "eventDate": "2026-03-16",
    "sourceType": "budget_request",
    "summary": "Approx. date: Administration submits FY2027 Defense Budget featuring dedicated Maritime Industrial Base accounts, CVN 80/81 construction funding, and continued submarine supplier development.",
    "keyEvent": false,
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "year" },
      { "audience": "NAVY", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "year" }
    ]
  },
  {
    "title": "PCU John F. Kennedy (CVN 79) Completes Builder's Sea Trials Ahead of Navy Acceptance",
    "eventDate": "2026-06-18",
    "sourceType": "navy_statement",
    "summary": "Approx. date: Second Ford-class aircraft carrier John F. Kennedy (CVN 79) successfully completes Builder's Trials out of Newport News Shipbuilding, validating single-phase delivery improvements.",
    "keyEvent": true,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "title": "HASC & SASC FY2027 NDAA Markups Authorize Advanced Procurement for Third DDG 51 Flight III Destroyer",
    "eventDate": "2026-07-22",
    "sourceType": "hearing",
    "summary": "Approx. date: House and Senate Armed Services Committees approve FY2027 NDAA markups adding incremental funding for a third Arleigh Burke Flight III destroyer and amphibious ship supplier spares.",
    "keyEvent": false,
    "impacts": [
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "year" }
    ]
  },
  {
    "title": "Federal Fiscal Year 2027 Begins Under Continuing Resolution Through December 2026",
    "eventDate": "2026-10-01",
    "sourceType": "legislation",
    "summary": "Approx. date: Congress passes a short-term Continuing Resolution through mid-December 2026, temporarily freezing new-start procurement authorities pending post-election omnibus negotiations.",
    "keyEvent": false,
    "impacts": [
      { "audience": "CONG", "direction": -1, "magnitude": 1, "credibility": 4, "scope": "macro", "persistence": "quarter" },
      { "audience": "NAVY", "direction": -1, "magnitude": 1, "credibility": 3, "scope": "macro", "persistence": "quarter" }
    ]
  },
  {
    "title": "HII Q3 2026 Earnings Beat Consensus on Charleston Module Output and Mission Technologies Growth",
    "eventDate": "2026-11-05",
    "sourceType": "earnings",
    "summary": "Approx. date: HII reports Q3 2026 results showing 7.4% shipbuilding operating margin, growing module deliveries from Charleston Operations, and raises full-year 2026 free cash flow guidance.",
    "keyEvent": false,
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "quarter" }
    ]
  }
]
```

---

## 9. Seed 6-Month Forecast Catalysts (Dec 2026 – May 2027)

Below is the canonical set of 8 pending catalysts spanning December 2026 through May 2027 used by the deterministic Expected-Value and Analytic P10/P90 Forecast Engine.

```json
[
  {
    "id": "cat-2026-12-ndaa-fy27",
    "title": "Enactment of Final FY2027 NDAA Authorizing Two Virginia SSNs, Three DDG 51s, and SIB Authorities",
    "expectedMonth": "2026-12",
    "probability": 90,
    "sourceType": "legislation",
    "summary": "Bipartisan conference agreement on the FY2027 National Defense Authorization Act codifying submarine industrial base authorities and multi-ship surface combatant procurement.",
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 2, "credibility": 4, "scope": "industry", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "industry", "persistence": "year" },
      { "audience": "NAVY", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "id": "cat-2026-12-cvn79-delivery",
    "title": "Formal Navy Acceptance and Delivery of John F. Kennedy (CVN 79) at Newport News Shipbuilding",
    "expectedMonth": "2026-12",
    "probability": 75,
    "sourceType": "navy_statement",
    "summary": "Completion of Acceptance Trials with INSURV and formal DD-250 custody transfer of the second Ford-class aircraft carrier CVN 79 to the U.S. Navy, retiring a major legacy fixed-price execution risk.",
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "NAVY", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "id": "cat-2027-01-cr-shutdown-risk",
    "title": "Extended Full-Year Continuing Resolution or Partial Defense Appropriations Lapse",
    "expectedMonth": "2027-01",
    "probability": 25,
    "sourceType": "legislation",
    "summary": "Failure to enact full-year FY2027 Defense Appropriations in January 2027, forcing a restrictive Continuing Resolution that delays Columbia Build II and Virginia Block VI long-lead awards.",
    "impacts": [
      { "audience": "EXEC", "direction": -1, "magnitude": 2, "credibility": 4, "scope": "macro", "persistence": "quarter" },
      { "audience": "CONG", "direction": -1, "magnitude": 4, "credibility": 4, "scope": "macro", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "quarter" },
      { "audience": "PUBLIC", "direction": -1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" }
    ]
  },
  {
    "id": "cat-2027-02-fy26-earnings-fcf",
    "title": "HII FY2026 Full-Year Earnings Release Exceeds 7.8% Shipbuilding Margin and Issues Strong FY27 FCF Outlook",
    "expectedMonth": "2027-02",
    "probability": 75,
    "sourceType": "earnings",
    "summary": "Full-year 2026 financial release confirming retirement of pre-COVID legacy hulls and guiding FY2027 shipbuilding operating margins above 8.0% with >$700M in free cash flow.",
    "impacts": [
      { "audience": "NAVY", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "quarter" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 4, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "id": "cat-2027-03-pb28-shipbuilding-plan",
    "title": "FY2028 President's Budget & 30-Year Shipbuilding Plan Expands Maritime Industrial Base Funding",
    "expectedMonth": "2027-03",
    "probability": 75,
    "sourceType": "budget_request",
    "summary": "Release of the FY2028 President's Budget and updated 30-Year Shipbuilding Plan funding 2 Virginia SSNs, 1 Columbia SSBN, 2+ DDG 51s, and CVN 82 advanced procurement.",
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "industry", "persistence": "year" },
      { "audience": "CONG", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "industry", "persistence": "quarter" },
      { "audience": "NAVY", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "industry", "persistence": "year" }
    ]
  },
  {
    "id": "cat-2027-04-columbia-build-ii",
    "title": "Columbia-Class SSBN Build II Multi-Boat Construction Contract Definitization",
    "expectedMonth": "2027-04",
    "probability": 50,
    "sourceType": "contract_award",
    "summary": "Definitization of the five-boat Columbia-class Build II contract between NAVSEA, GD Electric Boat, and HII Newport News with updated inflation and workforce escalation protection.",
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "CONG", "direction": 1, "magnitude": 4, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 5, "credibility": 4, "scope": "program", "persistence": "structural" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "company", "persistence": "year" }
    ]
  },
  {
    "id": "cat-2027-05-gao-annual-assessment",
    "title": "GAO 2027 Weapon Systems Annual Assessment Flags CVN 80 Supply Chain Lag",
    "expectedMonth": "2027-05",
    "probability": 50,
    "sourceType": "gao_report",
    "summary": "Annual GAO audit highlighting vendor material delays on Enterprise (CVN 80) despite improved shipyard labor retention.",
    "impacts": [
      { "audience": "CONG", "direction": -1, "magnitude": 3, "credibility": 3, "scope": "program", "persistence": "year" },
      { "audience": "NAVY", "direction": -1, "magnitude": 2, "credibility": 3, "scope": "program", "persistence": "quarter" },
      { "audience": "PUBLIC", "direction": -1, "magnitude": 1, "credibility": 2, "scope": "company", "persistence": "transient" }
    ]
  },
  {
    "id": "cat-2027-05-aukus-sustainment-award",
    "title": "HII Mission Technologies & Newport News Awarded AUKUS Submarine Readiness & Training Contract",
    "expectedMonth": "2027-05",
    "probability": 25,
    "sourceType": "contract_award",
    "summary": "Award of a multi-year AUKUS Pillar I nuclear stewardship, training, and fleet sustainment contract to HII Mission Technologies and Newport News Shipbuilding.",
    "impacts": [
      { "audience": "EXEC", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "company", "persistence": "structural" },
      { "audience": "NAVY", "direction": 1, "magnitude": 3, "credibility": 4, "scope": "company", "persistence": "year" },
      { "audience": "PUBLIC", "direction": 1, "magnitude": 2, "credibility": 3, "scope": "company", "persistence": "year" }
    ]
  }
]
```