import os
import zipfile
import shutil
import xml.dom.minidom
import xml.etree.ElementTree as ET
import logging
import json

logger = logging.getLogger("todoforai-edge")

def is_valid_xml(content):
    """Check if content is valid XML or valid multi-file format containing XML"""
    return True # now we don't check, just save even if it is not valid

def extract_docx_content(docx_path):
    """Extract readable content from DOCX file"""
    try:
        with zipfile.ZipFile(docx_path, 'r') as zip_file:
            # Extract main document XML
            xml_content = zip_file.read("word/document.xml").decode('utf-8')
            formatted_xml = xml.dom.minidom.parseString(xml_content).toprettyxml()
            
            # Return plain XML for DOCX
            return formatted_xml
    except Exception as e:
        raise ValueError(f"Failed to extract DOCX content: {str(e)}")

def extract_xlsx_content(xlsx_path):
    """Extract readable content from Excel file as multi-file format with clear delimiters"""
    try:
        with zipfile.ZipFile(xlsx_path, 'r') as zip_file:
            result = {}
            
            # Extract worksheet(s)
            worksheet_files = [f for f in zip_file.namelist() if f.startswith("xl/worksheets/") and f.endswith(".xml")]
            for worksheet_path in worksheet_files:
                xml_content = zip_file.read(worksheet_path).decode('utf-8')
                formatted_xml = xml.dom.minidom.parseString(xml_content).toprettyxml()
                key = worksheet_path.replace("xl/", "")
                result[key] = formatted_xml
            
            # Extract shared strings if exists
            if "xl/sharedStrings.xml" in zip_file.namelist():
                xml_content = zip_file.read("xl/sharedStrings.xml").decode('utf-8')
                formatted_xml = xml.dom.minidom.parseString(xml_content).toprettyxml()
                result["sharedStrings.xml"] = formatted_xml
            
            # Extract styles if exists
            if "xl/styles.xml" in zip_file.namelist():
                xml_content = zip_file.read("xl/styles.xml").decode('utf-8')
                formatted_xml = xml.dom.minidom.parseString(xml_content).toprettyxml()
                result["styles.xml"] = formatted_xml
            
            # Dump to multi-file delimited format
            return dump_multi_file_content(result)
            
    except Exception as e:
        raise ValueError(f"Failed to extract Excel content: {str(e)}")

def save_docx_content(docx_path, xml_content):
    """Save XML content back to DOCX file by updating the document.xml inside the ZIP"""
    try:
        # Read the existing DOCX file
        with zipfile.ZipFile(docx_path, 'r') as zip_read:
            # Get all files in the ZIP
            file_list = zip_read.namelist()
            if 'word/document.xml' not in file_list:
                raise ValueError("Invalid DOCX: 'word/document.xml' not found")
            
            # Create a new DOCX file with updated content
            temp_path = docx_path + '.tmp'
            with zipfile.ZipFile(temp_path, 'w', zipfile.ZIP_DEFLATED) as zip_write:
                # Copy all files except document.xml
                for file_name in file_list:
                    if file_name != 'word/document.xml':
                        zip_write.writestr(file_name, zip_read.read(file_name))
                
                # Write the new document.xml content
                clean_xml = _clean_header_from_xml(xml_content)
                zip_write.writestr('word/document.xml', clean_xml.encode('utf-8'))
        
        # Replace the original file with the updated one
        shutil.move(temp_path, docx_path)
        
    except Exception as e:
        # Clean up temp file if it exists
        if os.path.exists(docx_path + '.tmp'):
            os.remove(docx_path + '.tmp')
        raise ValueError(f"Failed to save DOCX content: {str(e)}")

def save_xlsx_content(xlsx_path, multi_file_content):
    """Save multi-file content back to Excel file by parsing delimited format"""
    try:
        # Parse the multi-file format
        xml_files = parse_multi_file_content(multi_file_content)
        
        # Read the existing Excel file
        with zipfile.ZipFile(xlsx_path, 'r') as zip_read:
            file_list = zip_read.namelist()
            
            # Create a new Excel file with updated content
            temp_path = xlsx_path + '.tmp'
            with zipfile.ZipFile(temp_path, 'w', zipfile.ZIP_DEFLATED) as zip_write:
                # Copy all files except the ones we're updating
                files_to_update = set()
                for key in xml_files.keys():
                    full_path = f"xl/{key}"
                    files_to_update.add(full_path)
                
                for file_name in file_list:
                    if file_name not in files_to_update:
                        zip_write.writestr(file_name, zip_read.read(file_name))
                
                # Write the updated XML files
                for key, xml_content in xml_files.items():
                    full_path = f"xl/{key}"
                    clean_xml = _clean_header_from_xml(xml_content)
                    zip_write.writestr(full_path, clean_xml.encode('utf-8'))
        
        # Replace the original file with the updated one
        shutil.move(temp_path, xlsx_path)
        
    except Exception as e:
        # Clean up temp file if it exists
        if os.path.exists(xlsx_path + '.tmp'):
            os.remove(xlsx_path + '.tmp')
        raise ValueError(f"Failed to save Excel content: {str(e)}")

def parse_multi_file_content(content):
    """Parse multi-file content format into a dictionary of filename -> xml_content"""
    result = {}
    parts = content.split("=== FILE: ")
    for part in parts[1:]:
        if " ===" not in part:
            continue
        filename_end = part.find(" ===")
        if filename_end == -1:
            continue
        filename = part[:filename_end]
        xml_content = part[filename_end + 4:].strip()
        if filename and xml_content:
            result[filename] = xml_content
    return result

def dump_multi_file_content(files_map):
    """Dump a dict of filename -> xml_content into the delimited multi-file format"""
    parts = []
    for key, content in files_map.items():
        parts.append(f"=== FILE: {key} ===")
        parts.append(content.strip())
    # Join with double newlines to match extract_xlsx_content format
    return "\n\n".join(parts)

def _clean_header_from_xml(xml_content, header_marker=None):
    """Remove the header comments from XML content"""
    clean_xml = xml_content
    if header_marker and clean_xml.startswith(header_marker):
        lines = clean_xml.split('\n')
        xml_start = 0
        for i, line in enumerate(lines):
            if line.strip().startswith('<?xml'):
                xml_start = i
                break
        clean_xml = '\n'.join(lines[xml_start:])
    else:
        lines = clean_xml.split('\n')
        for i, line in enumerate(lines):
            if line.strip().startswith('<?xml'):
                clean_xml = '\n'.join(lines[i:])
                break
    return clean_xml