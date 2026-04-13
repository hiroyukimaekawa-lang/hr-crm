
import sys

def check_div_balance(filename):
    with open(filename, 'r') as f:
        content = f.read()
    
    # Simple tag counter ignoring attributes and strings
    import re
    tokens = re.findall(r'<(/?div|Teleport|/Teleport|template|/template|Layout|/Layout)', content)
    
    stack = []
    line_nums = []
    
    lines = content.split('\n')
    current_line = 1
    
    # We'll do a more manual scan to get line numbers
    for i, line in enumerate(lines):
        for match in re.finditer(r'<(div|/div|Teleport|/Teleport|Layout|/Layout)', line):
            tag = match.group(1)
            line_num = i + 1
            if tag.startswith('/'):
                tag_name = tag[1:]
                if not stack:
                    print(f"[{line_num}] Error: Unexpected closing tag </{tag_name}>")
                else:
                    open_tag, open_line = stack.pop()
                    if open_tag != tag_name:
                        print(f"[{line_num}] Error: Mismatched tag </{tag_name}> (expected </{open_tag}> for <{open_tag}> from line {open_line})")
                    else:
                        print(f"[{line_num}] Closed <{open_tag}> from line {open_line}")
            else:
                stack.append((tag, line_num))
                print(f"[{line_num}] Opened <{tag}>")
    
    if stack:
        for tag, line in stack:
            print(f"Error: Tag <{tag}> at line {line} was never closed")

if __name__ == "__main__":
    check_div_balance(sys.argv[1])
