import os
import tempfile
import shutil
from pathlib import Path

from todoforai_edge.constants.workspace_handler import (
    gitignore_to_regex,
    is_ignored_by_patterns_in_file,
    GitIgnorePattern
)

def test_gitignore_patterns():
    """Comprehensive test suite for gitignore patterns"""
    
    # Test cases: (pattern, expected_regex, test_path, expected_match, description)
    test_cases = [
        # Basic patterns
        ('*.log', r'(^|/)[^/]*\.log(/.*)?$', 'app.log', True, 'Simple wildcard at root'),
        ('*.log', r'(^|/)[^/]*\.log(/.*)?$', 'src/app.log', True, 'Simple wildcard in subdirectory'),
        ('*.log', r'(^|/)[^/]*\.log(/.*)?$', 'app.txt', False, 'Simple wildcard no match'),
        
        # Leading slash patterns (root only)
        ('/*.log', r'^[^/]*\.log(/.*)?$', 'app.log', True, 'Root-only pattern matches at root'),
        ('/*.log', r'^[^/]*\.log(/.*)?$', 'src/app.log', False, 'Root-only pattern ignores subdirectory'),
        ('/src', r'^src(/.*)?$', 'src/file.txt', True, 'Root directory pattern'),
        ('/src', r'^src(/.*)?$', 'nested/src/file.txt', False, 'Root directory pattern ignores nested'),
        
        # Directory patterns with trailing slash
        ('build/', r'(^|/)build/.*$', 'build/output.txt', True, 'Directory pattern matches contents'),
        ('build/', r'(^|/)build/.*$', 'build/nested/output.txt', True, 'Directory pattern matches nested contents'),
        ('build/', r'(^|/)build/.*$', 'build', False, 'Directory pattern does not match bare directory name'),
        
        # Directory patterns with /*
        ('dumps/*', r'(^|/)dumps/[^/]*(/.*)?$', 'dumps/file.txt', True, 'Directory/* matches direct children'),
        ('dumps/*', r'(^|/)dumps/[^/]*(/.*)?$', 'dumps/sub/file.txt', True, 'Directory/* matches nested children'),
        ('dumps/*', r'(^|/)dumps/[^/]*(/.*)?$', 'dumps', False, 'Directory/* does not match directory itself'),
        
        # Double asterisk patterns - **/ requires at least one directory level
        ('**/*.js', r'(^|/).*/[^/]*\.js(/.*)?$', 'app.js', False, '**/ requires directory, no match at root level'),
        ('**/*.js', r'(^|/).*/[^/]*\.js(/.*)?$', 'src/app.js', True, '**/ matches in subdirectory'),
        ('**/*.js', r'(^|/).*/[^/]*\.js(/.*)?$', 'src/components/app.js', True, '**/ matches in deep subdirectory'),
        ('**/*.js', r'(^|/).*/[^/]*\.js(/.*)?$', 'app.ts', False, '**/ with extension does not match different extension'),
        
        ('src/**', r'(^|/)src/.*(/.*)?$', 'src/file.txt', True, 'src/** matches direct children'),
        ('src/**', r'(^|/)src/.*(/.*)?$', 'src/nested/file.txt', True, 'src/** matches nested children'),
        ('src/**', r'(^|/)src/.*(/.*)?$', 'src', False, 'src/** does not match directory itself'),
        ('src/**', r'(^|/)src/.*(/.*)?$', 'other/src/file.txt', False, 'src/** does not match nested src directories'),
        
        ('**/node_modules', r'(^|/).*/node_modules(/.*)?$', 'node_modules/pkg/index.js', True, '**/dir matches at any level'),
        ('**/node_modules', r'(^|/).*/node_modules(/.*)?$', 'src/node_modules/pkg/index.js', True, '**/dir matches nested'),
        ('**/node_modules', r'(^|/).*/node_modules(/.*)?$', 'src/my_node_modules/file.js', False, '**/dir exact match only'),
        
        # Question mark wildcard
        ('?.log', r'(^|/).\.log(/.*)?$', 'a.log', True, '? matches single character'),
        ('?.log', r'(^|/).\.log(/.*)?$', 'ab.log', False, '? does not match multiple characters'),
        ('test?.txt', r'(^|/)test.\.txt(/.*)?$', 'test1.txt', True, '? in middle of pattern'),
        ('test?.txt', r'(^|/)test.\.txt(/.*)?$', 'test.txt', False, '? requires a character'),
        
        # Edge cases
        ('*', r'(^|/)[^/]*$', 'file.txt', True, 'Single * matches filename only'),
        ('*', r'(^|/)[^/]*$', 'dir/file.txt', False, 'Single * does not cross directory boundaries'),
        ('**', r'.*', 'any/path/file.txt', True, 'Double ** matches everything'),
        
        # Special characters that should be escaped
        ('file.txt', r'(^|/)file\.txt(/.*)?$', 'file.txt', True, 'Literal dot should match'),
        ('file.txt', r'(^|/)file\.txt(/.*)?$', 'filetxt', False, 'Literal dot should not match without dot'),
    ]
    
    print("=== Comprehensive Gitignore Pattern Tests ===\n")
    
    passed = 0
    failed = 0
    
    for pattern, expected_regex, test_path, expected, description in test_cases:
        # Normalize Windows paths for testing
        normalized_path = test_path.replace('\\', '/')
        
        compiled = gitignore_to_regex(pattern)
        if compiled is None:
            matches = False
            actual_regex = "None"
        else:
            matches = bool(compiled.regex.search(normalized_path))
            actual_regex = compiled.regex.pattern
        
        # Check if regex matches expected
        regex_matches = actual_regex == expected_regex
        result_matches = matches == expected
        
        overall_pass = regex_matches and result_matches
        
        status = '✓' if overall_pass else '✗'
        result_text = 'PASS' if overall_pass else 'FAIL'
        
        print(f"{status} {result_text:4} | {pattern:15} vs {normalized_path:25} = {matches:5} | {description}")
        
        if not regex_matches:
            print(f"      Expected regex: {expected_regex}")
            print(f"      Actual regex:   {actual_regex}")
        
        if not result_matches:
            print(f"      Expected match: {expected}, Got: {matches}")
        
        if overall_pass:
            passed += 1
        else:
            failed += 1
    
    print(f"\n=== Results ===")
    print(f"Passed: {passed}")
    print(f"Failed: {failed}")
    print(f"Total:  {passed + failed}")
    
    return failed == 0

def test_gitignore_integration():
    """Test gitignore patterns in a real directory structure"""
    
    # Create temporary directory
    temp_dir = tempfile.mkdtemp()
    
    try:
        # Create test structure
        test_files = [
            'app.log',
            'important.log', 
            'src/debug.log',
            'src/app.js',
            'src/components/Button.js',
            'build/output.txt',
            'build/assets/style.css',
            'node_modules/package/index.js',
            'dumps/data.txt',
            'dumps/backup/old.txt',
            'test.txt',
            'src/test.txt'
        ]
        
        for file_path in test_files:
            full_path = os.path.join(temp_dir, file_path)
            os.makedirs(os.path.dirname(full_path), exist_ok=True)
            with open(full_path, 'w') as f:
                f.write('test content')
        
        # Create gitignore with various patterns
        gitignore_content = """
# Logs
*.log
!important.log

# Build directories  
build/
dumps/*

# Dependencies
node_modules/

# Root-level test files only
/test.txt
"""
        
        with open(os.path.join(temp_dir, '.gitignore'), 'w') as f:
            f.write(gitignore_content)
        
        print("\n=== Integration Test ===")
        print(f"Test directory: {temp_dir}")
        print(f"Gitignore content:\n{gitignore_content}")
        
        # Parse gitignore patterns
        patterns = []
        for line in gitignore_content.strip().split('\n'):
            compiled = gitignore_to_regex(line)
            if compiled:
                patterns.append(compiled)
        
        print("\nFile ignore status:")
        for file_path in sorted(test_files):
            full_path = os.path.join(temp_dir, file_path)
            is_ignored = is_ignored_by_patterns_in_file(full_path, patterns, temp_dir)
            status = "IGNORED" if is_ignored else "INCLUDED"
            print(f"  {status:8} | {file_path}")
        
    finally:
        shutil.rmtree(temp_dir)

def save_test_results_to_file():
    """Save test results to a file for review"""
    import sys
    from io import StringIO
    
    # Capture output
    old_stdout = sys.stdout
    sys.stdout = captured_output = StringIO()
    
    try:
        # Run tests
        test_gitignore_patterns()
        test_gitignore_integration()
    finally:
        sys.stdout = old_stdout
    
    # Save to file
    output = captured_output.getvalue()
    
    with open('test/gitignore_test_results.txt', 'w') as f:
        f.write("Gitignore Pattern Test Results\n")
        f.write("=" * 50 + "\n\n")
        f.write(output)
    
    print("Test results saved to test/gitignore_test_results.txt")
    print("\nSummary:")
    # Print just the summary to console
    lines = output.split('\n')
    for line in lines:
        if 'Results' in line or 'Passed:' in line or 'Failed:' in line or 'Total:' in line:
            print(line)

if __name__ == "__main__":
    # Run tests and save to file
    save_test_results_to_file()
    
    # Also run tests normally for immediate feedback
    print("\n" + "="*60)
    test_gitignore_patterns()
    test_gitignore_integration()