import { describe, it, expect, beforeEach } from 'vitest'

// Mock contract state
const mockAssessmentState = {
  assessments: new Map(),
  assessmentCounter: 0,
  authorizedAssessors: new Map(),
  contractOwner: 'ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM'
}

// Mock contract functions
const riskAssessmentContract = {
  calculateRiskScore: (vulnerabilityCount) => {
    if (vulnerabilityCount <= 5) return 20
    if (vulnerabilityCount <= 10) return 40
    if (vulnerabilityCount <= 20) return 60
    if (vulnerabilityCount <= 30) return 80
    return 100
  },
  
  createAssessment: (entityId, vulnerabilityCount, recommendations, sender) => {
    if (!mockAssessmentState.authorizedAssessors.get(sender)) {
      return { err: 302 } // unauthorized
    }
    
    const assessmentId = mockAssessmentState.assessmentCounter + 1
    const riskScore = riskAssessmentContract.calculateRiskScore(vulnerabilityCount)
    
    mockAssessmentState.assessments.set(assessmentId, {
      assessor: sender,
      entityId,
      overallRiskScore: riskScore,
      vulnerabilityCount,
      assessmentDate: 1000, // mock block height
      recommendations,
      nextReviewDate: 2000 // mock future block height
    })
    mockAssessmentState.assessmentCounter = assessmentId
    return { ok: assessmentId }
  },
  
  updateAssessment: (assessmentId, vulnerabilityCount, recommendations, sender) => {
    if (!mockAssessmentState.authorizedAssessors.get(sender)) {
      return { err: 302 } // unauthorized
    }
    
    const assessment = mockAssessmentState.assessments.get(assessmentId)
    if (!assessment) {
      return { err: 301 } // not found
    }
    
    const newRiskScore = riskAssessmentContract.calculateRiskScore(vulnerabilityCount)
    
    mockAssessmentState.assessments.set(assessmentId, {
      ...assessment,
      overallRiskScore: newRiskScore,
      vulnerabilityCount,
      recommendations,
      assessmentDate: 1100 // updated timestamp
    })
    return { ok: true }
  },
  
  addAssessor: (assessor, sender) => {
    if (sender !== mockAssessmentState.contractOwner) {
      return { err: 300 } // owner only
    }
    mockAssessmentState.authorizedAssessors.set(assessor, true)
    return { ok: true }
  },
  
  getAssessment: (assessmentId) => {
    return mockAssessmentState.assessments.get(assessmentId) || null
  },
  
  isReviewDue: (assessmentId, currentBlock = 2500) => {
    const assessment = mockAssessmentState.assessments.get(assessmentId)
    return assessment ? currentBlock >= assessment.nextReviewDate : false
  }
}

describe('Risk Assessment Contract', () => {
  beforeEach(() => {
    mockAssessmentState.assessments.clear()
    mockAssessmentState.authorizedAssessors.clear()
    mockAssessmentState.assessmentCounter = 0
  })
  
  it('should calculate risk scores correctly', () => {
    expect(riskAssessmentContract.calculateRiskScore(3)).toBe(20)   // Low risk
    expect(riskAssessmentContract.calculateRiskScore(8)).toBe(40)   // Medium risk
    expect(riskAssessmentContract.calculateRiskScore(15)).toBe(60)  // High risk
    expect(riskAssessmentContract.calculateRiskScore(25)).toBe(80)  // Very high risk
    expect(riskAssessmentContract.calculateRiskScore(35)).toBe(100) // Critical risk
  })
  
  it('should create assessment by authorized assessor', () => {
    const owner = mockAssessmentState.contractOwner
    const assessor = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    // Add assessor
    riskAssessmentContract.addAssessor(assessor, owner)
    
    // Create assessment
    const result = riskAssessmentContract.createAssessment(
        1, // entityId
        12, // vulnerabilityCount
        'Implement additional security measures',
        assessor
    )
    
    expect(result.ok).toBe(1)
    expect(mockAssessmentState.assessmentCounter).toBe(1)
    
    const assessment = riskAssessmentContract.getAssessment(1)
    expect(assessment.entityId).toBe(1)
    expect(assessment.vulnerabilityCount).toBe(12)
    expect(assessment.overallRiskScore).toBe(60) // High risk for 12 vulnerabilities
    expect(assessment.recommendations).toBe('Implement additional security measures')
  })
  
  it('should reject assessment creation from unauthorized user', () => {
    const unauthorized = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    const result = riskAssessmentContract.createAssessment(
        1,
        5,
        'Test recommendations',
        unauthorized
    )
    
    expect(result.err).toBe(302) // unauthorized
  })
  
  it('should update existing assessment', () => {
    const owner = mockAssessmentState.contractOwner
    const assessor = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    // Add assessor and create assessment
    riskAssessmentContract.addAssessor(assessor, owner)
    const createResult = riskAssessmentContract.createAssessment(
        1,
        10,
        'Initial recommendations',
        assessor
    )
    
    // Update assessment
    const updateResult = riskAssessmentContract.updateAssessment(
        createResult.ok,
        5, // reduced vulnerabilities
        'Updated recommendations after mitigation',
        assessor
    )
    
    expect(updateResult.ok).toBe(true)
    
    const assessment = riskAssessmentContract.getAssessment(createResult.ok)
    expect(assessment.vulnerabilityCount).toBe(5)
    expect(assessment.overallRiskScore).toBe(20) // Reduced risk score
    expect(assessment.recommendations).toBe('Updated recommendations after mitigation')
  })
  
  it('should determine if review is due', () => {
    const owner = mockAssessmentState.contractOwner
    const assessor = 'ST2CY5V39NHDPWSXMW9QDT3HC3GD6Q6XX4CFRK9AG'
    
    // Add assessor and create assessment
    riskAssessmentContract.addAssessor(assessor, owner)
    const createResult = riskAssessmentContract.createAssessment(
        1,
        8,
        'Regular assessment',
        assessor
    )
    
    // Check if review is due (should be false initially)
    expect(riskAssessmentContract.isReviewDue(createResult.ok, 1500)).toBe(false)
    
    // Check if review is due after target date (should be true)
    expect(riskAssessmentContract.isReviewDue(createResult.ok, 2500)).toBe(true)
  })
  
  it('should handle edge cases in risk calculation', () => {
    const testCases = [
      { vulnerabilities: 0, expectedScore: 20 },
      { vulnerabilities: 5, expectedScore: 20 },
      { vulnerabilities: 6, expectedScore: 40 },
      { vulnerabilities: 10, expectedScore: 40 },
      { vulnerabilities: 11, expectedScore: 60 },
      { vulnerabilities: 20, expectedScore: 60 },
      { vulnerabilities: 21, expectedScore: 80 },
      { vulnerabilities: 30, expectedScore: 80 },
      { vulnerabilities: 31, expectedScore: 100 },
      { vulnerabilities: 100, expectedScore: 100 }
    ]
    
    testCases.forEach(({ vulnerabilities, expectedScore }) => {
      expect(riskAssessmentContract.calculateRiskScore(vulnerabilities)).toBe(expectedScore)
    })
  })
})
