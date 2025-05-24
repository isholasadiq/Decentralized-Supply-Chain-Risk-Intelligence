;; Alert Distribution Contract
;; Manages and distributes risk alerts to stakeholders

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u400))
(define-constant err-not-found (err u401))
(define-constant err-unauthorized (err u402))

;; Alert priority levels
(define-constant priority-low u1)
(define-constant priority-medium u2)
(define-constant priority-high u3)
(define-constant priority-critical u4)

;; Alert data structure
(define-map alerts
  { alert-id: uint }
  {
    issuer: principal,
    title: (string-ascii 100),
    message: (string-ascii 500),
    priority: uint,
    entity-id: uint,
    risk-id: uint,
    timestamp: uint,
    acknowledged: bool,
    resolved: bool
  }
)

;; Alert counter
(define-data-var alert-counter uint u0)

;; Subscriber management
(define-map subscribers
  { subscriber: principal }
  {
    entity-ids: (list 10 uint),
    priority-threshold: uint,
    active: bool
  }
)

;; Authorized alert issuers
(define-map authorized-issuers principal bool)

;; Issue new alert
(define-public (issue-alert
  (title (string-ascii 100))
  (message (string-ascii 500))
  (priority uint)
  (entity-id uint)
  (risk-id uint))
  (let ((alert-id (+ (var-get alert-counter) u1)))
    (asserts! (default-to false (map-get? authorized-issuers tx-sender)) err-unauthorized)
    (map-set alerts
      { alert-id: alert-id }
      {
        issuer: tx-sender,
        title: title,
        message: message,
        priority: priority,
        entity-id: entity-id,
        risk-id: risk-id,
        timestamp: block-height,
        acknowledged: false,
        resolved: false
      }
    )
    (var-set alert-counter alert-id)
    (ok alert-id)
  )
)

;; Acknowledge alert
(define-public (acknowledge-alert (alert-id uint))
  (let ((alert (unwrap! (map-get? alerts { alert-id: alert-id }) err-not-found)))
    (map-set alerts
      { alert-id: alert-id }
      (merge alert { acknowledged: true })
    )
    (ok true)
  )
)

;; Resolve alert
(define-public (resolve-alert (alert-id uint))
  (let ((alert (unwrap! (map-get? alerts { alert-id: alert-id }) err-not-found)))
    (asserts! (default-to false (map-get? authorized-issuers tx-sender)) err-unauthorized)
    (map-set alerts
      { alert-id: alert-id }
      (merge alert { resolved: true })
    )
    (ok true)
  )
)

;; Subscribe to alerts
(define-public (subscribe-to-alerts (entity-ids (list 10 uint)) (priority-threshold uint))
  (begin
    (map-set subscribers
      { subscriber: tx-sender }
      {
        entity-ids: entity-ids,
        priority-threshold: priority-threshold,
        active: true
      }
    )
    (ok true)
  )
)

;; Add authorized issuer (owner only)
(define-public (add-issuer (issuer principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-issuers issuer true)
    (ok true)
  )
)

;; Get alert
(define-read-only (get-alert (alert-id uint))
  (map-get? alerts { alert-id: alert-id })
)

;; Get subscriber info
(define-read-only (get-subscriber (subscriber principal))
  (map-get? subscribers { subscriber: subscriber })
)

;; Get alert count
(define-read-only (get-alert-count)
  (var-get alert-counter)
)

;; Check if alert is active (not resolved)
(define-read-only (is-alert-active (alert-id uint))
  (match (map-get? alerts { alert-id: alert-id })
    alert (not (get resolved alert))
    false
  )
)
