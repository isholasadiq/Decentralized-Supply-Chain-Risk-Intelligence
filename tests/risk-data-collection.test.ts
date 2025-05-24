import { describe, it, expect, beforeEach } from 'vitest'

// Mock contract state
const mockRiskDataState = {
  riskData: new Map(),
  riskCounter: 0,
  authorizedCollectors: new Map(),
  contractOwner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
}

// Mock contract functions
const riskDataContract = {
  submitRiskData: (entityId, riskType, description, severity, impactScore, sender) => {
    if (severity < 1 || severity > 4) {
      return { err: 203 } // invalid severity
    }
    
    const riskId = mockRiskDataState.riskCounter + 1
    mockRiskDataState.riskData.set(riskId, {
      reporter: sender,
      entityId,
      riskType,
      description,
      severity,
      timestamp: 1000, // mock block height
      verified: false,
      impactScore
    })
    mockRiskDataState.riskCounter = riskId
    return { ok: riskId }
  },
  
  verifyRiskData: (riskId, sender) => {
    if (!mockRiskDataState.authorizedCollectors.get(sender)) {
      return { err: 202 } // unauthorized
    }
    
    const risk = mockRiskDataState.riskData.get(riskId)
    if (!risk) {
      return { err: 201 } // not found
    }
    
    mockRiskDataState.riskData.set(riskId, {
      ...risk,
      verified: true
    })
    return { ok: true }
  },
  
  addCollector: (collector, sender) => {
    if (sender !== mockRiskDataState.contractOwner) {
      return { err: 200 } // owner only
    }
    mockRiskDataState.authorizedCollectors.set(collector, true)
    return { ok: true }
  },
  
  getRiskData: (riskId) => {
    return mockRiskDataState.riskData.get(riskId) || null
  },
  
  isRiskVerified: (riskId) => {
    const risk = mockRiskDataState.riskData.get(riskId)
    return risk ? risk.verified : false
  }
}

describe('Risk Data Collection Contract', () => {
  beforeEach(() => {
    mockRiskDataState.riskData.clear()
    mockRiskDataState.authorizedCollectors.clear()
    mockRiskDataState.riskCounter = 0
  })
  
  it('should submit risk data successfully', () => {
    const result = riskDataContract.submitRiskData(
        1, // entityId
        'Supply Disruption',
        'Potential supplier bankruptcy',
        3, // high severity
        80, // impact score
        'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
    )
    
    expect(result.ok).toBe(1)
    expect(mockRiskDataState.riskCounter).toBe(1)
    
    const riskData = riskDataContract.getRiskData(1)
    expect(riskData.riskType).toBe('Supply Disruption')
    expect(riskData.severity).toBe(3)
    expect(riskData.verified).toBe(false)
  })
  
  it('should reject invalid severity levels', () => {
    const result = riskDataContract.submitRiskData(
        1,
        'Test Risk',
        'Test description',
        5, // invalid severity
        50,
        'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
    )
    
    expect(result.err).toBe(203) // invalid severity
  })
  
  it('should verify risk data by authorized collector', () => {
    const owner = mockRiskDataState.contractOwner
    const collector = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    // Add collector
    riskDataContract.addCollector(collector, owner)
    
    // Submit risk data
    const submitResult = riskDataContract.submitRiskData(
        1,
        'Cyber Threat',
        'Potential data breach',
        4, // critical
        90,
        owner
    )
    
    // Verify risk data
    const verifyResult = riskDataContract.verifyRiskData(submitResult.ok, collector)
    
    expect(verifyResult.ok).toBe(true)
    expect(riskDataContract.isRiskVerified(submitResult.ok)).toBe(true)
  })
  
  it('should reject verification from unauthorized user', () => {
    const owner = mockRiskDataState.contractOwner
    const unauthorized = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    // Submit risk data
    const submitResult = riskDataContract.submitRiskData(
        1,
        'Test Risk',
        'Test description',
        2,
        60,
        owner
    )
    
    // Try to verify without authorization
    const verifyResult = riskDataContract.verifyRiskData(submitResult.ok, unauthorized)
    
    expect(verifyResult.err).toBe(202) // unauthorized
  })
  
  it('should handle different severity levels correctly', () => {
    const severityLevels = [
      { level: 1, name: 'Low' },
      { level: 2, name: 'Medium' },
      { level: 3, name: 'High' },
      { level: 4, name: 'Critical' }
    ]
    
    severityLevels.forEach(({ level, name }) => {
      const result = riskDataContract.submitRiskData(
          1,
          `${name} Risk`,
          `${name} severity risk`,
          level,
          level * 25,
          'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
      )
      
      expect(result.ok).toBeGreaterThan(0)
      
      const riskData = riskDataContract.getRiskData(result.ok)
      expect(riskData.severity).toBe(level)
    })
  })
})
