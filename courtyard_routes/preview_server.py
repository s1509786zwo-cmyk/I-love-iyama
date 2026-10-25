from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path
import shutil, zipfile
from urllib.parse import urlsplit, unquote
ROOT=Path(__file__).resolve().parent
PACKAGE=ROOT.parent/'GRAND_ATLAS_DeHaar_原解像度_配信一式.zip'
class Handler(SimpleHTTPRequestHandler):
    def __init__(self,*args,**kwargs):super().__init__(*args,directory=str(ROOT),**kwargs)
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin','*')
        super().end_headers()
    def do_GET(self):
        name=unquote(urlsplit(self.path).path).lstrip('/')
        if name=='assets/dehaar.glb' and not (ROOT/name).exists():
            try:
                with zipfile.ZipFile(PACKAGE) as z:
                    info=z.getinfo(name)
                    self.send_response(200);self.send_header('Content-Type','model/gltf-binary');self.send_header('Content-Length',str(info.file_size));self.send_header('Cache-Control','public, max-age=3600');self.end_headers()
                    with z.open(name) as src:shutil.copyfileobj(src,self.wfile,1024*1024)
            except (BrokenPipeError,ConnectionResetError):pass
            return
        super().do_GET()
    def do_HEAD(self):
        name=unquote(urlsplit(self.path).path).lstrip('/')
        if name=='assets/dehaar.glb' and not (ROOT/name).exists():
            with zipfile.ZipFile(PACKAGE) as z:info=z.getinfo(name)
            self.send_response(200);self.send_header('Content-Type','model/gltf-binary');self.send_header('Content-Length',str(info.file_size));self.end_headers();return
        super().do_HEAD()
if __name__=='__main__':
    print('GRAND ATLAS on 0.0.0.0:8082',flush=True)
    ThreadingHTTPServer(('0.0.0.0',8082),Handler).serve_forever()
