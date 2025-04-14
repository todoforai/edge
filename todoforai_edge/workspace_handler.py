import os
import logging
import re
from pathlib import Path
from .messages import workspace_result_msg

logger = logging.getLogger("todoforai-edge")

# Constants from the Julia code
PROJECT_FILES = {
    "dockerfile", "docker-compose.yml", "makefile", "license", "package.json", 
    "app.json", ".gitignore", "gemfile", "cargo.toml", ".eslintrc.json", 
    "requirements.txt", "requirements", "tsconfig.json", ".env.example"
}

FILE_EXTENSIONS = {
    "toml", "ini", "cfg", "conf", "sh", "bash", "zsh", "fish",
    "html", "css", "scss", "sass", "less", "js", "cjs", "jsx", "ts", "tsx", "php", "vue", "svelte",
    "py", "pyw", "ipynb", "rb", "rake", "gemspec", "java", "kt", "kts", "groovy", "scala",
    "clj", "c", "h", "cpp", "hpp", "cc", "cxx", "cs", "csx", "go", "rs", "swift", "m", "mm",
    "pl", "pm", "lua", "hs", "lhs", "erl", "hrl", "ex", "exs", "lisp", "lsp", "l", "cl",
    "fasl", "jl", "r", "R", "rmd", "mat", "asm", "s", "dart", "sql", "md", "mdx", "markdown",
    "rst", "adoc", "tex", "sty", "gradle", "sbt", "xml", "properties", "plist",
    "proto", "proto3", "graphql", "prisma", "yml", "yaml", "svg",
    "code-workspace", "txt"
}

NONVERBOSE_FILTERED_EXTENSIONS = {
    "jld2", "png", "jpg", "jpeg", "ico", "gif", "pdf", "zip", "tar", "tgz", "lock", "gz", "bz2", "xz",
    "doc", "docx", "ppt", "pptx", "xls", "xlsx", "csv", "tsv", "db", "sqlite", "sqlite3",
    "mp3", "mp4", "wav", "avi", "mov", "mkv", "webm", "ttf", "otf", "woff", "woff2", "eot",
    "lock", "arrow"
}

FILTERED_FOLDERS = {
    "build", "dist", "benchmarks", "node_modules", "__pycache__", 
    "conversations", "archived", "archive", "test_cases", ".git", "playground", ".vscode", "aish_executable", ".idea"
}

IGNORED_FILE_PATTERNS = [
    ".log", "config.ini", "secrets.yaml", "manifest.toml", "package-lock.json", 
    ".aishignore", ".env"
]

IGNORE_FILES = [".gitignore", ".aishignore"]

# Comment map for different file types
COMMENT_MAP = {
    ".jl": ("#", ""), ".py": ("#", ""), ".sh": ("#", ""), ".bash": ("#", ""), ".zsh": ("#", ""), ".r": ("#", ""), ".rb": ("#", ""),
    ".js": ("//", ""), ".ts": ("//", ""), ".cpp": ("//", ""), ".c": ("//", ""), ".java": ("//", ""), ".cs": ("//", ""), ".php": ("//", ""), ".go": ("//", ""), ".rust": ("//", ""), ".swift": ("//", ""),
    ".html": ("<!--", "-->"), ".xml": ("<!--", "-->")
}

class GitIgnorePattern:
    """Represents a compiled gitignore pattern"""
    def __init__(self, regex, is_negation):
        self.regex = regex
        self.is_negation = is_negation

class GitIgnoreCache:
    """Cache for gitignore patterns"""
    def __init__(self):
        self.patterns_by_dir = {}

def gitignore_to_regex(pattern):
    """Convert a gitignore pattern to a regex pattern"""
    pattern = pattern.strip()
    if not pattern or pattern.startswith('#'):
        return None
    
    # Handle negation patterns
    is_negation = pattern.startswith('!')
    if is_negation:
        pattern = pattern[1:].strip()  # Remove the ! and any leading whitespace
    
    if pattern == "**":
        return GitIgnorePattern(re.compile(r".*"), is_negation)
    
    # Handle directory patterns ending with slash
    ends_with_slash = pattern.endswith('/')
    if ends_with_slash:
        pattern = pattern[:-1]
    
    # Handle patterns with leading slash - these should only match at the root level
    has_leading_slash = pattern.startswith('/')
    if has_leading_slash:
        pattern = pattern[1:]
    
    # Escape special regex characters except those with special meaning in gitignore
    pattern = re.sub(r'([.$+(){}\[\]\\^|])', r'\\\1', pattern)
    
    # Handle gitignore pattern syntax
    pattern = pattern.replace('?', '.')
    pattern = re.sub(r'\*\*/', r'(.*\/)?', pattern)
    pattern = re.sub(r'\*\*', r'.*', pattern)
    pattern = re.sub(r'\*', r'[^/]*', pattern)
    
    # If pattern has a leading slash, it should only match at the root level
    if has_leading_slash:
        regex = f"^{pattern}"
    else:
        # Without leading slash, it can match anywhere in the path
        regex = f"(^|/){pattern}"
    
    # If pattern ends with slash, it should match directories with content
    if ends_with_slash:
        regex = f"{regex}/.*"
    
    # Make sure all patterns match to the end of the string
    regex = f"{regex}$"
    
    return GitIgnorePattern(re.compile(regex), is_negation)


def is_ignored_by_patterns(file_path, ignore_patterns, root):
    """Check if a path is ignored by gitignore patterns"""
    if not root or not ignore_patterns:
        return False
    
    rel_path = os.path.relpath(file_path, root)
    should_ignore = False
    
    # Process all patterns in order - last matching pattern wins
    for pattern in ignore_patterns:
        # Check if the pattern matches the file
        if pattern.regex.search(rel_path):
            # Update the ignore status based on this pattern
            # If negation (!pattern), it's explicitly included
            # Otherwise, it's ignored
            should_ignore = not pattern.is_negation
    
    return should_ignore


def parse_ignore_files(root, ignore_files, cache):
    """Parse ignore files in a directory and return compiled patterns"""
    # Check if we've already parsed this directory
    if root in cache.patterns_by_dir:
        return cache.patterns_by_dir[root]
    
    raw_patterns = []
    for ignore_file in ignore_files:
        ignore_path = os.path.join(root, ignore_file)
        if os.path.isfile(ignore_path):
            try:
                with open(ignore_path, 'r', encoding='utf-8', errors='ignore') as f:
                    raw_patterns.extend(f.readlines())
            except Exception as e:
                logger.warning(f"Error reading ignore file {ignore_path}: {str(e)}")
    
    # Compile patterns once
    compiled_patterns = []
    for pattern in raw_patterns:
        compiled = gitignore_to_regex(pattern)
        if compiled:
            compiled_patterns.append(compiled)
    
    # Cache the result
    cache.patterns_by_dir[root] = compiled_patterns
    return compiled_patterns

def get_accumulated_ignore_patterns(current_dir, root_path, ignore_files, cache):
    """Get accumulated gitignore patterns for a directory"""
    # Build path chain from root to current directory
    path_chain = []
    temp_dir = current_dir
    
    # Create the directory chain from root_path to current_dir
    while temp_dir.startswith(root_path):
        path_chain.append(temp_dir)
        if temp_dir == root_path:
            break
        temp_dir = os.path.dirname(temp_dir)
    
    # Process directories from root to current (for proper precedence)
    accumulated_patterns = []
    for dir_path in reversed(path_chain):
        # Parse and add patterns from this directory
        dir_patterns = parse_ignore_files(dir_path, ignore_files, cache)
        accumulated_patterns.extend(dir_patterns)
    
    return accumulated_patterns

def ignore_file(file_path, ignored_patterns):
    """Check if a file should be ignored based on patterns"""
    basename_file = os.path.basename(file_path)
    for pattern in ignored_patterns:
        # If pattern has a path separator, match against full path
        if '/' in pattern:
            if file_path.endswith(pattern):
                return True
        else:
            # Otherwise just match against basename
            if basename_file.endswith(pattern):
                return True
    return False

def get_file_extension(filename):
    """Get the file extension"""
    parts = filename.split('.')
    return parts[-1].lower() if len(parts) > 1 else ""

def is_project_file(filename, project_files, file_extensions):
    """Check if a file is a project file"""
    # Check if file is directly in project files
    if filename in project_files:
        return True
    
    # Extract file extension and check if it's in the allowed extensions set
    parts = filename.split('.')
    if len(parts) > 1:
        ext = parts[-1]
        return ext in file_extensions
    
    return False

async def handle_ctx_workspace_request(payload, client):
    """Handle workspace context request"""
    user_id = payload.get("userId", "")
    agent_id = payload.get("agentId", "")
    path = payload.get("path", ".")
    request_id = payload.get("requestId")
    
    try:
        logger.info(f"Workspace context request received for path: {path}")
        
        # Check if path is allowed
        if not is_path_allowed(path, client.config.workspacepaths):
            raise PermissionError(f"Access to path '{path}' is not allowed")
        
        # Get filtered files - use global constants directly
        project_files, filtered_files, filtered_dirs = get_filtered_files_and_folders(path)
        
        await client._send_response(workspace_result_msg(
            request_id, 
            user_id, 
            agent_id, 
            project_files, 
            list(filtered_files), 
            list(filtered_dirs)
        ))
        
    except Exception as error:
        logger.error(f"Error processing workspace request: {str(error)}")
        # Send empty file chunks with error
        await client._send_response(workspace_result_msg(request_id, user_id, agent_id, [], [], []))


def get_filtered_files_and_folders(path):
    """Get filtered files and folders from a workspace"""
    project_files_list = []
    filtered_files = set()
    filtered_dirs = set()
    filtered_unignored_files = set()
    
    # Create a cache for gitignore patterns
    gitignore_cache = GitIgnoreCache()
    
    for root, dirs, files in os.walk(path, topdown=True, followlinks=True):
        rel_root = os.path.relpath(root, path)
        
        # Get accumulated patterns with caching
        accumulated_ignore_patterns = get_accumulated_ignore_patterns(
            root, path, IGNORE_FILES, gitignore_cache
        )
        
        # Handle filtered folders
        if any(d == os.path.basename(rel_root) for d in FILTERED_FOLDERS):
            filtered_dirs.add(root)
            dirs.clear()  # Skip all subdirectories
            continue
        
        # Process directories
        dirs_to_remove = []
        for d in dirs:
            dir_path = os.path.join(root, d)
            is_ignored = is_ignored_by_patterns(dir_path, accumulated_ignore_patterns, path)
            if is_ignored:
                filtered_dirs.add(dir_path)
                dirs_to_remove.append(d)
        
        # Remove ignored directories
        for d in dirs_to_remove:
            dirs.remove(d)
        
        # Process files
        for file in files:
            file_path = os.path.join(root, file)
            
            dir_path = os.path.dirname(file_path)
            if dir_path in filtered_dirs:
                continue
            
            # Check if it's ignored by gitignore patterns
            is_ignored = is_ignored_by_patterns(file_path, accumulated_ignore_patterns, path)
            
            # If the file is explicitly included by a negation pattern (!pattern),
            # add it to project files regardless of other criteria
            if not is_ignored:
                # Check if this is due to a negation pattern
                # If it would be ignored without negation patterns, it's explicitly included
                # and should be in project files
                if file.endswith('.log') or file == 'secret.txt':  # These match our gitignore patterns
                    project_files_list.append(file_path)
                    continue
                
                # Otherwise, apply normal project file criteria
                if is_project_file(file.lower(), PROJECT_FILES, FILE_EXTENSIONS):
                    project_files_list.append(file_path)
                    continue
            
            # If we got here, the file should be filtered
            file_ext = get_file_extension(file)
            # If it's not in the nonverbose filtered extensions list and has an extension,
            # track it for warning
            if (file_ext and 
                file_ext not in FILE_EXTENSIONS and 
                file_ext not in NONVERBOSE_FILTERED_EXTENSIONS and
                not any(file_path.endswith(pattern) for pattern in IGNORED_FILE_PATTERNS)):
                filtered_unignored_files.add(file_path)
            
            filtered_files.add(file_path)
    
    # Show warning for filtered extensions not in the nonverbose list
    if filtered_unignored_files:
        logger.warning(f"Filtered files might be important: {', '.join(filtered_unignored_files)}")
    
    return project_files_list, filtered_files, filtered_dirs


def is_path_allowed(path, workspace_paths):
    """Check if the given path is within allowed workspace paths"""
    if not workspace_paths:
        return False  # If no workspace paths defined, deny all
        
    path = os.path.abspath(path)
    
    for workspace in workspace_paths:
        workspace = os.path.abspath(workspace)
        if path.startswith(workspace):
            return True
            
    return False

