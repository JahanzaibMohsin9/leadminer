use crate::error::{NativeError, Result};
use crate::types::{License, LicenseTier};
use base64::{engine::general_purpose, Engine as _};
use chrono::{DateTime, Utc};
use rsa::{
    pkcs8::DecodePublicKey,
    Pkcs1v15Sign, RsaPublicKey,
};
use sha2::{Digest, Sha256};
use sysinfo::{System, Networks, Disks};

/// License validator with RSA-2048 signature verification
pub struct LicenseValidator {
    public_key: RsaPublicKey,
    hardware_id: String,
}

impl LicenseValidator {
    /// Create a new license validator
    /// In production, the public key would be embedded in the binary
    pub fn new() -> Result<Self> {
        // This is a placeholder public key - in production, use your actual public key
        let public_key_pem = include_str!("../keys/public_key.pem");
        
        let public_key = RsaPublicKey::from_public_key_pem(public_key_pem)
            .map_err(|e| NativeError::CryptoError(format!("Failed to load public key: {}", e)))?;

        let hardware_id = Self::generate_hardware_fingerprint()?;

        Ok(Self {
            public_key,
            hardware_id,
        })
    }

    /// Validate a license
    pub fn validate_license(&self, license: &License) -> Result<bool> {
        // 1. Check expiration
        if !self.check_expiration(license) {
            return Err(NativeError::LicenseExpired);
        }

        // 2. Check hardware binding
        if license.hardware_id != self.hardware_id {
            return Err(NativeError::HardwareMismatch);
        }

        // 3. Verify signature
        if !self.verify_signature(license)? {
            return Err(NativeError::InvalidLicenseKey);
        }

        Ok(true)
    }

    /// Check if license has expired
    pub fn check_expiration(&self, license: &License) -> bool {
        if let Some(expires_at) = license.expires_at {
            Utc::now() < expires_at
        } else {
            true // No expiration
        }
    }

    /// Verify RSA signature
    fn verify_signature(&self, license: &License) -> Result<bool> {
        // Create the message to verify
        let message = format!(
            "{}:{}:{}:{}",
            license.key,
            serde_json::to_string(&license.tier).unwrap(),
            license.issued_at.to_rfc3339(),
            license.hardware_id
        );

        let mut hasher = Sha256::new();
        hasher.update(message.as_bytes());
        let hash = hasher.finalize();

        // Verify signature using PKCS1v15 with raw bytes
        let padding = Pkcs1v15Sign::new_unprefixed();
        self.public_key
            .verify(padding, &hash, &license.signature)
            .map(|_| true)
            .map_err(|e| NativeError::CryptoError(format!("Signature verification failed: {}", e)))
    }

    /// Get the current hardware fingerprint
    pub fn get_hardware_fingerprint(&self) -> String {
        self.hardware_id.clone()
    }

    /// Generate hardware fingerprint from system information
    fn generate_hardware_fingerprint() -> Result<String> {
        let mut hasher = Sha256::new();

        // Get system information
        let sys = System::new_all();

        // 1. CPU Brand (use first CPU)
        if let Some(cpu) = sys.cpus().first() {
            hasher.update(cpu.brand().as_bytes());
        }

        // 2. MAC address (first network interface)
        let networks = Networks::new_with_refreshed_list();
        if let Some((_, network)) = networks.iter().next() {
            let mac = network.mac_address();
            hasher.update(mac.to_string().as_bytes());
        }

        // 3. Disk name (use first disk)
        let disks = Disks::new_with_refreshed_list();
        if let Some(disk) = disks.list().first() {
            // Use disk name as a stable identifier
            let disk_name = disk.name().to_string_lossy();
            hasher.update(disk_name.as_bytes());
        }

        // 4. System name for additional uniqueness
        if let Some(hostname) = System::host_name() {
            hasher.update(hostname.as_bytes());
        }

        let hash = hasher.finalize();
        Ok(format!("{:x}", hash))
    }

    /// Parse a license key string into a License object
    pub fn parse_license_key(&self, key_string: &str) -> Result<License> {
        // Expected format: "LM-{base64_encoded_license_data}"
        if !key_string.starts_with("LM-") {
            return Err(NativeError::InvalidLicenseKey);
        }

        let encoded = &key_string[3..];
        let decoded = general_purpose::STANDARD
            .decode(encoded)
            .map_err(|e| NativeError::CryptoError(format!("Failed to decode license: {}", e)))?;

        let license: License = serde_json::from_slice(&decoded)
            .map_err(|e| NativeError::SerializationError(e))?;

        Ok(license)
    }

    /// Create a simple license for testing (would be done by license server in production)
    #[cfg(test)]
    pub fn create_test_license(&self, tier: LicenseTier, expires_at: Option<DateTime<Utc>>) -> License {
        use rand::Rng;
        
        let key = format!("LM-{}", rand::thread_rng().gen::<u64>());
        
        License {
            key,
            tier,
            issued_at: Utc::now(),
            expires_at,
            hardware_id: self.hardware_id.clone(),
            signature: vec![0; 256], // Dummy signature for testing
        }
    }
}

impl Default for LicenseValidator {
    fn default() -> Self {
        Self::new().expect("Failed to create license validator")
    }
}

/// License manager for handling license operations
pub struct LicenseManager {
    validator: LicenseValidator,
    current_license: Option<License>,
}

impl LicenseManager {
    pub fn new() -> Result<Self> {
        Ok(Self {
            validator: LicenseValidator::new()?,
            current_license: None,
        })
    }

    /// Activate a license
    pub fn activate_license(&mut self, license_key: &str) -> Result<()> {
        let license = self.validator.parse_license_key(license_key)?;
        
        // Validate the license
        self.validator.validate_license(&license)?;
        
        self.current_license = Some(license);
        Ok(())
    }

    /// Deactivate the current license
    pub fn deactivate_license(&mut self) {
        self.current_license = None;
    }

    /// Check if a valid license is active
    pub fn is_licensed(&self) -> bool {
        if let Some(license) = &self.current_license {
            self.validator.validate_license(license).is_ok()
        } else {
            false
        }
    }

    /// Get the current license tier
    pub fn get_tier(&self) -> Option<LicenseTier> {
        self.current_license.as_ref().map(|l| l.tier)
    }

    /// Get license information
    pub fn get_license_info(&self) -> Option<LicenseInfo> {
        self.current_license.as_ref().map(|l| LicenseInfo {
            tier: l.tier,
            issued_at: l.issued_at,
            expires_at: l.expires_at,
            days_remaining: l.expires_at.map(|exp| {
                let now = Utc::now();
                if exp > now {
                    (exp - now).num_days()
                } else {
                    0
                }
            }),
        })
    }

    /// Get hardware fingerprint
    pub fn get_hardware_fingerprint(&self) -> String {
        self.validator.get_hardware_fingerprint()
    }
}

impl Default for LicenseManager {
    fn default() -> Self {
        Self::new().expect("Failed to create license manager")
    }
}

/// License information for display
#[derive(Debug, Clone)]
pub struct LicenseInfo {
    pub tier: LicenseTier,
    pub issued_at: DateTime<Utc>,
    pub expires_at: Option<DateTime<Utc>>,
    pub days_remaining: Option<i64>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    #[test]
    fn test_hardware_fingerprint_consistency() {
        let fp1 = LicenseValidator::generate_hardware_fingerprint().unwrap();
        let fp2 = LicenseValidator::generate_hardware_fingerprint().unwrap();
        
        assert_eq!(fp1, fp2, "Hardware fingerprint should be consistent");
    }

    #[test]
    fn test_license_expiration() {
        let validator = LicenseValidator::new().unwrap();
        
        // Create expired license
        let expired = validator.create_test_license(
            LicenseTier::Basic,
            Some(Utc::now() - Duration::days(1)),
        );
        
        assert!(!validator.check_expiration(&expired));
        
        // Create valid license
        let valid = validator.create_test_license(
            LicenseTier::Pro,
            Some(Utc::now() + Duration::days(30)),
        );
        
        assert!(validator.check_expiration(&valid));
    }

    #[test]
    fn test_license_manager() {
        let mut manager = LicenseManager::new().unwrap();
        
        assert!(!manager.is_licensed());
        assert!(manager.get_tier().is_none());
    }
}
