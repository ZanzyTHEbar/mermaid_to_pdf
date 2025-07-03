# Mermaid to PDF Converter

A simple Node.js utility to convert Markdown files with Mermaid diagrams into PDF documents. Useful for automating documentation workflows, generating technical diagrams, and integrating diagram rendering into CI/CD pipelines.

## Features

- Converts Markdown Mermaid diagrams to PDF format
- CLI-based usage for easy automation
- Supports batch processing of diagrams

## Installation

1. Clone the repository:
   
```sh
   git clone <repo-url>
   cd mermaid_to_pdf
```

2. Install dependencies using pnpm:

```sh
pnpm install
```

## Usage

Run the conversion script with Node.js:

```sh
pnpm convert <input-file> [output-file] [--clean]
```

- `<input-file>`: Path to the Mermaid or Markdown file (e.g., `diagram.mmd` or `docs/diagrams.md`)
- `[output-file]` (optional): Path for the generated PDF (e.g., `diagram.pdf`).
- `--clean` (optional): Remove any previously generated PDFs in the output directory before running the conversion.

### Auto-Naming Output PDF

If you omit the `[output-file]` argument, the script will automatically name the output PDF based on the name of the input file or, if a folder is provided, the name of the input markdown folder. For example, converting all diagrams in `docs/diagrams/` will produce `diagrams.pdf` in the same directory.

### Examples

Convert a single Mermaid file to a PDF:

```sh
pnpm convert docs/example.mmd docs/example.pdf
```

Convert a Markdown folder to a PDF with auto-naming:

```sh
pnpm convert docs/diagrams/
# Output: docs/diagrams.pdf
```

Convert and clean previous outputs:

```sh
pnpm convert docs/diagrams/ --clean
```

## Dependencies

- Node.js (v16+ recommended)
- [pnpm](https://pnpm.io/) (for dependency management)
- Uses libraries `puppeteer`, `cheerio`, `mermaid-filter` (see `package.json` for details)

## Project Structure

- `convert.js` — Main conversion script
- `package.json` — Project metadata and dependencies
- `pnpm-lock.yaml`, `pnpm-workspace.yaml` — Dependency management files

## Contributing

Pull requests and issues are welcome! Please:

- Follow standard Node.js coding conventions
- Add documentation for new features
- Include example diagrams if relevant

## Acknowledgments

- [Mermaid](https://mermaid-js.github.io/)
- [pnpm](https://pnpm.io/)