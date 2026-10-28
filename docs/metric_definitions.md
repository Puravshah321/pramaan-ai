# Pramaan AI — Metric Definitions & Mathematical Formulas

## 1. Retrieval Metrics

### Recall@K
Fraction of gold evidence passages retrieved in the top $K$ candidate passages:
$$\text{Recall@K} = \frac{|\mathcal{D}_{\text{gold}} \cap \mathcal{D}_{1..K}|}{|\mathcal{D}_{\text{gold}}|}$$

### Mean Reciprocal Rank (MRR)
Reciprocal rank of the first relevant document:
$$\text{MRR} = \frac{1}{|Q|} \sum_{i=1}^{|Q|} \frac{1}{\text{rank}_i}$$

### Normalized Discounted Cumulative Gain (nDCG@K)
Evaluates graded relevance with logarithmic positional discounting:
$$\text{DCG@K} = \sum_{i=1}^K \frac{2^{\text{rel}_i} - 1}{\log_2(i + 1)}, \quad \text{nDCG@K} = \frac{\text{DCG@K}}{\text{IDCG@K}}$$

---

## 2. Generation & Answer Accuracy

### Exact Match (EM)
Binary metric indicating whether normalized generated text is identical to ground truth.

### Token F1
Harmonic mean of precision and recall over bag-of-words tokens:
$$P = \frac{|T_{\text{pred}} \cap T_{\text{gold}}|}{|T_{\text{pred}}|}, \quad R = \frac{|T_{\text{pred}} \cap T_{\text{gold}}|}{|T_{\text{gold}}|}, \quad F_1 = \frac{2PR}{P+R}$$

---

## 3. Reliability & Detector Metrics

### Expected Calibration Error (ECE)
Difference between model confidence and empirical accuracy across $M$ probability bins:
$$\text{ECE} = \sum_{m=1}^M \frac{|B_m|}{N} \left| \text{acc}(B_m) - \text{conf}(B_m) \right|$$

### Area Under the ROC Curve (AUROC)
Discriminative power of the detector in separating hallucinated/canary answers from factually grounded answers across all probability thresholds.
