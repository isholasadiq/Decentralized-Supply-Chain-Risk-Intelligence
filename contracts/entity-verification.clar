;; Entity Verification Contract
;; Validates and manages supply chain participants

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u100))
(define-constant err-not-found (err u101))
(define-constant err-already-exists (err u102))
(define-constant err-unauthorized (err u103))

;; Entity status types
(define-constant status-pending u0)
(define-constant status-verified u1)
(define-constant status-suspended u2)
(define-constant status-revoked u3)

;; Entity data structure
(define-map entities
  { entity-id: uint }
  {
    owner: principal,
    name: (string-ascii 100),
    entity-type: (string-ascii 50),
    status: uint,
    verification-date: uint,
    risk-score: uint
  }
)

;; Entity counter
(define-data-var entity-counter uint u0)

;; Authorized verifiers
(define-map authorized-verifiers principal bool)

;; Register a new entity
(define-public (register-entity (name (string-ascii 100)) (entity-type (string-ascii 50)))
  (let ((entity-id (+ (var-get entity-counter) u1)))
    (map-set entities
      { entity-id: entity-id }
      {
        owner: tx-sender,
        name: name,
        entity-type: entity-type,
        status: status-pending,
        verification-date: u0,
        risk-score: u50
      }
    )
    (var-set entity-counter entity-id)
    (ok entity-id)
  )
)

;; Verify an entity (only authorized verifiers)
(define-public (verify-entity (entity-id uint))
  (let ((entity (unwrap! (map-get? entities { entity-id: entity-id }) err-not-found)))
    (asserts! (default-to false (map-get? authorized-verifiers tx-sender)) err-unauthorized)
    (map-set entities
      { entity-id: entity-id }
      (merge entity {
        status: status-verified,
        verification-date: block-height
      })
    )
    (ok true)
  )
)

;; Update entity risk score
(define-public (update-risk-score (entity-id uint) (new-score uint))
  (let ((entity (unwrap! (map-get? entities { entity-id: entity-id }) err-not-found)))
    (asserts! (default-to false (map-get? authorized-verifiers tx-sender)) err-unauthorized)
    (map-set entities
      { entity-id: entity-id }
      (merge entity { risk-score: new-score })
    )
    (ok true)
  )
)

;; Add authorized verifier (owner only)
(define-public (add-verifier (verifier principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-verifiers verifier true)
    (ok true)
  )
)

;; Get entity details
(define-read-only (get-entity (entity-id uint))
  (map-get? entities { entity-id: entity-id })
)

;; Check if entity is verified
(define-read-only (is-entity-verified (entity-id uint))
  (match (map-get? entities { entity-id: entity-id })
    entity (is-eq (get status entity) status-verified)
    false
  )
)

;; Get entity count
(define-read-only (get-entity-count)
  (var-get entity-counter)
)
