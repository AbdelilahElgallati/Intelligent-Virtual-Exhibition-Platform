import os
import re

FILES = [
    "app/modules/enterprise/router.py",
    "app/modules/events/router.py",
    "app/modules/conferences/router.py",
    "app/modules/analytics/router.py",
]

def process_file(filepath):
    if not os.path.exists(filepath):
        print(f"File not found: {filepath}")
        return
        
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
        
    # 1. Add import
    need_import = False
    if 'resolve_event_id' not in content and 'event_id = await resolve_event_id' not in content:
        if 'from app.modules.events.service import get_event_by_id' in content:
            content = content.replace(
                'from app.modules.events.service import get_event_by_id',
                'from app.modules.events.service import get_event_by_id, resolve_event_id'
            )
            need_import = True
        elif 'from app.modules.events.service import' in content:
            # Just append to the first one
            content = re.sub(
                r'(from app.modules.events.service import [^\n]+)',
                r'\1, resolve_event_id',
                content, count=1
            )
            need_import = True
        else:
            # Add new import after other imports
            content = re.sub(
                r'(from typing import [^\n]+\n)',
                r'\1from app.modules.events.service import resolve_event_id\n',
                content, count=1
            )
            need_import = True

    # 2. Inject resolution
    # Find functions with @router... takes event_id: str
    pattern = re.compile(
        r'(@router\.[a-z]+\(\"[^\"]*\{event_id\}[^\"]*\"[^)]*\)\n'
        r'(?:@[^\n]+\n)?' # possible other decorators
        r'async def [a-zA-Z0-9_]+\([^)]*event_id\s*:\s*str[^)]*\)(?:\s*->\s*[^{:]+)?\s*:)\n(\s+)',
        re.MULTILINE | re.DOTALL
    )
    
    def replacer(m):
        signature = m.group(1)
        indent = m.group(2)
        # Check if already resolved
        # The lookahead is hard, so we just check if it's already there in the next few lines
        # Actually, let's just blindly inject, but only if not already there
        injection = f"{indent}event_id = await resolve_event_id(event_id)\n"
        return f"{signature}\n{injection}{indent}"

    # We iterate and replace manually to avoid replacing if already present
    new_content = ""
    last_idx = 0
    modifications = 0
    for m in pattern.finditer(content):
        new_content += content[last_idx:m.end()]
        
        # Look ahead to see if already resolved
        lookahead = content[m.end():m.end()+100]
        if "event_id = await resolve_event_id" not in lookahead:
            indent = m.group(2)
            new_content += f"{indent}event_id = await resolve_event_id(event_id)\n"
            modifications += 1
            
        last_idx = m.end()
        
    new_content += content[last_idx:]
    
    if modifications > 0 or need_import:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(new_content)
        print(f"Updated {filepath}: {modifications} injections.")
    else:
        print(f"No changes needed for {filepath}")

for f in FILES:
    process_file(f)
