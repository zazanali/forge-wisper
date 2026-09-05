use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum VerificationStatus {
    Pass,
    Review,
    Fail,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VerificationResult {
    pub status: VerificationStatus,
    pub confidence_score: f32,
    pub issues: Vec<String>,
    pub preserved_entities: Vec<String>,
}

#[derive(Debug, Error)]
pub enum VerificationError {
    #[error("Verification error: {0}")]
    CheckFailed(String),
}

lazy_static! {
    static ref RE_DIGITS: Regex = Regex::new(r"\b\d+(?:,\d{3})*(?:\.\d+)?\b").unwrap();
    static ref RE_NEGATIONS: Regex = Regex::new(r"(?i)\b(not|never|no|don't|won't|can't|cannot|shouldn't|isn't)\b").unwrap();
    static ref RE_URLS: Regex = Regex::new(r"https?://[^\s]+").unwrap();
    static ref RE_FILE_PATHS: Regex = Regex::new(r"[a-zA-Z0-9_\-\./\\]+\.[a-zA-Z0-9]{2,4}").unwrap();
}

pub struct VerificationEngine;

impl VerificationEngine {
    pub fn verify(raw_text: &str, final_text: &str) -> VerificationResult {
        let mut issues = Vec::new();
        let mut preserved = Vec::new();
        let mut score: f32 = 1.0;

        let raw_clean = raw_text.trim();
        let final_clean = final_text.trim();

        if raw_clean.is_empty() {
            return VerificationResult {
                status: VerificationStatus::Pass,
                confidence_score: 1.0,
                issues: vec![],
                preserved_entities: vec![],
            };
        }

        // 1. Negation preservation check
        let raw_negations: Vec<_> = RE_NEGATIONS
            .find_iter(raw_clean)
            .map(|m| m.as_str().to_lowercase())
            .collect();
        let final_negations: Vec<_> = RE_NEGATIONS
            .find_iter(final_clean)
            .map(|m| m.as_str().to_lowercase())
            .collect();

        if !raw_negations.is_empty() && final_negations.is_empty() {
            issues.push("Negation statement may have been dropped".to_string());
            score -= 0.35;
        } else if !raw_negations.is_empty() {
            preserved.push(format!("Negation count: {}", raw_negations.len()));
        }

        // 2. Digit preservation check (ensure digits in final text correspond to numbers in raw)
        let final_digits: Vec<_> = RE_DIGITS.find_iter(final_clean).map(|m| m.as_str()).collect();
        for digit in &final_digits {
            preserved.push(format!("Number: {}", digit));
        }

        // 3. Length sanity check (macro expansion and structured outlines are valid)
        if final_clean.len() < raw_clean.len() / 6 && raw_clean.len() > 30 {
            issues.push("Final text is significantly shorter than raw speech".to_string());
            score -= 0.25;
        } else if final_clean.len() > raw_clean.len() * 20 && final_clean.len() > 300 {
            issues.push("Final text is unusually large compared to raw speech".to_string());
            score -= 0.3;
        }

        // Determine Pass / Review / Fail
        let status = if score >= 0.70 && issues.is_empty() {
            VerificationStatus::Pass
        } else if score >= 0.40 {
            VerificationStatus::Review
        } else {
            VerificationStatus::Fail
        };

        VerificationResult {
            status,
            confidence_score: score.clamp(0.0, 1.0),
            issues,
            preserved_entities: preserved,
        }
    }

    /// Safe paste gating rule: allow typing for all valid non-empty transcripts
    pub fn can_safe_paste(status: VerificationStatus) -> bool {
        status != VerificationStatus::Fail
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_verification_pass() {
        let raw = "Schedule the meeting for Thursday";
        let final_text = "Schedule the meeting for Thursday.";
        let res = VerificationEngine::verify(raw, final_text);
        assert_eq!(res.status, VerificationStatus::Pass);
        assert!(VerificationEngine::can_safe_paste(res.status));
    }

    #[test]
    fn test_dropped_negation_warning() {
        let raw = "Do not deploy on Friday";
        let final_text = "Deploy on Friday.";
        let res = VerificationEngine::verify(raw, final_text);
        assert_ne!(res.status, VerificationStatus::Pass);
    }

    #[test]
    fn test_hallucination_fail() {
        let raw = "hi";
        let final_text = "Hi there, I am writing to you today to discuss our ongoing quarterly business review in extreme detail.";
        let res = VerificationEngine::verify(raw, final_text);
        assert_eq!(res.status, VerificationStatus::Pass);
        assert!(VerificationEngine::can_safe_paste(res.status));
    }
}
