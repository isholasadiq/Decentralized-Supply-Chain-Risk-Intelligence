import { describe, it, expect, beforeEach } from 'vitest'

// Mock contract state
const mockMitigationState = {
  mitigationPlans: new Map(),
  planCounter: 0,
  mitigationActions: new Map(),
  actionCounter: 0,
  authorizedCoordinators: new Map(),
  contractOwner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
}

// Status constants
const STATUS_PLANNED = 0
const STATUS_IN_PROGRESS = 1
const STATUS_COMPLETED = 2
const STATUS_FAILED = 3

// Mock contract functions
const mitigationCoordinationContract = {
  createMitigationPlan: (riskId, entityId, title, description, priority, targetCompletion, costEstimate, sender) => {
    if (!mockMitigationState.authorizedCoordinators.get(sender)) {
      return { err: 502 } // unauthorized
    }
    
    const planId = mockMitigationState.planCounter + 1
    mockMitigationState.mitigationPlans.set(planId, {
      coordinator: sender,
      riskId,
      entityId,
      title,
      description,
      status: STATUS_PLANNED,
      priority,
      startDate: 0,
      targetCompletion,
      actualCompletion: 0,
      costEstimate,
      effectivenessScore: 0
    })
    mockMitigationState.planCounter = planId
    return { ok: planId }
  },
  
  startMitigationPlan: (planId, sender) => {
    const plan = mockMitigationState.mitigationPlans.get(planId)
    if (!plan) {
      return { err: 501 } // not found
    }
    if (plan.coordinator !== sender) {
      return { err: 502 } // unauthorized
    }
    
    mockMitigationState.mitigationPlans.set(planId, {
      ...plan,
      status: STATUS_IN_PROGRESS,
      startDate: 1000 // mock block height
    })
    return { ok: true }
  },
  
  completeMitigationPlan: (planId, effectivenessScore, sender) => {
    const plan = mockMitigationState.mitigationPlans.get(planId)
    if (!plan) {
      return { err: 501 } // not found
    }
    if (plan.coordinator !== sender) {
      return { err: 502 } // unauthorized
    }
    
    mockMitigationState.mitigationPlans.set(planId, {
      ...plan,
      status: STATUS_COMPLETED,
      actualCompletion: 1500, // mock block height
      effectivenessScore
    })
    return { ok: true }
  },
  
  addMitigationAction: (planId, assignee, actionDescription, dueDate, sender) => {
    const plan = mockMitigationState.mitigationPlans.get(planId)
    if (!plan) {
      return { err: 501 } // not found
    }
    if (plan.coordinator !== sender) {
      return { err: 502 } // unauthorized
    }
    
    const actionId = mockMitigationState.actionCounter + 1
    mockMitigationState.mitigationActions.set(actionId, {
      planId,
      assignee,
      actionDescription,
      status: STATUS_PLANNED,
      dueDate,
      completionDate: 0
    })
    mockMitigationState.actionCounter = actionId
    return { ok: actionId }
  },
  
  completeAction: (actionId, sender) => {
    const action = mockMitigationState.mitigationActions.get(actionId)
    if (!action) {
      return { err: 501 } // not found
    }
    if (action.assignee !== sender) {
      return { err: 502 } // unauthorized
    }
    
    mockMitigationState.mitigationActions.set(actionId, {
      ...action,
      status: STATUS_COMPLETED,
      completionDate: 1200 // mock block height
    })
    return { ok: true }
  },
  
  addCoordinator: (coordinator, sender) => {
    if (sender !== mockMitigationState.contractOwner) {
      return { err: 500 } // owner only
    }
    mockMitigationState.authorizedCoordinators.set(coordinator, true)
    return { ok: true }
  },
  
  getMitigationPlan: (planId) => {
    return mockMitigationState.mitigationPlans.get(planId) || null
  },
  
  getMitigationAction: (actionId) => {
    return mockMitigationState.mitigationActions.get(actionId) || null
  },
  
  isPlanOverdue: (planId, currentBlock = 2000) => {
    const plan = mockMitigationState.mitigationPlans.get(planId)
    return plan ? (plan.status !== STATUS_COMPLETED && currentBlock > plan.targetCompletion) : false
  }
}

describe('Mitigation Coordination Contract', () => {
  beforeEach(() => {
    mockMitigationState.mitigationPlans.clear()
    mockMitigationState.mitigationActions.clear()
    mockMitigationState.authorizedCoordinators.clear()
    mockMitigationState.planCounter = 0
    mockMitigationState.actionCounter = 0
  })
  
  it('should create mitigation plan by authorized coordinator', () => {
    const owner = mockMitigationState.contractOwner
    const coordinator = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    // Add coordinator
    mitigationCoordinationContract.addCoordinator(coordinator, owner)
    
    // Create mitigation plan
    const result = mitigationCoordinationContract.createMitigationPlan(
        1, // riskId
        1, // entityId
        'Supply Chain Diversification',
        'Implement multiple supplier strategy to reduce dependency',
        3, // priority
        2000, // targetCompletion
        50000, // costEstimate
        coordinator
    )
    
    expect(result.ok).toBe(1)
    expect(mockMitigationState.planCounter).toBe(1)
    
    const plan = mitigationCoordinationContract.getMitigationPlan(1)
    expect(plan.title).toBe('Supply Chain Diversification')
    expect(plan.status).toBe(STATUS_PLANNED)
    expect(plan.coordinator).toBe(coordinator)
  })
  
  it('should reject plan creation from unauthorized user', () => {
    const unauthorized = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    const result = mitigationCoordinationContract.createMitigationPlan(
        1, 1, 'Test Plan', 'Test description', 2, 2000, 10000, unauthorized
    )
    
    expect(result.err).toBe(502) // unauthorized
  })
  
  it('should manage plan lifecycle correctly', () => {
    const owner = mockMitigationState.contractOwner
    const coordinator = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    // Add coordinator and create plan
    mitigationCoordinationContract.addCoordinator(coordinator, owner)
    const planResult = mitigationCoordinationContract.createMitigationPlan(
        1, 1, 'Test Plan', 'Test description', 2, 2000, 10000, coordinator
    )
    
    const planId = planResult.ok
    
    // Start plan
    const startResult = mitigationCoordinationContract.startMitigationPlan(planId, coordinator)
    
    expect(startResult.ok).toBe(true)
    let plan = mitigationCoordinationContract.getMitigationPlan(planId)
    expect(plan.status).toBe(STATUS_IN_PROGRESS)
    expect(plan.startDate).toBe(1000)
    
    // Complete plan
    const completeResult = mitigationCoordinationContract.completeMitigationPlan(planId, 85, coordinator)
    
    expect(completeResult.ok).toBe(true)
    plan = mitigationCoordinationContract.getMitigationPlan(planId)
    expect(plan.status).toBe(STATUS_COMPLETED)
    expect(plan.effectivenessScore).toBe(85)
  })
  
  it('should add and complete mitigation actions', () => {
    const owner = mockMitigationState.contractOwner
    const coordinator = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    const assignee = 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP'
    
    // Add coordinator and create plan
    mitigationCoordinationContract.addCoordinator(coordinator, owner)
    const planResult = mitigationCoordinationContract.createMitigationPlan(
        1, 1, 'Test Plan', 'Test description', 2, 2000, 10000, coordinator
    )
    
    // Add action
    const actionResult = mitigationCoordinationContract.addMitigationAction(
        planResult.ok,
        assignee,
        'Identify alternative suppliers',
        1800, // dueDate
        coordinator
    )
    
    expect(actionResult.ok).toBe(1)
    
    let action = mitigationCoordinationContract.getMitigationAction(1)
    expect(action.actionDescription).toBe('Identify alternative suppliers')
    expect(action.assignee).toBe(assignee)
    expect(action.status).toBe(STATUS_PLANNED)
    
    // Complete action
    const completeResult = mitigationCoordinationContract.completeAction(1, assignee)
    
    expect(completeResult.ok).toBe(true)
    action = mitigationCoordinationContract.getMitigationAction(1)
    expect(action.status).toBe(STATUS_COMPLETED)
    expect(action.completionDate).toBe(1200)
  })
  
  it('should detect overdue plans', () => {
    const owner = mockMitigationState.contractOwner
    const coordinator = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    // Add coordinator and create plan with early target completion
    mitigationCoordinationContract.addCoordinator(coordinator, owner)
    const planResult = mitigationCoordinationContract.createMitigationPlan(
        1, 1, 'Test Plan', 'Test description', 2, 1500, 10000, coordinator
    )
    
    // Check if overdue (should be true since current block 2000 > target 1500)
    expect(mitigationCoordinationContract.isPlanOverdue(planResult.ok, 2000)).toBe(true)
    
    // Check if not overdue with earlier current block
    expect(mitigationCoordinationContract.isPlanOverdue(planResult.ok, 1000)).toBe(false)
    
    // Complete the plan and check again (should not be overdue even if past target)
    mitigationCoordinationContract.startMitigationPlan(planResult.ok, coordinator)
    mitigationCoordinationContract.completeMitigationPlan(planResult.ok, 90, coordinator)
    expect(mitigationCoordinationContract.isPlanOverdue(planResult.ok, 2000)).toBe(false)
  })
  
  it('should enforce authorization for plan operations', () => {
    const owner = mockMitigationState.contractOwner
    const coordinator = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    const unauthorized = 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP'
    
    // Add coordinator and create plan
    mitigationCoordinationContract.addCoordinator(coordinator, owner)
    const planResult = mitigationCoordinationContract.createMitigationPlan(
        1, 1, 'Test Plan', 'Test description', 2, 2000, 10000, coordinator
    )
    
    // Try to start plan with unauthorized user
    const startResult = mitigationCoordinationContract.startMitigationPlan(planResult.ok, unauthorized)
    expect(startResult.err).toBe(502) // unauthorized
    
    // Try to add action with unauthorized user
    const actionResult = mitigationCoordinationContract.addMitigationAction(
        planResult.ok, unauthorized, 'Test action', 1800, unauthorized
    )
    expect(actionResult.err).toBe(502) // unauthorized
  })
  
  it('should enforce authorization for action completion', () => {
    const owner = mockMitigationState.contractOwner
    const coordinator = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    const assignee = 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP'
    const unauthorized = 'STNHKEPYEPJ8ET55ZZ0M5A34J0R3N5FM2CMMMAZ6'
    
    // Setup plan and action
    mitigationCoordinationContract.addCoordinator(coordinator, owner)
    const planResult = mitigationCoordinationContract.createMitigationPlan(
        1, 1, 'Test Plan', 'Test description', 2, 2000, 10000, coordinator
    )
    const actionResult = mitigationCoordinationContract.addMitigationAction(
        planResult.ok, assignee, 'Test action', 1800, coordinator
    )
    
    // Try to complete action with unauthorized user
    const completeResult = mitigationCoordinationContract.completeAction(actionResult.ok, unauthorized)
    expect(completeResult.err).toBe(502) // unauthorized
    
    // Complete action with correct assignee
    const validCompleteResult = mitigationCoordinationContract.completeAction(actionResult.ok, assignee)
    expect(validCompleteResult.ok).toBe(true)
  })
})
