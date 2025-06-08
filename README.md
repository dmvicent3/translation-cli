# Translation CLI Tool

Designed with next-translate in mind but compatible with any translation system that uses JSON files

## Features

- 🤖 AI-powered translations using Google Gemini
- 📝 Batch translation support
- 🔍 Translation key verification and usage scanning
- 🛠️ Easy key management (rename, remove, add)
- 📋 Report generation for unused/missing translations
- ⚡ Interactive CLI with detailed feedback
- 🔒 Safe operations with confirmation prompts
- 📁 Configurable file scanning with include/exclude patterns

## Installation

```bash
# Install globally
npm install -g @dmvicent3/translation-cli
```

## Setup

1. **Get Google Gemini API Key**:
   - Visit [Google AI Studio](https://aistudio.google.com/app/apikey)
   - Create or get your API key

2. **Initialize a project**:
   ```bash
   # Navigate to your project directory
   cd /path/to/your/project
   
   # Initialize translation configuration
   tcli --init
   ```

## Configuration Options

The tool looks for configuration in this order:
1. `.translation-cli.json` (default)
2. `translation-cli.config.json`
3. `translationCli` field in `package.json`

### Example Configuration

```json
{
  "langDir": "lang",
  "sourceLanguage": "en-us",
  "languages": {
    "en-us": "American English",
    "pt-pt": "European Portuguese",
    "es-es": "Spanish (Spain)",
    "fr-fr": "French"
  },
  "verification": {
    "include": ["src", "components", "pages", "app"],
    "exclude": ["node_modules", ".git", "dist", "build", ".next", "coverage", "test"],
    "extensions": [".js", ".jsx", ".ts", ".tsx", ".vue", ".svelte"]
  }
}
```

## Environment Variables

| Variable                       | Description                |
|--------------------------------|----------------------------|
| `GOOGLE_GENERATIVE_AI_API_KEY` | Your Google Gemini API key |

## Command Reference

| Command      | Description                                       |
|--------------|---------------------------------------------------|
| `tcli`       | Add or update single translations                 |
| `tcli-batch` | Add multiple translations from JSON               |
| `tcli-check` | Verify translation completeness                   |
| `tcli-rename`| Rename translation keys across all languages      |
| `tcli-remove`| Remove translation keys from all languages        |
| `tcli-add`   | Add new language to project                       |
| `tcli-scan`  | Scan for unused translation keys in project files |

## Commands

### Translation Management

#### Single Translation
```bash
# Add a simple translation
tcli "welcome" "Welcome to our application"

# Add nested translation
tcli "button.submit" "Submit"

# Force overwrite existing translation without prompting
tcli "button.save" "Save changes" --force

# Skip prompts for existing translations
tcli "button.cancel" "Cancel" --no-prompt
```

#### Batch Translation
```bash
# From JSON file
tcli-batch example-translations.json

# From JSON file with force overwrite
tcli-batch example-translations.json --force

# From stdin
echo '{"navigation":{"home":"Home"}}' | tcli-batch --stdin
```

#### List Existing Translations
```bash
# List all translations from source language
tcli --list

# List translations from specific language
tcli --list en-us
```

### Key Management

#### Rename Translation
```bash
# Rename a key across all languages
tcli-rename "button.submit" "button.send"

# Force rename even if new key exists
tcli-rename "user.name" "user.fullName" --force

# Interactive mode to select and rename keys
tcli-rename --interactive
```

#### Remove Translation
```bash
# Remove a key from all languages
tcli-remove "deprecated.feature"

# Force remove without confirmation
tcli-remove "old.button" --force

# Interactive mode to select and remove keys
tcli-remove --interactive
```

### Language Management

#### Add New Language
```bash
# Add a new language
tcli-add "de-de" "German"

# Interactive mode to add language
tcli-add --interactive
```

### Translation Verification

#### Check Translations
```bash
# Basic verification - check for missing keys across all languages
tcli-check

# Detailed verification - show all missing keys
tcli-check --detailed

# Generate completeness report
tcli-check --report

# Check translations against source language only
tcli-check --incomplete

# Generate JSON template for missing keys in specific language
tcli-check --json pt-br

# Generate JSON report and save to file
tcli-check --report --json-format --output translation-report.json
```

### Usage Analysis

#### Scan for Unused Translations
```bash
# Scan using configuration settings
tcli-scan

# Scan specific directory
tcli-scan --dir src/

# Show detailed information about unused keys
tcli-scan --detailed

# Show which keys are being used
tcli-scan --show-used

# Generate detailed JSON report
tcli-scan --report --json --output usage-report.json
```

### Configuration Management
```bash
# Show current configuration
tcli --config
```

## License

MIT
