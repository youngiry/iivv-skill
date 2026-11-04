from pathlib import Path
import tempfile, shutil, subprocess, sys, json, zipfile
src=Path(__file__).resolve().parents[1]
with tempfile.TemporaryDirectory() as tmp:
    root=Path(tmp)
    (root/'scripts').mkdir(); (root/'docs').mkdir()
    shutil.copy(src/'scripts/build.py',root/'scripts/build.py')
    skill=root/'skills/iivv'; (skill/'references').mkdir(parents=True); (skill/'assets').mkdir()
    for rel in ['SKILL.md','references/custom-memes.md','references/extension-guide.md','references/meme-template.json','scripts/manage_memes.py']:
        (skill/rel).parent.mkdir(parents=True,exist_ok=True); shutil.copy(src/'skills/iivv'/rel,skill/rel)
    for name in ['callbacks','patterns','reactions','sources']:
        (skill/'references'/f'{name}.md').write_text('# Fixture reference\n')
    (skill/'assets/manifest.json').write_text('[]')
    subprocess.run([sys.executable,str(root/'scripts/build.py')],check=True)
    for name in ['iivv-v1.0.0.zip','iivv-workbuddy-v1.0.0.zip']:
        with zipfile.ZipFile(root/'dist'/name) as z:
            assert 'iivv/scripts/manage_memes.py' in z.namelist()
            assert 'iivv/references/custom-memes.md' in z.namelist()
            assert z.testzip() is None
    prompt=(root/'docs/通用提示词.md').read_text()
    assert '](references/custom-memes.md)' not in prompt
    assert '单文件模式' in prompt
    print('PASS: isolated standard/WorkBuddy packaging and prompt-link smoke test')
