;; Mitigation Coordination Contract
;; Manages risk response efforts and coordination

(define-constant contract-owner tx-sender)
(define-constant err-owner-only (err u500))
(define-constant err-not-found (err u501))
(define-constant err-unauthorized (err u502))
(define-constant err-invalid-status (err u503))

;; Mitigation status types
(define-constant status-planned u0)
(define-constant status-in-progress u1)
(define-constant status-completed u2)
(define-constant status-failed u3)

;; Mitigation plan structure
(define-map mitigation-plans
  { plan-id: uint }
  {
    coordinator: principal,
    risk-id: uint,
    entity-id: uint,
    title: (string-ascii 100),
    description: (string-ascii 500),
    status: uint,
    priority: uint,
    start-date: uint,
    target-completion: uint,
    actual-completion: uint,
    cost-estimate: uint,
    effectiveness-score: uint
  }
)

;; Plan counter
(define-data-var plan-counter uint u0)

;; Authorized coordinators
(define-map authorized-coordinators principal bool)

;; Mitigation actions
(define-map mitigation-actions
  { action-id: uint }
  {
    plan-id: uint,
    assignee: principal,
    action-description: (string-ascii 300),
    status: uint,
    due-date: uint,
    completion-date: uint
  }
)

;; Action counter
(define-data-var action-counter uint u0)

;; Create mitigation plan
(define-public (create-mitigation-plan
  (risk-id uint)
  (entity-id uint)
  (title (string-ascii 100))
  (description (string-ascii 500))
  (priority uint)
  (target-completion uint)
  (cost-estimate uint))
  (let ((plan-id (+ (var-get plan-counter) u1)))
    (asserts! (default-to false (map-get? authorized-coordinators tx-sender)) err-unauthorized)
    (map-set mitigation-plans
      { plan-id: plan-id }
      {
        coordinator: tx-sender,
        risk-id: risk-id,
        entity-id: entity-id,
        title: title,
        description: description,
        status: status-planned,
        priority: priority,
        start-date: u0,
        target-completion: target-completion,
        actual-completion: u0,
        cost-estimate: cost-estimate,
        effectiveness-score: u0
      }
    )
    (var-set plan-counter plan-id)
    (ok plan-id)
  )
)

;; Start mitigation plan
(define-public (start-mitigation-plan (plan-id uint))
  (let ((plan (unwrap! (map-get? mitigation-plans { plan-id: plan-id }) err-not-found)))
    (asserts! (is-eq (get coordinator plan) tx-sender) err-unauthorized)
    (map-set mitigation-plans
      { plan-id: plan-id }
      (merge plan {
        status: status-in-progress,
        start-date: block-height
      })
    )
    (ok true)
  )
)

;; Complete mitigation plan
(define-public (complete-mitigation-plan (plan-id uint) (effectiveness-score uint))
  (let ((plan (unwrap! (map-get? mitigation-plans { plan-id: plan-id }) err-not-found)))
    (asserts! (is-eq (get coordinator plan) tx-sender) err-unauthorized)
    (map-set mitigation-plans
      { plan-id: plan-id }
      (merge plan {
        status: status-completed,
        actual-completion: block-height,
        effectiveness-score: effectiveness-score
      })
    )
    (ok true)
  )
)

;; Add mitigation action
(define-public (add-mitigation-action
  (plan-id uint)
  (assignee principal)
  (action-description (string-ascii 300))
  (due-date uint))
  (let ((action-id (+ (var-get action-counter) u1))
        (plan (unwrap! (map-get? mitigation-plans { plan-id: plan-id }) err-not-found)))
    (asserts! (is-eq (get coordinator plan) tx-sender) err-unauthorized)
    (map-set mitigation-actions
      { action-id: action-id }
      {
        plan-id: plan-id,
        assignee: assignee,
        action-description: action-description,
        status: status-planned,
        due-date: due-date,
        completion-date: u0
      }
    )
    (var-set action-counter action-id)
    (ok action-id)
  )
)

;; Complete action
(define-public (complete-action (action-id uint))
  (let ((action (unwrap! (map-get? mitigation-actions { action-id: action-id }) err-not-found)))
    (asserts! (is-eq (get assignee action) tx-sender) err-unauthorized)
    (map-set mitigation-actions
      { action-id: action-id }
      (merge action {
        status: status-completed,
        completion-date: block-height
      })
    )
    (ok true)
  )
)

;; Add authorized coordinator (owner only)
(define-public (add-coordinator (coordinator principal))
  (begin
    (asserts! (is-eq tx-sender contract-owner) err-owner-only)
    (map-set authorized-coordinators coordinator true)
    (ok true)
  )
)

;; Get mitigation plan
(define-read-only (get-mitigation-plan (plan-id uint))
  (map-get? mitigation-plans { plan-id: plan-id })
)

;; Get mitigation action
(define-read-only (get-mitigation-action (action-id uint))
  (map-get? mitigation-actions { action-id: action-id })
)

;; Get plan count
(define-read-only (get-plan-count)
  (var-get plan-counter)
)

;; Check if plan is overdue
(define-read-only (is-plan-overdue (plan-id uint))
  (match (map-get? mitigation-plans { plan-id: plan-id })
    plan (and
      (not (is-eq (get status plan) status-completed))
      (> block-height (get target-completion plan))
    )
    false
  )
)
