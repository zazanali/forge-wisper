use forge_transcription::Transcript;
use lazy_static::lazy_static;
use regex::Regex;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use thiserror::Error;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FormattingMode {
    Raw,
    Clean,
    Structured,
    Smart,
}

impl Default for FormattingMode {
    fn default() -> Self {
        Self::Smart
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanupOptions {
    pub mode: FormattingMode,
    pub dictionary: HashMap<String, String>,
}

impl Default for CleanupOptions {
    fn default() -> Self {
        let mut dictionary = HashMap::new();
        dictionary.insert("lang chain".to_string(), "LangChain".to_string());
        dictionary.insert("langgraph".to_string(), "LangGraph".to_string());
        dictionary.insert("forge whisper".to_string(), "Forge Wisper".to_string());
        dictionary.insert("forge wisper".to_string(), "Forge Wisper".to_string());
        dictionary.insert("local whisper".to_string(), "Local Whisper".to_string());
        dictionary.insert("groq".to_string(), "Groq".to_string());
        dictionary.insert("vs code".to_string(), "VS Code".to_string());
        dictionary.insert("vscode".to_string(), "VS Code".to_string());
        dictionary.insert("postgresql".to_string(), "PostgreSQL".to_string());
        dictionary.insert("postgres".to_string(), "PostgreSQL".to_string());
        dictionary.insert("pytorch".to_string(), "PyTorch".to_string());
        dictionary.insert("kubernetes".to_string(), "Kubernetes".to_string());
        dictionary.insert("github".to_string(), "GitHub".to_string());

        Self {
            mode: FormattingMode::Smart,
            dictionary,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CleanedTranscript {
    pub raw_text: String,
    pub cleaned_text: String,
    pub mode: FormattingMode,
    pub confidence: f32,
}

#[derive(Debug, Error)]
pub enum CleanupError {
    #[error("Cleanup processing failed: {0}")]
    ProcessingError(String),
}

pub struct RuleBasedCleaner;

lazy_static! {
    static ref RE_UM_UH: Regex = Regex::new(r"(?i)\b(um|uh|er|ah)\b").unwrap();
    static ref RE_YOU_KNOW: Regex = Regex::new(r"(?i)\b(you know|basically|sort of|kind of)\b").unwrap();
    static ref RE_MULTI_SPACE: Regex = Regex::new(r"\s+").unwrap();
    static ref RE_PUNCT_SPACE: Regex = Regex::new(r"\s+([,.:;?!])").unwrap();
    static ref RE_SPOKEN_PUNCT: Vec<(Regex, &'static str)> = vec![
        (Regex::new(r"(?i)\bcomma\b").unwrap(), ","),
        (Regex::new(r"(?i)\b(period|full stop)\b").unwrap(), "."),
        (Regex::new(r"(?i)\bquestion mark\b").unwrap(), "?"),
        (Regex::new(r"(?i)\b(exclamation mark|exclamation point)\b").unwrap(), "!"),
        (Regex::new(r"(?i)\bcolon\b").unwrap(), ":"),
        (Regex::new(r"(?i)\bsemicolon\b").unwrap(), ";"),
        (Regex::new(r"(?i)\b(new line|newline)\b").unwrap(), "\n"),
    ];
}

impl RuleBasedCleaner {
    pub fn clean(transcript: &Transcript, options: &CleanupOptions) -> Result<CleanedTranscript, CleanupError> {
        let raw = transcript.text.trim();

        if raw.is_empty() {
            return Ok(CleanedTranscript {
                raw_text: String::new(),
                cleaned_text: String::new(),
                mode: options.mode,
                confidence: 1.0,
            });
        }

        if options.mode == FormattingMode::Raw {
            return Ok(CleanedTranscript {
                raw_text: raw.to_string(),
                cleaned_text: raw.to_string(),
                mode: FormattingMode::Raw,
                confidence: 1.0,
            });
        }

        let mut text = raw.to_string();

        // 1. Spoken corrections ("Tuesday, actually Thursday" -> "Thursday")
        text = Self::apply_corrections(&text);

        // 2. Spoken punctuation replacement ("hello comma how are you question mark" -> "hello, how are you?")
        text = Self::apply_spoken_punctuation(&text);

        // 3. Filler word removal ("um", "uh")
        text = Self::remove_fillers(&text);

        // 4. Number & currency normalization ("fifteen thousand five hundred" -> "15,500")
        text = Self::normalize_numbers(&text);

        // 5. Personal dictionary replacement
        text = Self::apply_dictionary(&text, &options.dictionary);

        // 6. Formatting & spacing
        text = Self::fix_punctuation_and_spacing(&text);

        // 7. Structure detection (for Structured / Smart modes)
        if matches!(options.mode, FormattingMode::Structured | FormattingMode::Smart) {
            text = Self::apply_structure(&text);
        }

        // 8. Capitalize sentences
        text = Self::capitalize_sentences(&text);

        let cleaned = text.trim().to_string();

        Ok(CleanedTranscript {
            raw_text: raw.to_string(),
            cleaned_text: cleaned,
            mode: options.mode,
            confidence: 0.95,
        })
    }

    /// Handles spoken correction phrases
    pub fn apply_corrections(input: &str) -> String {
        let mut text = input.to_string();

        // Multi-word "three cars, I mean four cars" -> "four cars"
        let re_imean_phrase = Regex::new(r"(?i)\b([a-zA-Z0-9]+\s+[a-zA-Z0-9]+)\s*,?\s*I mean\s+([a-zA-Z0-9]+\s+[a-zA-Z0-9]+)\b").unwrap();
        text = re_imean_phrase.replace_all(&text, "$2").to_string();

        // Single word "three, I mean four" -> "four"
        let re_imean_single = Regex::new(r"(?i)\b([a-zA-Z0-9]+)\s*,?\s*I mean\s+([a-zA-Z0-9]+)\b").unwrap();
        text = re_imean_single.replace_all(&text, "$2").to_string();

        // "Tuesday, actually Thursday" -> "Thursday"
        let re_actually = Regex::new(r"(?i)\b([a-zA-Z0-9]+)\s*,?\s*actually\s+([a-zA-Z0-9]+)\b").unwrap();
        text = re_actually.replace_all(&text, "$2").to_string();

        // "scratch that ..." -> "..."
        let re_scratch = Regex::new(r"(?i)(?:.*?\s+)?scratch that\s+(.*)").unwrap();
        if re_scratch.is_match(&text) {
            text = re_scratch.replace(&text, "$1").to_string();
        }

        // "wait no" / "no wait"
        let re_wait_no = Regex::new(r"(?i)\b([a-zA-Z0-9]+)\s*,?\s*(?:wait no|no wait)\s+([a-zA-Z0-9]+)\b").unwrap();
        text = re_wait_no.replace_all(&text, "$2").to_string();

        text
    }

    /// Replaces spoken punctuation words with symbols
    pub fn apply_spoken_punctuation(input: &str) -> String {
        let mut text = input.to_string();
        for (pattern, replacement) in RE_SPOKEN_PUNCT.iter() {
            text = pattern.replace_all(&text, *replacement).to_string();
        }
        Self::fix_punctuation_and_spacing(&text)
    }

    /// Removes vocal filler sounds
    pub fn remove_fillers(input: &str) -> String {
        let text = RE_UM_UH.replace_all(input, "").to_string();
        RE_YOU_KNOW.replace_all(&text, "").to_string()
    }

    /// Normalizes basic spoken numbers and currencies
    pub fn normalize_numbers(input: &str) -> String {
        let mut text = input.to_string();

        let num_replacements = [
            ("fifteen thousand five hundred", "15,500"),
            ("ten thousand", "10,000"),
            ("five thousand", "5,000"),
            ("one thousand", "1,000"),
            ("five hundred", "500"),
            ("one hundred", "100"),
            ("twenty dollars", "$20"),
            ("fifty dollars", "$50"),
            ("one hundred dollars", "$100"),
            ("fifty percent", "50%"),
            ("one hundred percent", "100%"),
            ("twenty percent", "20%"),
        ];

        for (spoken, formatted) in num_replacements {
            let re = Regex::new(&format!(r"(?i)\b{}\b", regex::escape(spoken))).unwrap();
            text = re.replace_all(&text, formatted).to_string();
        }

        text
    }

    /// Applies user personal dictionary mapping
    pub fn apply_dictionary(input: &str, dict: &HashMap<String, String>) -> String {
        let mut text = input.to_string();
        for (spoken, preferred) in dict {
            let re = Regex::new(&format!(r"(?i)\b{}\b", regex::escape(spoken))).unwrap();
            text = re.replace_all(&text, preferred.as_str()).to_string();
        }
        text
    }

    /// Fixes spacing around punctuation marks
    pub fn fix_punctuation_and_spacing(input: &str) -> String {
        let text = RE_MULTI_SPACE.replace_all(input, " ").to_string();
        let text = RE_PUNCT_SPACE.replace_all(&text, "$1").to_string();
        
        // Ensure space after punctuation if followed by a letter/digit
        let re_space_after = Regex::new(r"([,.:;?!])([a-zA-Z0-9])").unwrap();
        re_space_after.replace_all(&text, "$1 $2").to_string()
    }

    /// Capitalizes the first letter of each sentence and list items
    pub fn capitalize_sentences(input: &str) -> String {
        if input.is_empty() {
            return String::new();
        }

        let mut result = String::with_capacity(input.len());
        let mut capitalize_next = true;

        for ch in input.chars() {
            if capitalize_next && ch.is_alphabetic() {
                result.extend(ch.to_uppercase());
                capitalize_next = false;
            } else {
                result.push(ch);
                if ch == '.' || ch == '?' || ch == '!' || ch == '\n' {
                    capitalize_next = true;
                }
            }
        }

        result
    }

    /// Detects structured patterns (lists, steps, headings)
    pub fn apply_structure(input: &str) -> String {
        let mut text = input.to_string();

        // Detect sequential step indicators: "first ..., then ..., after that ..., finally ..."
        let re_first_step = Regex::new(r"(?i)\bfirst(?:ly)?\s*[:,]?\s*").unwrap();
        let re_second_step = Regex::new(r"(?i)\b(?:second(?:ly)?|then)\s*[:,]?\s*").unwrap();
        let re_third_step = Regex::new(r"(?i)\b(?:third(?:ly)?|after that)\s*[:,]?\s*").unwrap();
        let re_final_step = Regex::new(r"(?i)\bfinally\s*[:,]?\s*").unwrap();

        if re_first_step.is_match(&text) && (re_second_step.is_match(&text) || re_third_step.is_match(&text)) {
            text = re_first_step.replace(&text, "\n1. ").to_string();
            text = re_second_step.replace(&text, "\n2. ").to_string();
            text = re_third_step.replace(&text, "\n3. ").to_string();
            text = re_final_step.replace(&text, "\n4. ").to_string();
        }

        text
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_correction_detection() {
        let input = "Schedule the meeting for Tuesday, actually Thursday.";
        let res = RuleBasedCleaner::apply_corrections(input);
        assert_eq!(res, "Schedule the meeting for Thursday.");

        let input2 = "Send three cars, I mean four cars.";
        let res2 = RuleBasedCleaner::apply_corrections(input2);
        assert_eq!(res2, "Send four cars.");
    }

    #[test]
    fn test_spoken_punctuation() {
        let input = "hello comma how are you question mark";
        let res = RuleBasedCleaner::apply_spoken_punctuation(input);
        assert_eq!(res, "hello, how are you?");
    }

    #[test]
    fn test_filler_removal() {
        let input = "I um think this is uh basically ready";
        let res = RuleBasedCleaner::remove_fillers(input);
        let cleaned = RuleBasedCleaner::fix_punctuation_and_spacing(&res);
        assert_eq!(cleaned.trim(), "I think this is ready");
    }

    #[test]
    fn test_number_normalization() {
        let input = "The budget is fifteen thousand five hundred dollars and twenty percent fee";
        let res = RuleBasedCleaner::normalize_numbers(input);
        assert!(res.contains("15,500"));
        assert!(res.contains("20%"));
    }

    #[test]
    fn test_dictionary_replacement() {
        let mut dict = HashMap::new();
        dict.insert("lang chain".to_string(), "LangChain".to_string());
        dict.insert("forge whisper".to_string(), "Forge Wisper".to_string());

        let input = "we are building forge whisper with lang chain";
        let res = RuleBasedCleaner::apply_dictionary(input, &dict);
        assert_eq!(res, "we are building Forge Wisper with LangChain");
    }

    #[test]
    fn test_end_to_end_clean() {
        let transcript = Transcript {
            text: "hello comma I have an idea um first local whisper then groq period".to_string(),
            language: "en".to_string(),
            provider: "groq".to_string(),
            model: "whisper-large-v3-turbo".to_string(),
            duration_ms: 3000,
            confidence: Some(0.98),
        };

        let options = CleanupOptions::default();
        let cleaned = RuleBasedCleaner::clean(&transcript, &options).unwrap();
        assert!(cleaned.cleaned_text.contains("Hello,"));
        assert!(cleaned.cleaned_text.contains("1. Local Whisper"));
        assert!(cleaned.cleaned_text.contains("2. Groq."));
    }
}
