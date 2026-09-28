const policies = new Map();

export function createPolicyRecord(policy) {
  policies.set(policy.policyId, policy);
  return policy;
}

export function getPolicyById(policyId) {
  return policies.get(policyId) || null;
}

export function listPolicies() {
  return Array.from(policies.values());
}

export function clearPolicies() {
  policies.clear();
}
