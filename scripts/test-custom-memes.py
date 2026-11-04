from pathlib import Path
import tempfile, shutil, json, subprocess, sys, zipfile
from base64 import b64decode
src=Path(__file__).resolve().parents[1] / 'skills/iivv'
with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp)/'iivv'; (root/'scripts').mkdir(parents=True)
    shutil.copy(src/'scripts/manage_memes.py',root/'scripts/manage_memes.py')
    card=json.loads((src/'references/meme-template.json').read_text())
    entry=Path(tmp)/'entry.json'; entry.write_text(json.dumps(card))
    image=Path(tmp)/'source.png'; image.write_bytes(b64decode('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='))
    def run(*args,ok=True):
        r=subprocess.run([sys.executable,str(root/'scripts/manage_memes.py'),*map(str,args)],capture_output=True,text=True)
        assert (r.returncode==0)==ok,(args,r.stdout,r.stderr)
        return r
    run('rebuild'); run('check')
    run('add','--entry',entry,'--image',image); run('check')
    target=root/'custom'/card['id']; assert (target/'image.png').read_bytes()==image.read_bytes()
    run('add','--entry',entry,'--image',image,ok=False)
    output=Path(tmp)/'share.zip'; run('export',card['id'],'--output',output)
    with zipfile.ZipFile(output) as z:
        assert len(z.namelist())==2
        assert z.read('iivv/custom/'+card['id']+'/image.png')==image.read_bytes()
    run('export',card['id'],'--output',output,ok=False)
    (target/'image.png').write_bytes(b'broken'); run('check',ok=False)
    (target/'image.png').write_bytes(image.read_bytes()); run('check')
    card['id']='../escape'; entry.write_text(json.dumps(card)); run('add','--entry',entry,ok=False)
    card['id']='text-only'; entry.write_text(json.dumps(card)); run('add','--entry',entry); run('check')
    card['id']='missing-fields'; del card['situations']; entry.write_text(json.dumps(card)); run('add','--entry',entry,ok=False)
    print('PASS: image byte preservation, text cards, duplicate IDs, path traversal, required fields, tamper detection, index checks, ZIP contents and overwrite refusal')
