from pathlib import Path
import shutil
import xml.etree.ElementTree as ET

from todoforai_edge.handlers.docx_handler import extract_docx_content, save_docx_content, is_valid_xml

def _xml_only(s: str) -> str:
    lines = s.split("\n")
    for i, line in enumerate(lines):
        if line.strip().startswith("<?xml"):
            return "\n".join(lines[i:])
    return s

def test_extract_docx_xml_is_valid():
    docx = Path(__file__).parent / "input.docx"
    xml_with_header = extract_docx_content(str(docx))
    xml = _xml_only(xml_with_header)
    assert is_valid_xml(xml)

def test_docx_roundtrip_and_content(tmp_path):
    src = Path(__file__).parent / "input.docx"
    work = tmp_path / "working.docx"
    shutil.copyfile(src, work)

    xml1 = _xml_only(extract_docx_content(str(work)))
    assert is_valid_xml(xml1)

    save_docx_content(str(work), xml1)

    xml2 = _xml_only(extract_docx_content(str(work)))
    assert is_valid_xml(xml2)

    # ensure expected body text is present after round-trip
    root = ET.fromstring(xml2)
    text_content = "".join(root.itertext())
    assert "Hello world" in text_content
    assert "This is the second line." in text_content
    assert "This is only shift entered line." in text_content