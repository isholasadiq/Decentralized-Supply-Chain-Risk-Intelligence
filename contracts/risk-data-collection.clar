;; Risk Data Collection Contract
;; Gathers and manages threat intelligence data

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u200))
(define-constant err-not-found (err u201))
(define-constant err-unauthorized (err u202))
(define-constant err-invalid-severity (err u203))

;; Risk severity levels
(define-constant severity-low u1)
(define-constant severity-medium u2)
(define-constant severity-high u3)
(define-constant severity-critical u4)

;; Risk data structure
(define-map risk-data
  { risk-id: uint }
  {
    reporter: principal,
    entity-id: uint,
    risk-type: (string-ascii 50),
    description: (string-ascii 500),
    severity: uint,
    timestamp: uint,
    verified: bool,
    impact-score: uint
  }
)

;; Risk counter
(define-data-var risk-counter uint u0)

;; Authorized data collectors
(define-map authorized-collectors principal bool)

;; Submit risk data
(define-public (submit-risk-data
  (entity-id uint)
  (risk-type (string-ascii 50))
  (description (string-ascii 500))
  (severity uint)
  (impact-score uint))
  (let ((risk-id (+ (var-get risk-counter) u1)))
    (asserts! (and (>= severity severity-low) (<= severity severity-critical)) err-invalid-severity)
    (map-set risk-data
      { risk-id: risk-id }
      {
        reporter: tx-sender,
        entity-id: entity-id,
        risk-type: risk-type,
        description: description,
        severity: severity,
        timestamp: block-height,
        verified: false,
        impact-score: impact-score
      }
    )
    (var-set risk-counter risk-id)
    (ok risk-id)
  )
)

;; Verify risk data (authorized collectors only)
(define-public (verify-risk-data (risk-id uint))
  (let ((risk (unwrap! (map-get? risk-data { risk-id: risk-id }) err-not-found)))
    (asserts! (default-to false (map-get? authorized-collectors tx-sender)) err-unauthorized)
    (map-set risk-data
      { risk-id: risk-id }
      (merge risk { verified: true })
    )
    (ok true)
  )
)

;; Add authorized collector (owner only)
(define-public (add-collector (collector principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-collectors collector true)
    (ok true)
  )
)

;; Get risk data
(define-read-only (get-risk-data (risk-id uint))
  (map-get? risk-data { risk-id: risk-id })
)

;; Get risk count
(define-read-only (get-risk-count)
  (var-get risk-counter)
)

;; Check if risk is verified
(define-read-only (is-risk-verified (risk-id uint))
  (match (map-get? risk-data { risk-id: risk-id })
    risk (get verified risk)
    false
  )
)
