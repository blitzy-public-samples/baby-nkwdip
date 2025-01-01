## Description

### Summary of changes
<!-- Provide a clear and concise description of the changes -->

### Related issue
<!-- Reference the issue number: #(issue) -->

### Type of change
- [ ] Feature
- [ ] Bug fix
- [ ] Refactor
- [ ] Documentation

### Impact assessment
<!-- Describe the impact of these changes on existing functionality -->

### Mobile platforms affected
- [ ] iOS
- [ ] Android
- [ ] None

### Backend services modified
<!-- List the backend services impacted by these changes -->

## Quality Checklist
<!-- All items must be checked before requesting review -->
- [ ] Unit tests added/updated with >80% coverage
- [ ] Integration tests verified and passing
- [ ] Mobile platform tests completed:
  - [ ] iOS tests passing
  - [ ] Android tests passing
- [ ] Performance tests meet SLA requirements
- [ ] Code quality checks passing:
  - [ ] ESLint (Node.js/React Native)
  - [ ] SwiftLint (iOS)
  - [ ] Kotlin checks (Android)
- [ ] TypeScript types verified and documented
- [ ] React Native component tests passing
- [ ] Accessibility requirements (WCAG 2.1 AA) verified:
  - [ ] Screen reader support
  - [ ] Color contrast ratios
  - [ ] Touch target sizes
- [ ] Mobile responsive design verified on all screen sizes
- [ ] Error handling implemented and tested

## Security Checklist
<!-- All security requirements must be met -->
- [ ] OWASP Mobile Top 10 guidelines followed
- [ ] Data encryption (AES-256) implemented for:
  - [ ] Data at rest
  - [ ] Data in transit
- [ ] Authentication/Authorization:
  - [ ] JWT implementation verified
  - [ ] Role-based access control tested
- [ ] Input validation/sanitization complete
- [ ] Dependency vulnerabilities checked
- [ ] Healthcare data compliance:
  - [ ] HIPAA requirements met
  - [ ] Audit logging implemented
- [ ] Privacy compliance:
  - [ ] GDPR requirements satisfied
  - [ ] COPPA compliance verified
- [ ] Secure data storage:
  - [ ] Mobile secure storage
  - [ ] Cloud storage encryption
- [ ] API security:
  - [ ] Security headers configured
  - [ ] Rate limiting implemented

## Documentation Checklist
- [ ] API documentation (OpenAPI 3.0) updated
- [ ] README updates completed
- [ ] Code comments added/updated
- [ ] Change log updated
- [ ] Migration guide updated (if applicable)
- [ ] Mobile setup instructions updated
- [ ] Security documentation updated
- [ ] Performance benchmarks documented

## Testing Evidence
<!-- Attach or link to relevant test results -->

### Test Coverage Report
<!-- Include test coverage metrics -->

### Performance Test Results
<!-- Include performance benchmarks -->

### Security Scan Results
<!-- Attach security scanning reports -->

### Mobile Device Testing Matrix
<!-- List devices/OS versions tested -->

### Accessibility Test Results
<!-- Include accessibility compliance report -->

### Load Test Results
<!-- Include load testing metrics -->

### API Integration Test Results
<!-- Include API test results -->

## Reviewer Notes

### Special Review Areas
<!-- Highlight areas needing careful review -->

### Testing Instructions
<!-- Steps to test the changes -->

### Deployment Considerations
<!-- Special deployment requirements -->

### Mobile Platform Considerations
<!-- Platform-specific deployment notes -->

### Rollback Plan
<!-- Steps to rollback if needed -->

### Feature Flag Requirements
<!-- Feature flag configuration if applicable -->

### Database Migration Steps
<!-- Database changes and migration process -->

## Required Status Checks
<!-- All checks must pass before merge -->
- [ ] Code Quality Checks
- [ ] Security Scans
- [ ] Privacy Compliance
- [ ] Unit Tests
- [ ] Integration Tests
- [ ] Mobile Platform Tests (iOS)
- [ ] Mobile Platform Tests (Android)
- [ ] CODEOWNERS Review
- [ ] Performance Tests
- [ ] Accessibility Tests

## Optional Status Checks
- [ ] Documentation Review
- [ ] Load Tests
- [ ] E2E Tests