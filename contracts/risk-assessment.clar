;; Risk Assessment Contract
;; Evaluates supply chain vulnerabilities and calculates risk scores

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u300))
(define-constant err-not-found (err u301))
(define-constant err-unauthorized (err u302))

;; Assessment data structure
(define-map assessments
  { assessment-id: uint }
  {
    assessor: principal,
    entity-id: uint,
    overall-risk-score: uint,
    vulnerability-count: uint,
    assessment-date: uint,
    recommendations: (string-ascii 500),
    next-review-date: uint
  }
)

;; Assessment counter
(define-data-var assessment-counter uint u0)

;; Authorized assessors
(define-map authorized-assessors principal bool)

;; Risk factors for calculation
(define-map risk-factors
  { factor-id: uint }
  {
    name: (string-ascii 100),
    weight: uint,
    max-score: uint
  }
)

;; Create risk assessment
(define-public (create-assessment
  (entity-id uint)
  (vulnerability-count uint)
  (recommendations (string-ascii 500)))
  (let ((assessment-id (+ (var-get assessment-counter) u1))
        (risk-score (calculate-risk-score vulnerability-count)))
    (asserts! (default-to false (map-get? authorized-assessors tx-sender)) err-unauthorized)
    (map-set assessments
      { assessment-id: assessment-id }
      {
        assessor: tx-sender,
        entity-id: entity-id,
        overall-risk-score: risk-score,
        vulnerability-count: vulnerability-count,
        assessment-date: block-height,
        recommendations: recommendations,
        next-review-date: (+ block-height u1000)
      }
    )
    (var-set assessment-counter assessment-id)
    (ok assessment-id)
  )
)

;; Calculate risk score based on vulnerabilities
(define-private (calculate-risk-score (vulnerability-count uint))
  (if (<= vulnerability-count u5)
    u20
    (if (<= vulnerability-count u10)
      u40
      (if (<= vulnerability-count u20)
        u60
        (if (<= vulnerability-count u30)
          u80
          u100
        )
      )
    )
  )
)

;; Update assessment
(define-public (update-assessment
  (assessment-id uint)
  (vulnerability-count uint)
  (recommendations (string-ascii 500)))
  (let ((assessment (unwrap! (map-get? assessments { assessment-id: assessment-id }) err-not-found))
        (new-risk-score (calculate-risk-score vulnerability-count)))
    (asserts! (default-to false (map-get? authorized-assessors tx-sender)) err-unauthorized)
    (map-set assessments
      { assessment-id: assessment-id }
      (merge assessment {
        overall-risk-score: new-risk-score,
        vulnerability-count: vulnerability-count,
        recommendations: recommendations,
        assessment-date: block-height
      })
    )
    (ok true)
  )
)

;; Add authorized assessor (owner only)
(define-public (add-assessor (assessor principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-assessors assessor true)
    (ok true)
  )
)

;; Get assessment
(define-read-only (get-assessment (assessment-id uint))
  (map-get? assessments { assessment-id: assessment-id })
)

;; Get assessment count
(define-read-only (get-assessment-count)
  (var-get assessment-counter)
)

;; Check if assessment is due for review
(define-read-only (is-review-due (assessment-id uint))
  (match (map-get? assessments { assessment-id: assessment-id })
    assessment (>= block-height (get next-review-date assessment))
    false
  )
)
