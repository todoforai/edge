#!/usr/bin/env python3
import sys
import os

# Add the parent directory to the path so we can import todoforai_edge
sys.path.insert(0, os.path.join(os.path.dirname(__file__), '..'))

from todoforai_edge.handlers.docx_handler import extract_xlsx_content, parse_multi_file_content, dump_multi_file_content

def test_xlsx_extraction():
    """Test extracting content from the input.xlsx file"""
    xlsx_path = os.path.join(os.path.dirname(__file__), 'input.xlsx')
    
    if not os.path.exists(xlsx_path):
        print(f"Error: {xlsx_path} does not exist")
        return
    
    try:
        # Extract content (multi-file delimited)
        result = extract_xlsx_content(xlsx_path)
        print('result preview:', result[:500])
        
        # Parse the multi-file format
        data = parse_multi_file_content(result)
        
        print("=== XLSX EXTRACTION RESULTS ===")
        print(f"Number of XML files extracted: {len(data)}")
        print("\nFiles found:")
        for key in data.keys():
            print(f"  - {key}")
        
        print("\n=== SAMPLE CONTENT ===")
        for key, content in data.items():
            print(f"\n--- {key} ---")
            preview = content[:500]
            if len(content) > 500:
                preview += "..."
            print(preview)
            print(f"Total length: {len(content)} characters")
        
        # Save the result to a file for inspection
        output_path = os.path.join(os.path.dirname(__file__), 'extracted_xlsx_content.txt')
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(result)
        print(f"\nFull content saved to: {output_path}")

        # Optional: round-trip check (parse -> dump)
        round_trip = dump_multi_file_content(data)
        print("\nRound-trip size match:", len(round_trip) == len(result), len(round_trip), len(result), len(round_trip.strip()), len(result.strip()))
        
    except Exception as e:
        print(f"Error extracting XLSX content: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    test_xlsx_extraction()