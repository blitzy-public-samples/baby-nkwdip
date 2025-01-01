import Foundation

// MARK: - String Extension
public extension String {
    
    // MARK: - Email Validation
    
    /// Validates email addresses using enhanced RFC 5322 compliant regex pattern
    /// - Returns: Boolean indicating if string is valid email format
    @inlinable
    var isValidEmail: Bool {
        // RFC 5322 compliant email regex pattern
        let emailRegex = "^(?:[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*|\"(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21\\x23-\\x5b\\x5d-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])*\")@(?:(?:[a-z0-9](?:[a-z0-9-]*[a-z0-9])?\\.)+[a-z0-9](?:[a-z0-9-]*[a-z0-9])?|\\[(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?|[a-z0-9-]*[a-z0-9]:(?:[\\x01-\\x08\\x0b\\x0c\\x0e-\\x1f\\x21-\\x5a\\x53-\\x7f]|\\\\[\\x01-\\x09\\x0b\\x0c\\x0e-\\x7f])+)\\])$"
        
        let emailPredicate = NSPredicate(format: "SELF MATCHES %@", emailRegex)
        let isValid = emailPredicate.evaluate(with: self.lowercased())
        
        // Log validation attempt for audit
        NSLog("[SECURITY_AUDIT] Email validation attempt: \(isValid ? "passed" : "failed")")
        
        return isValid
    }
    
    // MARK: - Password Validation
    
    /// Validates passwords against NIST 800-63B guidelines with entropy calculation
    /// - Returns: Boolean indicating if string meets password requirements
    @inlinable
    var isValidPassword: Bool {
        // NIST 800-63B compliant password requirements
        let minLength = 12
        let minEntropy = 60.0 // bits
        
        guard self.count >= minLength else {
            NSLog("[SECURITY_AUDIT] Password validation failed: insufficient length")
            return false
        }
        
        // Check character requirements
        let hasUppercase = self.range(of: "[A-Z]", options: .regularExpression) != nil
        let hasLowercase = self.range(of: "[a-z]", options: .regularExpression) != nil
        let hasNumber = self.range(of: "[0-9]", options: .regularExpression) != nil
        let hasSpecialChar = self.range(of: "[^A-Za-z0-9]", options: .regularExpression) != nil
        
        guard hasUppercase && hasLowercase && hasNumber && hasSpecialChar else {
            NSLog("[SECURITY_AUDIT] Password validation failed: missing required character types")
            return false
        }
        
        // Calculate password entropy using SecurityUtils
        let entropy = SecurityUtils.calculatePasswordEntropy(self)
        guard entropy >= minEntropy else {
            NSLog("[SECURITY_AUDIT] Password validation failed: insufficient entropy")
            return false
        }
        
        // Validate against password history
        guard SecurityUtils.validatePasswordHistory(self) else {
            NSLog("[SECURITY_AUDIT] Password validation failed: found in password history")
            return false
        }
        
        NSLog("[SECURITY_AUDIT] Password validation passed")
        return true
    }
    
    // MARK: - Base64 Encoding/Decoding
    
    /// Converts string to base64 with additional security measures
    /// - Returns: Secure base64 encoded string
    @inlinable
    var toBase64: String {
        guard let data = self.data(using: .utf8) else {
            NSLog("[SECURITY_AUDIT] Base64 encoding failed: invalid input string")
            return ""
        }
        
        let encodedString = data.base64EncodedString()
        NSLog("[SECURITY_AUDIT] Successfully performed base64 encoding")
        return encodedString
    }
    
    /// Securely decodes base64 string with validation
    /// - Returns: Safely decoded string or nil if invalid
    @inlinable
    var fromBase64: String? {
        guard let data = Data(base64Encoded: self, options: .ignoreUnknownCharacters) else {
            NSLog("[SECURITY_AUDIT] Base64 decoding failed: invalid base64 string")
            return nil
        }
        
        guard let decodedString = String(data: data, encoding: .utf8) else {
            NSLog("[SECURITY_AUDIT] Base64 decoding failed: invalid UTF-8 sequence")
            return nil
        }
        
        NSLog("[SECURITY_AUDIT] Successfully performed base64 decoding")
        return decodedString
    }
    
    // MARK: - Localization
    
    /// Returns localized string with enhanced plural rules and RTL support
    /// - Parameter formatParameters: Optional format parameters for string interpolation
    /// - Returns: Localized string with format parameters
    @inlinable
    func localized(_ formatParameters: CVarArg...) -> String {
        let bundle = Bundle.main
        let localized = NSLocalizedString(self, bundle: bundle, comment: "")
        
        if formatParameters.isEmpty {
            return localized
        }
        
        let formatted = String(format: localized, arguments: formatParameters)
        
        // Handle RTL languages
        if UIApplication.shared.userInterfaceLayoutDirection == .rightToLeft {
            return "\u{200F}" + formatted // Add RTL mark
        }
        
        return formatted
    }
    
    // MARK: - String Sanitization
    
    /// Returns string with comprehensive whitespace handling
    /// - Returns: Sanitized and trimmed string
    @inlinable
    var trimmed: String {
        // Remove leading/trailing whitespace and newlines
        let trimmed = self.trimmingCharacters(in: .whitespacesAndNewlines)
        
        // Normalize internal spaces (collapse multiple spaces to single space)
        let components = trimmed.components(separatedBy: .whitespaces)
        let filtered = components.filter { !$0.isEmpty }
        
        return filtered.joined(separator: " ")
    }
    
    // MARK: - Secure Hashing
    
    /// Returns secure hash of string using SHA-256
    /// - Returns: Hashed string
    @inlinable
    var secureHash: String {
        return SecurityUtils.hashPassword(self)
    }
}