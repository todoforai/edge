import os
import tempfile
from pathlib import Path
import pytest
from todoforai_edge.edge_functions import _python_tree, _collect_gitignore_spec


def _make_structure(base: Path, structure: dict):
    """Create files/dirs from a nested dict. Values: None=file, str=file content, dict=subdir."""
    for name, content in structure.items():
        p = base / name
        if content is None:
            p.touch()
        elif isinstance(content, str):
            p.write_text(content)
        else:
            p.mkdir(exist_ok=True)
            _make_structure(p, content)


class TestPythonTree:
    def test_basic_structure(self, tmp_path):
        _make_structure(tmp_path, {
            "src": {"main.py": None, "utils.py": None},
            "README.md": None,
            "setup.py": None,
        })
        result = _python_tree(tmp_path, max_depth=2)
        lines = result.splitlines()
        assert lines[0] == tmp_path.name + "/"
        assert any("src/" in l for l in lines)
        assert any("README.md" in l for l in lines)
        assert any("setup.py" in l for l in lines)

    def test_dirs_first_ordering(self, tmp_path):
        _make_structure(tmp_path, {
            "zebra.txt": None,
            "alpha": {},
            "beta": {},
        })
        result = _python_tree(tmp_path, max_depth=1)
        lines = result.splitlines()[1:]  # skip root
        # Top-level entries: dirs should come before files
        first_file = next((i for i, l in enumerate(lines) if not l.rstrip().endswith("/")), len(lines))
        last_dir = max((i for i, l in enumerate(lines) if l.rstrip().endswith("/")), default=-1)
        assert last_dir < first_file

    def test_depth_limiting(self, tmp_path):
        _make_structure(tmp_path, {
            "a": {"b": {"c": {"deep.txt": None}}},
        })
        result = _python_tree(tmp_path, max_depth=1)
        assert "deep.txt" not in result
        assert "a/" in result

    def test_depth_2(self, tmp_path):
        _make_structure(tmp_path, {
            "a": {"b": {"c": {"deep.txt": None}}, "top.txt": None},
        })
        result = _python_tree(tmp_path, max_depth=2)
        assert "b/" in result
        assert "top.txt" in result
        assert "deep.txt" not in result

    def test_git_always_hidden(self, tmp_path):
        _make_structure(tmp_path, {
            ".git": {"HEAD": None, "config": None},
            "src": {"main.py": None},
        })
        result = _python_tree(tmp_path, max_depth=2)
        assert ".git" not in result
        assert "src/" in result

    def test_gitignore_excludes_patterns(self, tmp_path):
        _make_structure(tmp_path, {
            ".gitignore": "node_modules\n*.pyc\nbuild/\n",
            "node_modules": {"pkg": {"index.js": None}},
            "build": {"output.js": None},
            "src": {"main.py": None, "main.pyc": None},
            "app.py": None,
        })
        result = _python_tree(tmp_path, max_depth=2)
        assert "node_modules" not in result
        assert "build" not in result
        assert "main.pyc" not in result
        assert "app.py" in result
        assert "main.py" in result

    def test_gitignore_negation(self, tmp_path):
        _make_structure(tmp_path, {
            ".gitignore": "*.log\n!important.log\n",
            "debug.log": None,
            "important.log": None,
            "app.py": None,
        })
        result = _python_tree(tmp_path, max_depth=2)
        assert "debug.log" not in result
        assert "important.log" in result
        assert "app.py" in result

    def test_gitignore_doublestar(self, tmp_path):
        _make_structure(tmp_path, {
            ".gitignore": "**/*.log\n",
            "root.log": None,
            "sub": {"nested.log": None, "keep.txt": None},
        })
        result = _python_tree(tmp_path, max_depth=2)
        assert "root.log" not in result
        assert "nested.log" not in result
        assert "keep.txt" in result

    def test_nested_gitignore(self, tmp_path):
        _make_structure(tmp_path, {
            "src": {
                ".gitignore": "*.tmp\n",
                "main.py": None,
                "cache.tmp": None,
            },
            "root.tmp": None,
        })
        result = _python_tree(tmp_path, max_depth=2)
        assert "main.py" in result
        assert "cache.tmp" not in result
        assert "root.tmp" in result  # root .gitignore doesn't have *.tmp

    def test_empty_directory(self, tmp_path):
        result = _python_tree(tmp_path, max_depth=2)
        assert result == tmp_path.name + "/"

    def test_no_gitignore(self, tmp_path):
        _make_structure(tmp_path, {
            "file.txt": None,
            "dir": {"nested.txt": None},
        })
        result = _python_tree(tmp_path, max_depth=2)
        assert "file.txt" in result
        assert "nested.txt" in result


class TestCollectGitignoreSpec:
    def test_no_gitignore(self, tmp_path):
        spec = _collect_gitignore_spec(tmp_path)
        assert spec is None

    def test_root_gitignore(self, tmp_path):
        (tmp_path / ".gitignore").write_text("*.pyc\nnode_modules/\n")
        spec = _collect_gitignore_spec(tmp_path)
        assert spec is not None
        assert spec.match_file("foo.pyc")
        assert spec.match_file("node_modules/")
        assert not spec.match_file("foo.py")

    def test_nested_gitignore(self, tmp_path):
        sub = tmp_path / "sub"
        sub.mkdir()
        (sub / ".gitignore").write_text("*.tmp\n")
        spec = _collect_gitignore_spec(tmp_path)
        assert spec is not None
        assert spec.match_file("sub/foo.tmp")
        assert not spec.match_file("root.tmp")
