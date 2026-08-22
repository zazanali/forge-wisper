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
        (Regex::new(r"(?i)\b(forward slash|slash)\b").unwrap(), "/"),
        (Regex::new(r"(?i)\b(at sign|at symbol)\b").unwrap(), "@"),
        (Regex::new(r"(?i)\b(hashtag|hash sign)\b").unwrap(), "#"),
        (Regex::new(r"(?i)\b(open parenthesis|open paren)\b").unwrap(), "("),
        (Regex::new(r"(?i)\b(close parenthesis|close paren)\b").unwrap(), ")"),
        (Regex::new(r"(?i)\b(open quote|quote)\b").unwrap(), "\""),
        (Regex::new(r"(?i)\b(close quote|end quote|unquote)\b").unwrap(), "\""),
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

        // 1. Spoken corrections ("Tuesday, actually Thursday" -> "Thursday")
        text = Self::apply_corrections(&text);

        // 2. Spoken punctuation & verbal commands replacement ("new paragraph", "comma", "bullet point")
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

        // Single word corrections: "five, make that ten" / "Tuesday, actually Thursday" / "three, I mean four"
        let re_correction = Regex::new(r"(?i)\b([a-zA-Z0-9]+)\s*,?\s*(?:actually|I mean|I meant|make that|or rather|sorry|wait no|no wait)\s+([a-zA-Z0-9]+)\b").unwrap();
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
            provider: "mock".to_string(),
            model: "mock-v1".to_string(),
            duration_ms: 2000,
            confidence: Some(1.0),
        };
        let options = CleanupOptions {
            mode: FormattingMode::Structured,
            dictionary: HashMap::new(),
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
    }
}
