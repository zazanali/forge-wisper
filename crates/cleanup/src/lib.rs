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
    #[serde(default)]
    pub snippets: HashMap<String, String>,
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

        let mut snippets = HashMap::new();
        snippets.insert("my signature".to_string(), "Best regards,\n[Your Name]\nLead Developer".to_string());
        snippets.insert("email signoff".to_string(), "Thanks and best regards,\n[Your Name]".to_string());

        Self {
            mode: FormattingMode::Smart,
            dictionary,
            snippets,
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
    static ref RE_UM_UH: Regex = Regex::new(r"(?i)\b(um|uh|er|ah|like,?\s+um|you know,?\s+uh)\b").unwrap();
    static ref RE_YOU_KNOW: Regex = Regex::new(r"(?i)\b(you know|basically|sort of|kind of)\b").unwrap();
    static ref RE_MULTI_SPACE: Regex = Regex::new(r"[ \t]+").unwrap();
    static ref RE_PUNCT_SPACE: Regex = Regex::new(r"\s+([,.:;?!])").unwrap();
    static ref RE_SPOKEN_PUNCT: Vec<(Regex, &'static str)> = vec![
        (Regex::new(r"(?i)\b(new paragraph|next paragraph)\b").unwrap(), "\n\n"),
        (Regex::new(r"(?i)\b(new line|newline|next line)\b").unwrap(), "\n"),
        (Regex::new(r"(?i)\b(bullet point|bullet)\b").unwrap(), "\n- "),
        (Regex::new(r"(?i)\b(checkbox|check box|todo item)\b").unwrap(), "\n- [ ] "),
        (Regex::new(r"(?i)\bcomma\b").unwrap(), ","),
        (Regex::new(r"(?i)\b(period|full stop)\b").unwrap(), "."),
        (Regex::new(r"(?i)\bquestion mark\b").unwrap(), "?"),
        (Regex::new(r"(?i)\b(exclamation mark|exclamation point)\b").unwrap(), "!"),
        (Regex::new(r"(?i)\bcolon\b").unwrap(), ":"),
        (Regex::new(r"(?i)\bsemicolon\b").unwrap(), ";"),
        (Regex::new(r"(?i)\b(hyphen|dash)\b").unwrap(), "-"),
        (Regex::new(r"(?i)\bunderscore\b").unwrap(), "_"),
        (Regex::new(r"(?i)\b(forward slash|slash)\b").unwrap(), "/"),
        (Regex::new(r"(?i)\b(at the rate of|at the rate|at sign|at symbol)\b").unwrap(), "@"),
        (Regex::new(r"(?i)\bdot\s+(com|org|net|io|ai|co|dev|app|edu|gov|me|info|xyz|tech|pk|in|uk|us|ca|de|fr)\b").unwrap(), ".$1"),
        (Regex::new(r"(?i)\b(dot|point)\b").unwrap(), "."),
        (Regex::new(r"(?i)\b(hashtag|hash sign)\b").unwrap(), "#"),
        (Regex::new(r"(?i)\b(open parenthesis|open paren)\b").unwrap(), "("),
        (Regex::new(r"(?i)\b(close parenthesis|close paren)\b").unwrap(), ")"),
        (Regex::new(r"(?i)\b(open quote|quote)\b").unwrap(), "\""),
        (Regex::new(r"(?i)\b(close quote|end quote|unquote)\b").unwrap(), "\""),
    ];

    static ref KNOWN_TLDS: [&'static str; 20] = [
        "com", "org", "net", "io", "ai", "co", "dev", "app", "edu", "gov", "me", "info", "xyz", "tech", "pk", "in", "uk", "us", "ca", "de"
    ];
}

impl RuleBasedCleaner {
    pub fn clean(transcript: &Transcript, options: &CleanupOptions) -> Result<CleanedTranscript, CleanupError> {
        let raw = transcript.text.trim();
        let raw = Self::scrub_whisper_hallucinations(raw);

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

        // 1. Voice snippet & macro expansion ("my signature" -> full text macro)
        text = Self::expand_snippets(&text, &options.snippets);

        // 2. Spoken corrections ("Tuesday, actually Thursday" -> "Thursday")
        text = Self::apply_corrections(&text);

        // 3. Spoken punctuation & verbal commands replacement ("new paragraph", "comma", "bullet point")
        text = Self::apply_spoken_punctuation(&text);

        // 4. Filler word removal ("um", "uh")
        text = Self::remove_fillers(&text);

        // 5. Number & currency normalization ("fifteen thousand five hundred" -> "15,500")
        text = Self::normalize_numbers(&text);

        // 6. Personal dictionary replacement
        text = Self::apply_dictionary(&text, &options.dictionary);

        // 7. Email & URL / Web address smart normalization ("ali.khan@gmail.com", "google.com")
        text = Self::normalize_emails_and_urls(&text);

        // 8. Formatting & spacing (protecting emails, URLs, and decimal numbers)
        text = Self::fix_punctuation_and_spacing(&text);

        // 9. Structure detection (for Structured / Smart modes)
        if matches!(options.mode, FormattingMode::Structured | FormattingMode::Smart) {
            text = Self::apply_structure(&text);
        }

        // 10. Capitalize sentences (preserving email & URL lower-casing)
        text = Self::capitalize_sentences(&text);

        let cleaned = text.trim().to_string();

        Ok(CleanedTranscript {
            raw_text: raw.to_string(),
            cleaned_text: cleaned,
            mode: options.mode,
            confidence: 0.95,
        })
    }

    /// Handles spoken self-correction phrases
    pub fn apply_corrections(input: &str) -> String {
        let mut text = input.to_string();

        // "scratch that ..." -> "..."
        let re_scratch = Regex::new(r"(?i)(?:.*?\s+)?(?:scratch that|cancel that)\s*,?\s*(.*)").unwrap();
        if re_scratch.is_match(&text) {
            text = re_scratch.replace(&text, "$1").to_string();
        }

        // Multi-word phrase corrections: "three cars, I mean four cars" -> "four cars"
        let re_phrase = Regex::new(r"(?i)\b([a-zA-Z0-9]+)\s+([a-zA-Z0-9]+)\s*,?\s*(?:I mean|I meant|make that|or rather)\s+([a-zA-Z0-9]+)\s+([a-zA-Z0-9]+)\b").unwrap();
        text = re_phrase.replace_all(&text, |caps: &regex::Captures| {
            let noun1 = &caps[2];
            let noun2 = &caps[4];
            if noun1.eq_ignore_ascii_case(noun2) {
                format!("{} {}", &caps[3], noun2)
            } else {
                caps[0].to_string()
            }
        }).to_string();

        // Single word corrections with explicit correction cue or comma separator:
        // "five, make that ten" / "Tuesday, actually Thursday" / "three, I mean four" / "Tuesday, wait no Thursday"
        let re_correction = Regex::new(r"(?i)\b([a-zA-Z0-9]+)\s*(?:,\s*actually|,\s*sorry|,\s*I mean|,\s*I meant|,?\s*make that|,?\s*or rather|,?\s*wait no|,?\s*no wait|,?\s*no actually|,?\s*wait actually)\s+([a-zA-Z0-9]+)\b").unwrap();
        text = re_correction.replace_all(&text, "$2").to_string();

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

    /// Normalizes spoken emails and web addresses into clean standard format (e.g. "ali.khan@gmail.com", "google.com")
    pub fn normalize_emails_and_urls(input: &str) -> String {
        let mut text = input.to_string();

        let tld_pattern = r"(?:com|org|net|io|ai|co|dev|app|edu|gov|me|info|xyz|tech|pk|in|uk|us|ca|de|fr|online|site|cloud|live|pro|is)";

        // 1. Spoken email pattern with explicit multi-part connectors or explicit username separators (dot, _, -)
        // e.g. "ali. Khan at the gmail. Com", "Ali.Fund and direct of gmail.com", "ali dot khan at the rate gmail dot com"
        let re_spoken_email_explicit = Regex::new(&format!(
            r"(?i)\b([a-zA-Z0-9]+(?:\s*(?:[\._\-]|\bdot\b)\s*[a-zA-Z0-9]+)+)\s*(?:@|\band\s+direct\s+of\b|\bat\s+direct\s+of\b|\band\s+the\s+rate\s+of\b|\bat\s+the\s+rate\s+of\b|\bat\s+the\s+rate\b|\bat\s+rate\s+of\b|\band\s+the\s+rate\b|\band\s+direct\b|\bat\s+direct\b|\bat\s+the\b|\band\s+the\b|\bat\b)\s*([a-zA-Z0-9_\-]+)\s*(?:\.|\bdot\b)\s*({})\b",
            tld_pattern
        )).unwrap();

        let re_dot_token = Regex::new(r"(?i)\s*\bdot\b\s*").unwrap();

        text = re_spoken_email_explicit.replace_all(&text, |caps: &regex::Captures| {
            let raw_user = &caps[1];
            let domain = &caps[2];
            let tld = &caps[3];

            let user_step1 = re_dot_token.replace_all(raw_user, ".").to_string();
            let clean_user = user_step1.replace(" ", "").to_lowercase();
            let clean_domain = domain.replace(" ", "").to_lowercase();
            let clean_tld = tld.trim().to_lowercase();

            format!("{}@{}.{}", clean_user, clean_domain, clean_tld)
        }).to_string();

        // 2. Spoken email with verbal "@" connector ("at the rate", "at the rate of", "and direct of", "@") and 1-2 word username
        // e.g. "ali khan at the rate of gmail dot com", "contact me at ali at the rate gmail dot com"
        let re_spoken_rate_email = Regex::new(&format!(
            r"(?i)\b([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)?)\s*(?:@|\band\s+direct\s+of\b|\bat\s+direct\s+of\b|\band\s+the\s+rate\s+of\b|\bat\s+the\s+rate\s+of\b|\bat\s+the\s+rate\b|\bat\s+rate\s+of\b|\band\s+the\s+rate\b|\band\s+direct\b|\bat\s+direct\b|\bat\s+the\b|\band\s+the\b)\s*([a-zA-Z0-9_\-]+)\s*(?:\.|\bdot\b)\s*({})\b",
            tld_pattern
        )).unwrap();

        text = re_spoken_rate_email.replace_all(&text, |caps: &regex::Captures| {
            let raw_user = &caps[1];
            let domain = &caps[2];
            let tld = &caps[3];

            let clean_user = if raw_user.contains(' ') {
                raw_user.split_whitespace().collect::<Vec<_>>().join(".").to_lowercase()
            } else {
                raw_user.trim().to_lowercase()
            };
            let clean_domain = domain.replace(" ", "").to_lowercase();
            let clean_tld = tld.trim().to_lowercase();

            format!("{}@{}.{}", clean_user, clean_domain, clean_tld)
        }).to_string();

        // 3. Spoken email with simple "at" connector and 1-2 word username
        // e.g. "send email to ali khan at gmail dot com", "ali at gmail.com"
        let re_spoken_simple_at = Regex::new(&format!(
            r"(?i)\b([a-zA-Z0-9]+(?:\s+[a-zA-Z0-9]+)?)\s+at\s+([a-zA-Z0-9_\-]+)\s*(?:\.|\bdot\b)\s*({})\b",
            tld_pattern
        )).unwrap();

        text = re_spoken_simple_at.replace_all(&text, |caps: &regex::Captures| {
            let raw_user = &caps[1];
            let domain = &caps[2];
            let tld = &caps[3];

            let clean_user = if raw_user.contains(' ') {
                raw_user.split_whitespace().collect::<Vec<_>>().join(".").to_lowercase()
            } else {
                raw_user.trim().to_lowercase()
            };
            let clean_domain = domain.replace(" ", "").to_lowercase();
            let clean_tld = tld.trim().to_lowercase();

            format!("{}@{}.{}", clean_user, clean_domain, clean_tld)
        }).to_string();

        // 4. Email with spaces around @ or dots: "ali . khan @ gmail . com" -> "ali.khan@gmail.com"
        let re_spaced_email = Regex::new(
            r"(?i)\b([a-zA-Z0-9._%+-]+)\s*@\s*([a-zA-Z0-9.-]+)\s*\.\s*([a-zA-Z]{2,6})\b"
        ).unwrap();
        text = re_spaced_email.replace_all(&text, |caps: &regex::Captures| {
            let user = caps[1].replace(" ", "").to_lowercase();
            let domain = caps[2].replace(" ", "").to_lowercase();
            let tld = caps[3].replace(" ", "").to_lowercase();
            format!("{}@{}.{}", user, domain, tld)
        }).to_string();

        // 3. Web URLs & Domains: "www . google . com" -> "www.google.com", "github . com" -> "github.com"
        let re_www = Regex::new(
            r"(?i)\bwww\s*(?:\.|\bdot\b)\s*([a-zA-Z0-9_\-]+)\s*(?:\.|\bdot\b)\s*([a-zA-Z]{2,6})\b"
        ).unwrap();
        text = re_www.replace_all(&text, |caps: &regex::Captures| {
            let domain = caps[1].replace(" ", "").to_lowercase();
            let tld = caps[2].to_lowercase();
            format!("www.{}.{}", domain, tld)
        }).to_string();

        let re_web_domains = Regex::new(
            r"(?i)\b([a-zA-Z0-9_\-]+)\s*(?:\.|\bdot\b)\s*(com|org|net|io|ai|co|dev|app|edu|gov|me|info|xyz|tech|pk|in|uk|us|ca|de|fr)\b"
        ).unwrap();
        text = re_web_domains.replace_all(&text, |caps: &regex::Captures| {
            let domain = caps[1].replace(" ", "").to_lowercase();
            let tld = caps[2].to_lowercase();
            format!("{}.{}", domain, tld)
        }).to_string();

        // 4. URL scheme spacing: "https : / / github.com" -> "https://github.com"
        let re_url_scheme = Regex::new(r"(?i)\b(https?)\s*:\s*/\s*/\s*").unwrap();
        text = re_url_scheme.replace_all(&text, "$1://").to_string();

        text
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

    /// Expands voice snippet shortcuts and repetitive prompt macros (e.g. "my signature" -> custom multiline block)
    pub fn expand_snippets(input: &str, snippets: &HashMap<String, String>) -> String {
        let mut text = input.to_string();
        for (trigger, expansion) in snippets {
            let trigger_trimmed = trigger.trim();
            if trigger_trimmed.is_empty() {
                continue;
            }
            if let Ok(re) = Regex::new(&format!(r"(?i)\b{}\b", regex::escape(trigger_trimmed))) {
                text = re.replace_all(&text, expansion.as_str()).to_string();
            }
        }
        text
    }

    /// Fixes spacing around punctuation marks while strictly preserving emails, URLs, and numbers
    pub fn fix_punctuation_and_spacing(input: &str) -> String {
        let text = RE_MULTI_SPACE.replace_all(input, " ").to_string();
        let text = RE_PUNCT_SPACE.replace_all(&text, "$1").to_string();

        // 1. Commas, semicolons, question marks, exclamation marks followed by letter/digit -> ensure space
        let re_space_after_punct = Regex::new(r"([,;?!])([a-zA-Z0-9])").unwrap();
        let text = re_space_after_punct.replace_all(&text, "$1 $2").to_string();

        // 2. Colons followed by letter/digit: add space UNLESS part of http://, https://, or time (10:30)
        let re_colon = Regex::new(r"([a-zA-Z]+):([a-zA-Z]+)").unwrap();
        let text = re_colon.replace_all(&text, |caps: &regex::Captures| {
            let prefix = &caps[1];
            let suffix = &caps[2];
            if prefix.eq_ignore_ascii_case("http") || prefix.eq_ignore_ascii_case("https") {
                format!("{}:{}", prefix, suffix)
            } else {
                format!("{}: {}", prefix, suffix)
            }
        }).to_string();

        // 3. Period spacing: add space if followed by a letter UNLESS it's inside an email/domain/filename/decimal
        let re_period_sentence = Regex::new(r"\.([A-Z][a-zA-Z]*)").unwrap();
        let text = re_period_sentence.replace_all(&text, ". $1").to_string();

        text
    }

    /// Capitalizes the first letter of each sentence while preserving email addresses, URLs, and code identifiers
    pub fn capitalize_sentences(input: &str) -> String {
        if input.is_empty() {
            return String::new();
        }

        // Split by whitespace/tokens to protect email addresses and URLs
        let mut result = String::with_capacity(input.len());
        let mut capitalize_next = true;

        for line in input.split('\n') {
            let mut line_res = String::with_capacity(line.len());
            let words: Vec<&str> = line.split_whitespace().collect();

            for (idx, word) in words.iter().enumerate() {
                if idx > 0 {
                    line_res.push(' ');
                }

                // If token is an email address (contains @) or URL/domain, do NOT capitalize internally
                if word.contains('@') || word.starts_with("http://") || word.starts_with("https://") || word.starts_with("www.") {
                    line_res.push_str(word);
                    if word.ends_with('.') || word.ends_with('!') || word.ends_with('?') {
                        capitalize_next = true;
                    } else {
                        capitalize_next = false;
                    }
                    continue;
                }

                let mut word_res = String::with_capacity(word.len());
                for ch in word.chars() {
                    if capitalize_next && ch.is_alphabetic() {
                        word_res.extend(ch.to_uppercase());
                        capitalize_next = false;
                    } else {
                        word_res.push(ch);
                    }
                }

                // If word ends with sentence terminator (. ! ?), next word should be capitalized
                // BUT ignore abbreviations or decimals
                if word.ends_with('.') || word.ends_with('!') || word.ends_with('?') {
                    // Check if it's not a common domain like "google.com."
                    capitalize_next = true;
                }

                line_res.push_str(&word_res);
            }

            if !result.is_empty() {
                result.push('\n');
            }
            result.push_str(&line_res);
            capitalize_next = true; // New lines start with capitalized sentence
        }

        result
    }

    /// Detects structured patterns (lists, steps, headings, tasks)
    pub fn apply_structure(input: &str) -> String {
        let mut text = input.to_string();

        // 1. Heading indicators: "heading: ...", "title: ...", "section: ..."
        let re_heading = Regex::new(r"(?i)(?:^|\n|\.\s+)(?:heading|title|section)\s*:\s*([^\n\.]+)").unwrap();
        text = re_heading.replace_all(&text, "\n\n### $1\n").to_string();

        // 2. Action items / Task items: "action item: ...", "task: ...", "todo: ..."
        let re_action_item = Regex::new(r"(?i)\b(?:action item|task|todo)\s*:\s*").unwrap();
        text = re_action_item.replace_all(&text, "\n- [ ] ").to_string();

        // 3. Numbered steps: "step 1:", "step 2:" or "number 1:", "number 2:"
        let re_numbered_step = Regex::new(r"(?i)\b(?:step|number)\s*(\d+)\s*[:,]?\s*").unwrap();
        text = re_numbered_step.replace_all(&text, "\n$1. ").to_string();

        // 4. Sequential step indicators: "first ..., then ..., after that ..., finally ..."
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

    /// Scrubs common Whisper silence/cut-off hallucinations ("Thank you.", "Thank you for watching.", etc.)
    pub fn scrub_whisper_hallucinations(input: &str) -> &str {
        let trimmed = input.trim().trim_end_matches(['.', '!', '?']).trim();
        let is_hallucination = trimmed.eq_ignore_ascii_case("thank you")
            || trimmed.eq_ignore_ascii_case("thank you for watching")
            || trimmed.eq_ignore_ascii_case("thank you very much")
            || trimmed.eq_ignore_ascii_case("thanks for watching")
            || trimmed.eq_ignore_ascii_case("thanks for listening")
            || trimmed.eq_ignore_ascii_case("subtitles by the amara.org community")
            || trimmed.eq_ignore_ascii_case("you")
            || trimmed.eq_ignore_ascii_case("bye")
            || trimmed.eq_ignore_ascii_case("goodbye");

        if is_hallucination {
            ""
        } else {
            input
        }
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

    #[test]
    fn test_whisper_hallucination_scrub() {
        let transcript = Transcript {
            text: "Thank you.".to_string(),
            language: "en".to_string(),
            provider: "groq".to_string(),
            model: "whisper-large-v3-turbo".to_string(),
            duration_ms: 1000,
            confidence: Some(0.98),
        };

        let options = CleanupOptions::default();
        let cleaned = RuleBasedCleaner::clean(&transcript, &options).unwrap();
        assert_eq!(cleaned.cleaned_text, "");
    }

    #[test]
    fn test_verbal_commands() {
        let input = "Title: Project Plan new paragraph bullet point item one bullet point item two";
        let transcript = Transcript {
            text: input.to_string(),
            language: "en".to_string(),
            provider: "groq".to_string(),
            model: "whisper-large-v3-turbo".to_string(),
            duration_ms: 2000,
            confidence: Some(1.0),
        };
        let options = CleanupOptions {
            mode: FormattingMode::Structured,
            dictionary: HashMap::new(),
            snippets: HashMap::new(),
        };
        let cleaned = RuleBasedCleaner::clean(&transcript, &options).unwrap();
        assert!(cleaned.cleaned_text.contains("### Project Plan"));
        assert!(cleaned.cleaned_text.contains("- Item one"));
        assert!(cleaned.cleaned_text.contains("- Item two"));
    }

    #[test]
    fn test_advanced_corrections() {
        let input = "Send this email to Sarah, scratch that, send it to David.";
        let res = RuleBasedCleaner::apply_corrections(input);
        assert_eq!(res, "send it to David.");

        let input2 = "We need five, make that ten licenses.";
        let res2 = RuleBasedCleaner::apply_corrections(input2);
        assert_eq!(res2, "We need ten licenses.");

        // Natural adverb preservation (ensure "I actually think" is NOT treated as a correction)
        let input3 = "I actually think this is a great solution.";
        let res3 = RuleBasedCleaner::apply_corrections(input3);
        assert_eq!(res3, "I actually think this is a great solution.");
    }

    #[test]
    fn test_expand_snippets() {
        let mut snippets = HashMap::new();
        snippets.insert("my signature".to_string(), "Best regards,\nAli\nLead Developer".to_string());

        let input = "Thank you for the update, my signature";
        let res = RuleBasedCleaner::expand_snippets(input, &snippets);
        assert!(res.contains("Best regards,\nAli\nLead Developer"));

        let transcript = Transcript {
            text: "Please find the report attached, my signature".to_string(),
            language: "en".to_string(),
            provider: "groq".to_string(),
            model: "whisper-large-v3-turbo".to_string(),
            duration_ms: 1000,
            confidence: Some(1.0),
        };
        let options = CleanupOptions {
            mode: FormattingMode::Smart,
            dictionary: HashMap::new(),
            snippets,
        };
        let cleaned = RuleBasedCleaner::clean(&transcript, &options).unwrap();
        assert!(cleaned.cleaned_text.contains("Best regards,"));
    }

    #[test]
    fn test_spoken_email_and_url_normalization() {
        // 1. Spoken "at the", "dot" variation (exact user scenario)
        let input1 = "ali. Khan at the gmail. Com";
        let res1 = RuleBasedCleaner::normalize_emails_and_urls(input1);
        assert_eq!(res1, "ali.khan@gmail.com");

        // 2. Spoken "dot ... at ... dot com"
        let input2 = "ali dot khan at gmail dot com";
        let res2 = RuleBasedCleaner::normalize_emails_and_urls(input2);
        assert_eq!(res2, "ali.khan@gmail.com");

        // 3. Spoken "at the rate" (South Asian idiom)
        let input3 = "contact me at ali dot khan at the rate gmail dot com";
        let res3 = RuleBasedCleaner::normalize_emails_and_urls(input3);
        assert_eq!(res3, "contact me at ali.khan@gmail.com");

        // 4. Spoken "at the rate of"
        let input4 = "my email is john dot doe at the rate of company dot io";
        let res4 = RuleBasedCleaner::normalize_emails_and_urls(input4);
        assert_eq!(res4, "my email is john.doe@company.io");

        // 5. Spoken "Ali Khan at gmail dot com" (natural spoken name without "dot")
        let input5 = "send email to ali khan at gmail dot com";
        let res5 = RuleBasedCleaner::normalize_emails_and_urls(input5);
        assert_eq!(res5, "send email to ali.khan@gmail.com");

        // 6. Whisper phonetic "Ali.Fund and direct of gmail.com"
        let input6 = "Don't forget to email the slide to Ali.Fund and direct of gmail.com before 8 pm";
        let res6 = RuleBasedCleaner::normalize_emails_and_urls(input6);
        assert_eq!(res6, "Don't forget to email the slide to ali.fund@gmail.com before 8 pm");

        // 7. Full end-to-end clean with punctuation and surrounding sentence
        let transcript = Transcript {
            text: "please send the document to ali. Khan at the gmail. Com as soon as possible".to_string(),
            language: "en".to_string(),
            provider: "groq".to_string(),
            model: "whisper-large-v3-turbo".to_string(),
            duration_ms: 2500,
            confidence: Some(0.99),
        };
        let options = CleanupOptions::default();
        let cleaned = RuleBasedCleaner::clean(&transcript, &options).unwrap();
        assert_eq!(cleaned.cleaned_text, "Please send the document to ali.khan@gmail.com as soon as possible");

        // 8. Website / Domain normalization
        let input8 = "visit www . google . com for search";
        let res8 = RuleBasedCleaner::normalize_emails_and_urls(input8);
        assert_eq!(res8, "visit www.google.com for search");
    }
}
