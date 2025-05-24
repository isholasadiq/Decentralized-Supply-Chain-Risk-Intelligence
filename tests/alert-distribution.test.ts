import { describe, it, expect, beforeEach } from 'vitest'

// Mock contract state
const mockAlertState = {
  alerts: new Map(),
  alertCounter: 0,
  subscribers: new Map(),
  authorizedIssuers: new Map(),
  contractOwner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
}

// Mock contract functions
const alertDistributionContract = {
  issueAlert: (title, message, priority, entityId, riskId, sender) => {
    if (!mockAlertState.authorizedIssuers.get(sender)) {
      return { err: 402 } // unauthorized
    }
    
    const alertId = mockAlertState.alertCounter + 1
    mockAlertState.alerts.set(alertId, {
      issuer: sender,
      title,
      message,
      priority,
      entityId,
      riskId,
      timestamp: 1000, // mock block height
      acknowledged: false,
      resolved: false
    })
    mockAlertState.alertCounter = alertId
    return { ok: alertId }
  },
  
  acknowledgeAlert: (alertId, sender) => {
    const alert = mockAlertState.alerts.get(alertId)
    if (!alert) {
      return { err: 401 } // not found
    }
    
    mockAlertState.alerts.set(alertId, {
      ...alert,
      acknowledged: true
    })
    return { ok: true }
  },
  
  resolveAlert: (alertId, sender) => {
    if (!mockAlertState.authorizedIssuers.get(sender)) {
      return { err: 402 } // unauthorized
    }
    
    const alert = mockAlertState.alerts.get(alertId)
    if (!alert) {
      return { err: 401 } // not found
    }
    
    mockAlertState.alerts.set(alertId, {
      ...alert,
      resolved: true
    })
    return { ok: true }
  },
  
  subscribeToAlerts: (entityIds, priorityThreshold, sender) => {
    mockAlertState.subscribers.set(sender, {
      entityIds,
      priorityThreshold,
      active: true
    })
    return { ok: true }
  },
  
  addIssuer: (issuer, sender) => {
    if (sender !== mockAlertState.contractOwner) {
      return { err: 400 } // owner only
    }
    mockAlertState.authorizedIssuers.set(issuer, true)
    return { ok: true }
  },
  
  getAlert: (alertId) => {
    return mockAlertState.alerts.get(alertId) || null
  },
  
  getSubscriber: (subscriber) => {
    return mockAlertState.subscribers.get(subscriber) || null
  },
  
  isAlertActive: (alertId) => {
    const alert = mockAlertState.alerts.get(alertId)
    return alert ? !alert.resolved : false
  }
}

describe('Alert Distribution Contract', () => {
  beforeEach(() => {
    mockAlertState.alerts.clear()
    mockAlertState.subscribers.clear()
    mockAlertState.authorizedIssuers.clear()
    mockAlertState.alertCounter = 0
  })
  
  it('should issue alert by authorized issuer', () => {
    const owner = mockAlertState.contractOwner
    const issuer = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    // Add issuer
    alertDistributionContract.addIssuer(issuer, owner)
    
    // Issue alert
    const result = alertDistributionContract.issueAlert(
        'Critical Supply Chain Risk',
        'Major supplier experiencing operational issues',
        4, // critical priority
        1, // entityId
        1, // riskId
        issuer
    )
    
    expect(result.ok).toBe(1)
    expect(mockAlertState.alertCounter).toBe(1)
    
    const alert = alertDistributionContract.getAlert(1)
    expect(alert.title).toBe('Critical Supply Chain Risk')
    expect(alert.priority).toBe(4)
    expect(alert.acknowledged).toBe(false)
    expect(alert.resolved).toBe(false)
  })
  
  it('should reject alert issuance from unauthorized user', () => {
    const unauthorized = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    const result = alertDistributionContract.issueAlert(
        'Test Alert',
        'Test message',
        2,
        1,
        1,
        unauthorized
    )
    
    expect(result.err).toBe(402) // unauthorized
  })
  
  it('should acknowledge alert', () => {
    const owner = mockAlertState.contractOwner
    const issuer = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    const subscriber = 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP'
    
    // Add issuer and issue alert
    alertDistributionContract.addIssuer(issuer, owner)
    const alertResult = alertDistributionContract.issueAlert(
        'Test Alert',
        'Test message',
        3,
        1,
        1,
        issuer
    )
    
    // Acknowledge alert
    const ackResult = alertDistributionContract.acknowledgeAlert(alertResult.ok, subscriber)
    
    expect(ackResult.ok).toBe(true)
    
    const alert = alertDistributionContract.getAlert(alertResult.ok)
    expect(alert.acknowledged).toBe(true)
  })
  
  it('should resolve alert by authorized issuer', () => {
    const owner = mockAlertState.contractOwner
    const issuer = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    // Add issuer and issue alert
    alertDistributionContract.addIssuer(issuer, owner)
    const alertResult = alertDistributionContract.issueAlert(
        'Test Alert',
        'Test message',
        2,
        1,
        1,
        issuer
    )
    
    // Resolve alert
    const resolveResult = alertDistributionContract.resolveAlert(alertResult.ok, issuer)
    
    expect(resolveResult.ok).toBe(true)
    expect(alertDistributionContract.isAlertActive(alertResult.ok)).toBe(false)
    
    const alert = alertDistributionContract.getAlert(alertResult.ok)
    expect(alert.resolved).toBe(true)
  })
  
  it('should manage alert subscriptions', () => {
    const subscriber = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    const entityIds = [1, 2, 3]
    const priorityThreshold = 2
    
    const result = alertDistributionContract.subscribeToAlerts(
        entityIds,
        priorityThreshold,
        subscriber
    )
    
    expect(result.ok).toBe(true)
    
    const subscription = alertDistributionContract.getSubscriber(subscriber)
    expect(subscription.entityIds).toEqual(entityIds)
    expect(subscription.priorityThreshold).toBe(priorityThreshold)
    expect(subscription.active).toBe(true)
  })
  
  it('should handle different priority levels', () => {
    const owner = mockAlertState.contractOwner
    const issuer = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    alertDistributionContract.addIssuer(issuer, owner)
    
    const priorities = [
      { level: 1, name: 'Low' },
      { level: 2, name: 'Medium' },
      { level: 3, name: 'High' },
      { level: 4, name: 'Critical' }
    ]
    
    priorities.forEach(({ level, name }) => {
      const result = alertDistributionContract.issueAlert(
          `${name} Priority Alert`,
          `${name} priority message`,
          level,
          1,
          1,
          issuer
      )
      
      expect(result.ok).toBeGreaterThan(0)
      
      const alert = alertDistributionContract.getAlert(result.ok)
      expect(alert.priority).toBe(level)
      expect(alert.title).toBe(`${name} Priority Alert`)
    })
  })
  
  it('should track alert lifecycle correctly', () => {
    const owner = mockAlertState.contractOwner
    const issuer = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    // Add issuer and issue alert
    alertDistributionContract.addIssuer(issuer, owner)
    const alertResult = alertDistributionContract.issueAlert(
        'Lifecycle Test',
        'Testing alert lifecycle',
        3,
        1,
        1,
        issuer
    )
    
    const alertId = alertResult.ok
    
    // Initially active and unacknowledged
    expect(alertDistributionContract.isAlertActive(alertId)).toBe(true)
    let alert = alertDistributionContract.getAlert(alertId)
    expect(alert.acknowledged).toBe(false)
    expect(alert.resolved).toBe(false)
    
    // Acknowledge alert
    alertDistributionContract.acknowledgeAlert(alertId, 'ST3NBRSFKX28FQ2ZJ1MAKX58HKHSDGNV5N7R21XCP')
    alert = alertDistributionContract.getAlert(alertId)
    expect(alert.acknowledged).toBe(true)
    expect(alert.resolved).toBe(false)
    expect(alertDistributionContract.isAlertActive(alertId)).toBe(true)
    
    // Resolve alert
    alertDistributionContract.resolveAlert(alertId, issuer)
    alert = alertDistributionContract.getAlert(alertId)
    expect(alert.acknowledged).toBe(true)
    expect(alert.resolved).toBe(true)
    expect(alertDistributionContract.isAlertActive(alertId)).toBe(false)
  })
})
