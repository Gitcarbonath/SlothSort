# SlothSort

**A local-first file organizer designed to make folder cleanup safer and less tedious.**

SlothSort is a work-in-progress project built with Python, FastAPI, a lightweight browser interface, and a locally running Ollama model (Qwen).

> **Status:** In development. Features and setup instructions may change as the project is tested.

## What it does

- Scan a selected folder, including subfolders.
- Group files into categories based on their extensions.
- Optionally request naming or categorization suggestions from a local Qwen model for supported files.
- Detect byte-identical files using SHA-256 hashes.
- Copy organized files into a separate output folder rather than moving or deleting originals.
- Preserve relative folder structure where appropriate and avoid overwriting existing files.
- Support undoing the app's copy operations where possible.

AI analysis may be skipped for file types where it is unlikely to be useful. Exact behavior depends on the current version.

## Why SlothSort?

File cleanup can be repetitive, and uploading personal files to an online service may not be appropriate. SlothSort is designed to process files locally and use Ollama for local AI suggestions.

## Tech stack

- **Backend:** Python, FastAPI
- **Frontend:** HTML, CSS, JavaScript
- **Local AI:** Ollama with Qwen
- **Duplicate detection:** SHA-256

## Requirements

- A supported Python version
- [Ollama](https://ollama.com/) installed and running
- A Qwen model downloaded in Ollama

The exact model tag and installation commands will be documented after the initial source release is finalized.

## Development status

This repository is being prepared for the first public source-code release. Until the application files are published, it may contain documentation and repository templates only.

## Roadmap

- [ ] Publish the initial application source
- [ ] Document installation and first-run setup
- [ ] Add automated tests for scanning, categorization, and duplicate detection
- [ ] Add visible analysis progress in the interface
- [ ] Improve error handling for unavailable Ollama models
- [ ] Document platform-specific behavior and known limitations

## Contributing

Bug reports, feature suggestions, documentation improvements, and code contributions are welcome. See [CONTRIBUTING.md](CONTRIBUTING.md).

## Security and privacy

SlothSort is intended to process files locally. Review the code and configuration before using it on important data. Keep backups and test on a sample directory first. See [SECURITY.md](SECURITY.md) for reporting guidance.

## License

A license has not been selected yet. Until one is added, do not assume the repository grants permission to reuse, modify, or redistribute its contents.
