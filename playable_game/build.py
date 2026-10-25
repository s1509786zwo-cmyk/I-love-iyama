#!/usr/bin/env python3
from pathlib import Path
root = Path(__file__).parent

def safe_js(text: str) -> str:
    return text.replace("</script>", "<\\/script>")

template = (root / "src/template.html").read_text(encoding="utf-8")
css = (root / "src/style.css").read_text(encoding="utf-8")
three = safe_js((root / "lib/three.min.js").read_text(encoding="utf-8"))
game = safe_js((root / "src/game.js").read_text(encoding="utf-8"))

html = template.replace("/*__CSS__*/", css).replace("/*__THREE__*/", three).replace("/*__GAME__*/", game)

(root / "index.html").write_text(html, encoding="utf-8")
named = root.parent / "耳が飾りになるまで_プレイ可能版.html"
named.write_text(html, encoding="utf-8")
print(f"Built: {root / 'index.html'} ({len(html.encode('utf-8'))/1024:.0f} KiB)")
print(f"Built: {named}")
