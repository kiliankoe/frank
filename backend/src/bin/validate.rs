use clap::Parser;
use frank::song::{indexer::Indexer, Validator};
use rayon::prelude::*;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

#[derive(Parser)]
#[command(name = "frank-validate")]
#[command(about = "Validate UltraStar song files for Frank karaoke")]
#[command(version)]
struct Args {
    /// Path to songs directory to validate
    #[arg(short, long)]
    path: PathBuf,

    /// Show warnings in addition to errors
    #[arg(short, long)]
    warnings: bool,

    /// Show verbose output (all files, including valid ones)
    #[arg(short, long)]
    verbose: bool,

    /// Output format
    #[arg(short, long, default_value = "text")]
    format: OutputFormat,

    /// Only validate specific file types (comma-separated: encoding,metadata,notes,files)
    #[arg(long)]
    check: Option<String>,
}

#[derive(Clone, Copy, Default)]
enum OutputFormat {
    #[default]
    Text,
    Json,
}

impl std::str::FromStr for OutputFormat {
    type Err = String;
    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s.to_lowercase().as_str() {
            "text" => Ok(OutputFormat::Text),
            "json" => Ok(OutputFormat::Json),
            _ => Err(format!("Unknown format: {}", s)),
        }
    }
}

fn main() {
    let args = Args::parse();

    if !args.path.exists() {
        eprintln!("Error: Path does not exist: {:?}", args.path);
        std::process::exit(1);
    }

    // Collect all txt files
    let txt_files = collect_txt_files(&args.path);
    let total_files = txt_files.len();

    if total_files == 0 {
        println!("No .txt files found in {:?}", args.path);
        return;
    }

    println!("Validating {} files...\n", total_files);

    let error_count = AtomicUsize::new(0);
    let warning_count = AtomicUsize::new(0);
    let valid_count = AtomicUsize::new(0);

    // Validate in parallel
    let results: Vec<_> = txt_files
        .par_iter()
        .map(|path| {
            let result = Validator::validate(path);

            if result.is_valid() {
                valid_count.fetch_add(1, Ordering::Relaxed);
            } else {
                error_count.fetch_add(1, Ordering::Relaxed);
            }

            if !result.warnings.is_empty() {
                warning_count.fetch_add(result.warnings.len(), Ordering::Relaxed);
            }

            result
        })
        .collect();

    // Output results
    match args.format {
        OutputFormat::Text => {
            output_text(&results, &args);
        }
        OutputFormat::Json => {
            output_json(&results, &args);
        }
    }

    // Summary
    println!("\n{}", "=".repeat(60));
    println!("Summary:");
    println!("  Total files:  {}", total_files);
    println!(
        "  Valid:        {} ({:.1}%)",
        valid_count.load(Ordering::Relaxed),
        (valid_count.load(Ordering::Relaxed) as f64 / total_files as f64) * 100.0
    );
    println!(
        "  With errors:  {} ({:.1}%)",
        error_count.load(Ordering::Relaxed),
        (error_count.load(Ordering::Relaxed) as f64 / total_files as f64) * 100.0
    );
    if args.warnings {
        println!(
            "  Total warnings: {}",
            warning_count.load(Ordering::Relaxed)
        );
    }

    // Exit with error code if any files have errors
    if error_count.load(Ordering::Relaxed) > 0 {
        std::process::exit(1);
    }
}

fn collect_txt_files(path: &Path) -> Vec<PathBuf> {
    let mut files = Vec::new();
    collect_txt_files_recursive(path, &mut files);
    files
}

fn collect_txt_files_recursive(path: &Path, files: &mut Vec<PathBuf>) {
    if let Ok(entries) = std::fs::read_dir(path) {
        for entry in entries.flatten() {
            let file_path = entry.path();
            if file_path.is_dir() {
                collect_txt_files_recursive(&file_path, files);
            } else if Indexer::is_ultrastar_file(&file_path) {
                files.push(file_path);
            }
        }
    }
}

fn output_text(
    results: &[frank::song::ValidationResult],
    args: &Args,
) {
    for result in results {
        let has_errors = !result.errors.is_empty();
        let has_warnings = !result.warnings.is_empty();

        if !has_errors && !has_warnings && !args.verbose {
            continue;
        }

        if !has_errors && !args.warnings && !args.verbose {
            continue;
        }

        // Print file path
        if has_errors {
            println!("\x1b[31m✗\x1b[0m {:?}", result.path);
        } else if has_warnings {
            println!("\x1b[33m⚠\x1b[0m {:?}", result.path);
        } else {
            println!("\x1b[32m✓\x1b[0m {:?}", result.path);
        }

        // Print errors
        for error in &result.errors {
            print!("  \x1b[31mERROR:\x1b[0m {}", error.kind);
            if let Some(line) = error.line {
                print!(" (line {})", line);
            }
            if let Some(ctx) = &error.context {
                print!(" - {}", ctx);
            }
            println!();
        }

        // Print warnings if requested
        if args.warnings {
            for warning in &result.warnings {
                print!("  \x1b[33mWARN:\x1b[0m {}", warning.kind);
                if let Some(line) = warning.line {
                    print!(" (line {})", line);
                }
                println!();
            }
        }
    }
}

fn output_json(
    results: &[frank::song::ValidationResult],
    args: &Args,
) {
    use serde_json::json;

    let json_results: Vec<_> = results
        .iter()
        .filter(|r| {
            !r.errors.is_empty() || (args.warnings && !r.warnings.is_empty()) || args.verbose
        })
        .map(|r| {
            json!({
                "path": r.path.to_string_lossy(),
                "valid": r.is_valid(),
                "errors": r.errors.iter().map(|e| {
                    json!({
                        "kind": format!("{:?}", e.kind),
                        "message": e.kind.to_string(),
                        "line": e.line,
                        "context": e.context,
                    })
                }).collect::<Vec<_>>(),
                "warnings": if args.warnings {
                    r.warnings.iter().map(|w| {
                        json!({
                            "kind": format!("{:?}", w.kind),
                            "message": w.kind.to_string(),
                            "line": w.line,
                            "context": w.context,
                        })
                    }).collect::<Vec<_>>()
                } else {
                    vec![]
                },
            })
        })
        .collect();

    println!("{}", serde_json::to_string_pretty(&json_results).unwrap());
}
